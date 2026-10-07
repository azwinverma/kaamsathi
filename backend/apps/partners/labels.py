"""Localised labels for partners / finance / insights enums (``*_label`` fields)."""

from django.utils.translation import gettext_lazy as _

PARTNER_KIND = {
    "bank": _("Bank"),
    "microfinance": _("Microfinance"),
    "insurer": _("Insurer"),
    "wallet": _("Wallet / payment provider"),
    "training": _("Training provider"),
    "recruitment_agency": _("Recruitment agency"),
    "government": _("Government"),
}
REGULATOR = {
    "nrb": _("Nepal Rastra Bank"),
    "beema_samiti": _("Nepal Insurance Authority"),
    "dofe": _("Department of Foreign Employment"),
    "ctevt": _("CTEVT"),
    "other": _("Other regulator"),
}
SCOPE = {
    "profile.read": _("Read your verified profile"),
    "earnings.read": _("Read your verified earnings"),
    "passport.read": _("Read your Skill Passport"),
    "referrals.write": _("Update referral status"),
}
PURPOSE = {
    "loan_assessment": _("Loan assessment"),
    "insurance": _("Insurance"),
    "ewa": _("Earned wage access"),
    "recruitment": _("Recruitment"),
    "training": _("Training"),
    "verification": _("Verification"),
}
GRANT_STATUS = {"active": _("Active"), "revoked": _("Revoked"), "expired": _("Expired")}
OFFER_KIND = {
    "loan": _("Loan"),
    "ewa": _("Earned wage access"),
    "insurance": _("Insurance"),
    "savings": _("Savings"),
    "tool_finance": _("Tool finance"),
    "vehicle_finance": _("Vehicle finance"),
}
REFERRAL_STATUS = {
    "submitted": _("Submitted"),
    "under_review": _("Under review"),
    "approved": _("Approved"),
    "rejected": _("Not approved"),
    "disbursed": _("Disbursed"),
    "closed": _("Closed"),
}

# Scopes a key may hold vs. scopes that read a worker's data (need a ConsentGrant).
KEY_SCOPES = list(SCOPE.keys())
DATA_SCOPES = ["profile.read", "earnings.read", "passport.read"]
