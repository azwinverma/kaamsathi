"""Security §1: upload validation (magic bytes, extension agreement, EXIF strip, PDF scripts, ClamAV)."""

from __future__ import annotations

import io
import socket
import threading

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from openpyxl import Workbook
from PIL import Image

from apps.core.exceptions import APIError
from apps.core.uploads import validate_upload
from apps.workers.models import Worker
from tests import factories as f
from tests.conftest import auth_client


def jpeg_with_gps(size=(64, 48)) -> bytes:
    img = Image.new("RGB", size, (200, 30, 30))
    exif = Image.Exif()
    exif[0x010F] = "SpyCam"  # Make
    exif[0x8825] = {1: "N", 2: (27.0, 42.0, 0.0), 3: "E", 4: (85.0, 19.0, 0.0)}  # GPS IFD
    out = io.BytesIO()
    img.save(out, format="JPEG", exif=exif)
    return out.getvalue()


def png_bytes() -> bytes:
    out = io.BytesIO()
    Image.new("RGBA", (10, 10)).save(out, format="PNG")
    return out.getvalue()


def xlsx_bytes() -> bytes:
    wb = Workbook()
    wb.active.append(["full_name", "phone"])
    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


def up(name, data, ctype="application/octet-stream"):
    return SimpleUploadedFile(name, data, content_type=ctype)


def rejected(fn):
    with pytest.raises(APIError) as exc:
        fn()
    assert exc.value.code == "upload_rejected"
    return exc.value


def test_exif_and_gps_stripped_on_reencode():
    raw = jpeg_with_gps()
    assert Image.open(io.BytesIO(raw)).getexif().get(0x8825)
    out = validate_upload(up("face.jpg", raw, "image/jpeg"), kinds={"image"})
    data = out.read()
    img = Image.open(io.BytesIO(data))
    assert img.format == "JPEG" and not img.getexif()
    assert b"SpyCam" not in data and out.name == "face.jpg"


def test_large_image_downscaled():
    out = io.BytesIO()
    Image.new("RGB", (5000, 100)).save(out, format="PNG")
    res = validate_upload(up("wide.png", out.getvalue(), "image/png"), kinds={"image"}, max_mb=8)
    assert max(Image.open(res).size) == 4000


def test_fake_extension_rejected():
    # an executable renamed to .jpg
    rejected(lambda: validate_upload(up("photo.jpg", b"MZ\x90\x00" + b"\x00" * 100), kinds={"image"}))
    # a real PNG named .jpg → extension/contents disagree
    rejected(lambda: validate_upload(up("photo.jpg", png_bytes(), "image/jpeg"), kinds={"image"}))
    # HTML pretending to be a PDF
    rejected(lambda: validate_upload(up("doc.pdf", b"<html><script>x</script>"), kinds={"pdf"}))


def test_content_type_mismatch_rejected():
    rejected(lambda: validate_upload(up("x.png", png_bytes(), "application/pdf"), kinds={"image"}))


def test_kind_not_allowed_and_size_cap():
    rejected(lambda: validate_upload(up("x.png", png_bytes(), "image/png"), kinds={"pdf"}))
    rejected(
        lambda: validate_upload(
            up("big.pdf", b"%PDF-1.4\n" + b"0" * (2 * 1024 * 1024)), kinds={"pdf"}, max_mb=1
        )
    )
    rejected(lambda: validate_upload(up("empty.csv", b""), kinds={"csv"}))


@pytest.mark.parametrize(
    "payload",
    [
        b"/OpenAction << /S /JavaScript /JS (app.alert(1)) >>",
        b"/Names << /EmbeddedFiles 3 0 R >>",
        b"/AA << /O << /S /Launch /F (cmd.exe) >> >>",
        b"/S /J#61vaScript",  # name-escape obfuscation
    ],
)
def test_pdf_with_active_content_rejected(payload):
    pdf = b"%PDF-1.7\n1 0 obj\n<< " + payload + b" >>\nendobj\n%%EOF"
    rejected(lambda: validate_upload(up("cv.pdf", pdf, "application/pdf"), kinds={"pdf"}))


def test_clean_pdf_csv_xlsx_accepted():
    pdf = up("cert.pdf", b"%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF", "application/pdf")
    assert validate_upload(pdf, kinds={"pdf"}) is pdf
    csv = up("rows.csv", "full_name,phone\nराम,9841000000\n".encode(), "text/csv")
    assert validate_upload(csv, kinds={"csv"}).read().startswith(b"full_name")
    validate_upload(up("rows.xlsx", xlsx_bytes()), kinds={"xlsx", "csv"})
    rejected(lambda: validate_upload(up("rows.csv", b"a,b\x00\x01\xff"), kinds={"csv"}))
    rejected(lambda: validate_upload(up("rows.xlsx", b"PK\x03\x04garbage"), kinds={"xlsx"}))


class FakeClamd:
    def __init__(self, reply: bytes):
        self.reply = reply
        self.sock = socket.socket()
        self.sock.bind(("127.0.0.1", 0))
        self.sock.listen(1)
        self.port = self.sock.getsockname()[1]
        self.received = b""
        threading.Thread(target=self._serve, daemon=True).start()

    def _serve(self):
        conn, _ = self.sock.accept()
        with conn:
            while not self.received.endswith(b"\x00\x00\x00\x00"):
                chunk = conn.recv(65536)
                if not chunk:
                    break
                self.received += chunk
            conn.sendall(self.reply)
        self.sock.close()


def test_clamav_instream_infected_and_clean():
    bad = FakeClamd(b"stream: Eicar-Test-Signature FOUND\0")
    with override_settings(CLAMAV_HOST="127.0.0.1", CLAMAV_PORT=bad.port):
        rejected(lambda: validate_upload(up("a.pdf", b"%PDF-1.4 eicar"), kinds={"pdf"}))
    assert bad.received.startswith(b"zINSTREAM\0")
    ok = FakeClamd(b"stream: OK\0")
    with override_settings(CLAMAV_HOST="127.0.0.1", CLAMAV_PORT=ok.port):
        validate_upload(up("a.pdf", b"%PDF-1.4 fine"), kinds={"pdf"})


def test_clamav_unreachable_fails_open_unless_required():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    with override_settings(CLAMAV_HOST="127.0.0.1", CLAMAV_PORT=port, CLAMAV_TIMEOUT=0.5):
        validate_upload(up("a.pdf", b"%PDF-1.4 fine"), kinds={"pdf"})
        with override_settings(CLAMAV_REQUIRED=True):
            rejected(lambda: validate_upload(up("a.pdf", b"%PDF-1.4 fine"), kinds={"pdf"}))


# --- wired into existing endpoints ------------------------------------------------------------
@pytest.mark.django_db
def test_ops_worker_photo_upload_strips_exif_and_rejects_fakes():
    staff = auth_client(f.UserFactory(is_staff=True))
    worker = f.WorkerFactory()
    res = staff.patch(
        f"/api/v1/ops/workers/{worker.id}",
        {"photo": up("face.jpg", jpeg_with_gps(), "image/jpeg")},
        format="multipart",
    )
    assert res.status_code == 200, res.content
    worker = Worker.objects.get(pk=worker.pk)
    assert not Image.open(worker.photo.open("rb")).getexif()
    fake = staff.patch(
        f"/api/v1/ops/workers/{worker.id}",
        {"id_front": up("id.jpg", png_bytes(), "image/jpeg")},
        format="multipart",
    )
    assert fake.status_code == 400 and fake.json()["error"]["code"] == "upload_rejected"


@pytest.mark.django_db
def test_employment_import_rejects_disguised_file(owner_client):
    res = owner_client.post(
        "/api/v1/org/employments/import", {"file": up("rows.csv", b"MZ\x00\x00binary")}, format="multipart"
    )
    assert res.status_code == 400 and res.json()["error"]["code"] == "upload_rejected"
