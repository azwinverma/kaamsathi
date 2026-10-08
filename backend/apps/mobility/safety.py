"""Safety guidance shown with every worker-facing mobility response (docs/CONTRACT-EXTENSIONS.md §5).

KaamSathi never recruits or matches for jobs abroad. We only help a worker keep verified documents
and share them with a DoFE-licensed agency of their own choice. Kept as literal en/ne strings (not
gettext) so both languages are always returned regardless of ``Accept-Language``.
"""

DOFE_URL = "https://dofe.gov.np"

POINTS = [
    (
        "KaamSathi does not recruit for jobs abroad. We only keep your documents safe and share them "
        "with an agency you choose.",
        "कामसाथीले विदेशमा कामका लागि भर्ना गर्दैन। हामी तपाईंका कागजात सुरक्षित राख्छौं र तपाईंले "
        "रोजेको एजेन्सीलाई मात्र पठाउँछौं।",
    ),
    (
        "Use only recruitment agencies licensed by the Department of Foreign Employment (DoFE).",
        "वैदेशिक रोजगार विभाग (DoFE) बाट इजाजतपत्र पाएका म्यानपावर कम्पनी मात्र प्रयोग गर्नुहोस्।",
    ),
    (
        "Check the agency's licence number yourself on the official DoFE website: dofe.gov.np",
        "एजेन्सीको इजाजतपत्र नम्बर वैदेशिक रोजगार विभागको आधिकारिक वेबसाइट dofe.gov.np मा आफैं जाँच्नुहोस्।",
    ),
    (
        "Get a receipt for every payment you make. Never pay more than the government-approved fee.",
        "तपाईंले गर्ने हरेक भुक्तानीको रसिद लिनुहोस्। सरकारले तोकेभन्दा बढी शुल्क कहिल्यै नतिर्नुहोस्।",
    ),
    (
        "Never hand over your original passport without a signed receipt.",
        "सही गरिएको रसिद नलिई आफ्नो सक्कल राहदानी कसैलाई नदिनुहोस्।",
    ),
    (
        "If something feels wrong, call the DoFE or the Foreign Employment Board before you sign or pay.",
        "केही शंका लागेमा सही वा भुक्तानी गर्नुअघि वैदेशिक रोजगार विभाग वा वैदेशिक रोजगार बोर्डमा सम्पर्क गर्नुहोस्।",
    ),
]


def safety_guidance() -> dict:
    return {
        "title_en": "Stay safe when going abroad for work",
        "title_ne": "वैदेशिक रोजगारीमा जाँदा सुरक्षित रहनुहोस्",
        "en": [en for en, _ne in POINTS],
        "ne": [ne for _en, ne in POINTS],
        "dofe_url": DOFE_URL,
    }
