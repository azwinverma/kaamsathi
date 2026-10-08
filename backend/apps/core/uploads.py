"""Upload validation for every user-supplied file (docs/CONTRACT-EXTENSIONS.md §1 "Uploads").

``validate_upload(file, *, kinds, max_mb=8) -> File`` — raises ``APIError("upload_rejected")``:
1. size cap (``max_mb``);
2. magic-byte sniff — ``jpeg | png | webp | pdf | xlsx | csv`` (``"image"`` = jpeg/png/webp);
3. the file extension and the declared content type must agree with the sniffed type;
4. images are re-encoded with Pillow: EXIF (incl. GPS) and other metadata stripped, orientation
   applied, longest side capped at 4000 px, decompression bombs rejected;
5. PDFs containing ``/JavaScript``, ``/JS``, ``/EmbeddedFile(s)``, ``/Launch`` are rejected
   (names with ``#xx`` escapes are decoded first);
6. optional ClamAV scan via clamd ``INSTREAM`` over TCP (``CLAMAV_HOST``/``CLAMAV_PORT``); when unset
   the scan is skipped (logged at debug). An unreachable scanner is logged as an error and the
   upload rejected only if ``CLAMAV_REQUIRED`` is set.

Returns a ``File`` safe to assign to a ``FileField``/``ImageField`` (re-encoded for images, the
original upload rewound otherwise).
"""

from __future__ import annotations

import io
import logging
import os
import re
import socket
import struct
import zipfile

from django.conf import settings
from django.core.files.base import ContentFile
from django.utils.translation import pgettext

from .exceptions import APIError

logger = logging.getLogger("kaamsathi.uploads")

MAX_IMAGE_SIDE = 4000
MAX_IMAGE_PIXELS = 60_000_000
MAX_XLSX_UNCOMPRESSED = 100 * 1024 * 1024

EXTENSIONS = {
    "jpeg": {".jpg", ".jpeg"},
    "png": {".png"},
    "webp": {".webp"},
    "pdf": {".pdf"},
    "xlsx": {".xlsx"},
    "csv": {".csv"},
}
CONTENT_TYPES = {
    "jpeg": {"image/jpeg", "image/jpg", "image/pjpeg"},
    "png": {"image/png", "image/x-png"},
    "webp": {"image/webp"},
    "pdf": {"application/pdf", "application/x-pdf"},
    "xlsx": {
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/zip",
        "application/x-zip-compressed",
        "application/vnd.ms-excel",
    },
    "csv": {
        "text/csv",
        "text/plain",
        "application/csv",
        "text/comma-separated-values",
        "application/vnd.ms-excel",
        "text/x-csv",
    },
}
GENERIC_TYPES = {"", "application/octet-stream", "binary/octet-stream"}
KIND_GROUPS = {"image": {"jpeg", "png", "webp"}}
PIL_FORMATS = {"jpeg": "JPEG", "png": "PNG", "webp": "WEBP"}
PDF_DANGEROUS = re.compile(rb"/(JavaScript|JS|EmbeddedFiles?|Launch)(?![A-Za-z0-9])")
_PDF_NAME_ESCAPE = re.compile(rb"#([0-9A-Fa-f]{2})")


def _reject(message: str):
    raise APIError("upload_rejected", message=message)


def _expand(kinds) -> set[str]:
    out = set()
    for k in kinds:
        out |= KIND_GROUPS.get(k, {k})
    unknown = out - set(EXTENSIONS)
    if unknown:
        raise ValueError(f"unknown upload kinds: {unknown}")
    return out


def sniff(head: bytes, data: bytes | None = None) -> str | None:
    if head.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    if head.startswith(b"%PDF-"):
        return "pdf"
    if head.startswith(b"PK\x03\x04") and data is not None:
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as zf:
                names = zf.namelist()
                if "[Content_Types].xml" in names and any(n.startswith("xl/") for n in names):
                    if sum(i.file_size for i in zf.infolist()) > MAX_XLSX_UNCOMPRESSED:
                        return "zipbomb"
                    return "xlsx"
        except zipfile.BadZipFile:
            return None
        return None
    if data is not None and _looks_like_csv(data):
        return "csv"
    return None


def _looks_like_csv(data: bytes) -> bool:
    if b"\x00" in data[:65536]:
        return False
    try:
        data.decode("utf-8-sig")
    except UnicodeDecodeError:
        return False
    return True


def _read_all(file) -> bytes:
    if hasattr(file, "seek"):
        file.seek(0)
    if hasattr(file, "chunks"):
        data = b"".join(file.chunks())
    else:
        data = file.read()
    if hasattr(file, "seek"):
        file.seek(0)
    return data if isinstance(data, bytes) else data.encode()


def _reencode_image(data: bytes, kind: str, name: str) -> ContentFile:
    from PIL import Image, ImageOps, UnidentifiedImageError

    try:
        with Image.open(io.BytesIO(data)) as probe:
            w, h = probe.size
            if w * h > MAX_IMAGE_PIXELS:
                _reject(pgettext("security", "The image is too large."))
            probe.verify()
        img = Image.open(io.BytesIO(data))
        img.load()
    except APIError:
        raise
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError, Image.DecompressionBombError):
        _reject(pgettext("security", "The image file is damaged or not a real image."))
    img = ImageOps.exif_transpose(img)
    if max(img.size) > MAX_IMAGE_SIDE:
        img.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE))
    out = io.BytesIO()
    fmt = PIL_FORMATS[kind]
    if fmt == "JPEG":
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        img.save(out, format="JPEG", quality=88, optimize=True)
    elif fmt == "PNG":
        if img.mode not in ("RGB", "RGBA", "L", "LA", "P"):
            img = img.convert("RGBA")
        img.save(out, format="PNG", optimize=True)
    else:
        img.save(out, format="WEBP", quality=88)
    # Fresh Image objects carry no EXIF/XMP/ICC unless passed explicitly — metadata is dropped.
    return ContentFile(out.getvalue(), name=name)


def _check_pdf(data: bytes) -> None:
    normalised = _PDF_NAME_ESCAPE.sub(lambda m: bytes([int(m.group(1), 16)]), data)
    if PDF_DANGEROUS.search(normalised):
        _reject(pgettext("security", "PDFs with scripts, attachments or launch actions are not accepted."))


def clamav_scan(data: bytes) -> str | None:
    """Return the virus name if clamd reports one, None if clean. Raises OSError if unreachable."""
    host = getattr(settings, "CLAMAV_HOST", "")
    port = int(getattr(settings, "CLAMAV_PORT", 3310))
    timeout = float(getattr(settings, "CLAMAV_TIMEOUT", 10.0))
    with socket.create_connection((host, port), timeout=timeout) as sock:
        sock.sendall(b"zINSTREAM\0")
        view = memoryview(data)
        for i in range(0, len(data), 64 * 1024):
            chunk = view[i : i + 64 * 1024]
            sock.sendall(struct.pack(">I", len(chunk)) + bytes(chunk))
        sock.sendall(struct.pack(">I", 0))
        reply = b""
        while not reply.endswith(b"\0"):
            part = sock.recv(4096)
            if not part:
                break
            reply += part
    text = reply.rstrip(b"\0").decode("utf-8", "replace").strip()
    if text.endswith("FOUND"):
        return text.split(":", 1)[-1].rsplit(" ", 1)[0].strip()
    if text.endswith("OK"):
        return None
    raise OSError(f"unexpected clamd reply: {text[:200]}")


def _scan(data: bytes, name: str) -> None:
    if not getattr(settings, "CLAMAV_HOST", ""):
        logger.debug("ClamAV not configured; skipped scan of %s", name)
        return
    try:
        virus = clamav_scan(data)
    except OSError:
        logger.error("ClamAV unreachable; upload %s not scanned", name, exc_info=True)
        if getattr(settings, "CLAMAV_REQUIRED", False):
            _reject(pgettext("security", "The file could not be scanned right now. Please try again."))
        return
    if virus:
        logger.warning("ClamAV rejected upload %s: %s", name, virus)
        _reject(pgettext("security", "The file was rejected by the virus scanner."))


def validate_upload(file, *, kinds: set[str], max_mb: int = 8):
    if file is None:
        return file
    allowed = _expand(kinds)
    name = os.path.basename(getattr(file, "name", "") or "upload")
    size = getattr(file, "size", None)
    if size is not None and size > max_mb * 1024 * 1024:
        _reject(pgettext("security", "The file is larger than %(mb)s MB.") % {"mb": max_mb})
    data = _read_all(file)
    if len(data) > max_mb * 1024 * 1024:
        _reject(pgettext("security", "The file is larger than %(mb)s MB.") % {"mb": max_mb})
    if not data:
        _reject(pgettext("security", "The file is empty."))
    kind = sniff(data[:64], data)
    if kind == "zipbomb":
        _reject(pgettext("security", "The spreadsheet is too large."))
    if kind is None or kind not in allowed:
        _reject(pgettext("security", "This file type is not accepted."))
    ext = os.path.splitext(name)[1].lower()
    if ext not in EXTENSIONS[kind]:
        _reject(pgettext("security", "The file extension does not match its contents."))
    ctype = (getattr(file, "content_type", "") or "").split(";", 1)[0].strip().lower()
    if ctype not in GENERIC_TYPES and ctype not in CONTENT_TYPES[kind]:
        _reject(pgettext("security", "The file type does not match its contents."))
    if kind == "pdf":
        _check_pdf(data)
    _scan(data, name)
    if kind in PIL_FORMATS:
        return _reencode_image(data, kind, name)
    if hasattr(file, "seek"):
        file.seek(0)
    return file
