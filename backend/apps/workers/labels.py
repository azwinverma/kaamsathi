"""Localised labels for worker-profile enums added by the checklist completion (msgctxt "complete1")."""

from django.utils.translation import pgettext_lazy


def _(text):
    return pgettext_lazy("complete1", text)


# Spoken languages (ISO 639 codes). Nepal's major languages first, then common destination/
# workplace languages. Display only — never used to filter anyone out of a job.
LANGUAGE = {
    "ne": _("Nepali"),
    "en": _("English"),
    "hi": _("Hindi"),
    "mai": _("Maithili"),
    "bho": _("Bhojpuri"),
    "new": _("Nepal Bhasa (Newari)"),
    "tha": _("Tharu"),
    "tam": _("Tamang"),
    "mgp": _("Magar"),
    "gvr": _("Gurung"),
    "lim": _("Limbu"),
    "bap": _("Rai (Bantawa)"),
    "xsr": _("Sherpa"),
    "dty": _("Doteli"),
    "awa": _("Awadhi"),
    "ur": _("Urdu"),
    "ar": _("Arabic"),
    "ms": _("Malay"),
    "ja": _("Japanese"),
    "ko": _("Korean"),
    "zh": _("Chinese"),
}

PROFICIENCY = {
    "basic": _("Basic"),
    "conversational": _("Conversational"),
    "fluent": _("Fluent"),
    "native": _("Native"),
}

# Language of a trade alias (search synonym).
ALIAS_LANGUAGE = {
    "en": _("English"),
    "ne": _("Nepali (Devanagari)"),
    "ne_rom": _("Nepali (Roman)"),
    "hi": _("Hindi"),
    "other": _("Other"),
}

COMPLETENESS = {
    "photo": _("Add a profile photo"),
    "identity": _("Add your citizenship or national ID"),
    "skills": _("Add at least one skill"),
    "languages": _("Add the languages you speak"),
    "availability": _("Set your availability and expected wage"),
    "verified_credential": _("Get a certificate verified"),
    "work_history": _("Add your work history"),
    "payment_details": _("Add bank or wallet details for salary"),
}

COMMENT_STATUS = {
    "visible": _("Visible"),
    "flagged": _("Flagged for review"),
    "hidden": _("Hidden by KaamSathi"),
}
