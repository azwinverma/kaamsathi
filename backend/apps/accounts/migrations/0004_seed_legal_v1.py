"""Seed v1 (draft — pending legal review) terms and privacy policy, pointing at the web pages."""

from django.db import migrations
from django.utils import timezone

DOCS = [
    {
        "kind": "terms",
        "url": "/terms",
        "summary_en": "How KaamSathi works for workers and employers, what we do and don't do, and your "
        "responsibilities. Workers never pay KaamSathi. Draft pending legal review.",
        "summary_ne": "कामसाथी कामदार र रोजगारदाताका लागि कसरी काम गर्छ, हामी के गर्छौं र के गर्दैनौं, "
        "र तपाईंका जिम्मेवारीहरू। कामदारले कामसाथीलाई कहिल्यै पैसा तिर्नु पर्दैन। कानुनी समीक्षा बाँकी रहेको मस्यौदा।",
    },
    {
        "kind": "privacy",
        "url": "/privacy",
        "summary_en": "What personal data we collect, why, who can see it, how long we keep it and how to "
        "export or delete it (Individual Privacy Act 2075). Draft pending legal review.",
        "summary_ne": "हामी कुन व्यक्तिगत विवरण किन सङ्कलन गर्छौं, कसले हेर्न सक्छ, कति समय राख्छौं र "
        "कसरी निकाल्न वा मेटाउन सकिन्छ (वैयक्तिक गोपनीयता ऐन २०७५)। कानुनी समीक्षा बाँकी रहेको मस्यौदा।",
    },
]


def seed(apps, schema_editor):
    LegalDocument = apps.get_model("accounts", "LegalDocument")
    for doc in DOCS:
        if LegalDocument.objects.filter(kind=doc["kind"]).exists():
            continue
        LegalDocument.objects.create(version="1", published_at=timezone.now(), is_current=True, **doc)


def unseed(apps, schema_editor):
    LegalDocument = apps.get_model("accounts", "LegalDocument")
    LegalDocument.objects.filter(version="1", kind__in=[d["kind"] for d in DOCS], acceptances__isnull=True).delete()


class Migration(migrations.Migration):
    dependencies = [("accounts", "0003_legal_documents")]

    operations = [migrations.RunPython(seed, unseed)]
