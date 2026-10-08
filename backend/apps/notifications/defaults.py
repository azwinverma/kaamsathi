"""Default notification templates (seeded by migration 0004 and ``ensure_default_templates``).

{key: {channel: {language: (subject, body)}}}. Bodies use ``{variable}`` placeholders.
In-app subjects stay variable-free so SMS events mirrored to the inbox can use them as titles.
"""

DEFAULT_TEMPLATES = {
    "payslip_ready": {
        "inapp": {
            "en": ("Salary paid", "Your {month} salary {amount} from {organization} is paid."),
            "ne": ("तलब भुक्तानी भयो", "{organization} बाट तपाईंको {month} को तलब {amount} भुक्तानी भयो।"),
        },
        "sms": {
            "en": (
                "",
                "KaamSathi: Your {month} salary {amount} from {organization} is paid. "
                "See payslip in the app.",
            ),
            "ne": (
                "",
                "KaamSathi: {organization} बाट {month} को तलब {amount} भुक्तानी भयो। एपमा तलबी पर्चा हेर्नुहोस्।",
            ),
        },
        "email": {
            "en": (
                "Your {month} payslip from {organization}",
                "Namaste {name},\n\nYour {month} salary of {amount} from {organization} has been paid. "
                "Open the KaamSathi app to see and download your payslip.\n\nKaamSathi",
            ),
            "ne": (
                "{organization} बाट {month} को तलबी पर्चा",
                "नमस्ते {name},\n\n{organization} बाट तपाईंको {month} को तलब {amount} भुक्तानी भएको छ। "
                "तलबी पर्चा हेर्न र डाउनलोड गर्न KaamSathi एप खोल्नुहोस्।\n\nKaamSathi",
            ),
        },
    },
    "shortlist": {
        "inapp": {
            "en": ("New candidates shortlisted", "{count} new candidate(s) shortlisted for {job_title}."),
            "ne": ("नयाँ उम्मेदवार छनोट भए", "{job_title} का लागि {count} नयाँ उम्मेदवार छनोट भए।"),
        },
        "sms": {
            "en": (
                "",
                "KaamSathi: {count} new candidate(s) shortlisted for '{job_title}'. Review in KaamSathi.",
            ),
            "ne": ("", "KaamSathi: '{job_title}' का लागि {count} नयाँ उम्मेदवार छनोट भए। KaamSathi मा हेर्नुहोस्।"),
        },
    },
    "interview_reminder": {
        "inapp": {
            "en": ("Interview reminder", "Interview for {job_title} at {organization} today at {time}."),
            "ne": ("अन्तर्वार्ताको सम्झना", "आज {time} मा {organization} मा {job_title} को अन्तर्वार्ता छ।"),
        },
        "sms": {
            "en": ("", "KaamSathi: Reminder - interview for {job_title} at {organization} today {time}."),
            "ne": ("", "KaamSathi: सम्झना - आज {time} मा {organization} मा {job_title} को अन्तर्वार्ता।"),
        },
    },
    "dispute_raised": {
        "inapp": {
            "en": (
                "A worker raised a dispute",
                "A worker raised a {kind} dispute. Please respond in Disputes.",
            ),
            "ne": (
                "कामदारले उजुरी दर्ता गर्नुभयो",
                "एक कामदारले {kind} सम्बन्धी उजुरी दर्ता गर्नुभयो। उजुरीमा जवाफ दिनुहोस्।",
            ),
        },
    },
    "dispute_resolved": {
        "inapp": {
            "en": (
                "Your dispute was updated",
                "Your dispute has been {status}. Open the app to see the note.",
            ),
            "ne": ("तपाईंको उजुरी अद्यावधिक भयो", "तपाईंको उजुरी {status} भयो। टिप्पणी हेर्न एप खोल्नुहोस्।"),
        },
    },
    "credential_expiry": {
        "inapp": {
            "en": (
                "Certificate expiring soon",
                "Your {title} expires in {days} days ({date}). Renew and upload it.",
            ),
            "ne": (
                "प्रमाणपत्रको म्याद सकिँदै",
                "तपाईंको {title} को म्याद {days} दिनमा ({date}) सकिन्छ। नवीकरण गरी अपलोड गर्नुहोस्।",
            ),
        },
    },
    "timesheet_approved": {
        "inapp": {
            "en": ("Timesheet approved", "Week of {week}: {hours} h overtime approved."),
            "ne": ("टाइमसिट स्वीकृत भयो", "{week} देखिको हप्ता: {hours} घण्टा ओभरटाइम स्वीकृत।"),
        },
        "push": {
            "en": ("Timesheet approved", "Week of {week}: {hours} h overtime approved."),
            "ne": ("टाइमसिट स्वीकृत भयो", "{week} देखिको हप्ता: {hours} घण्टा ओभरटाइम स्वीकृत।"),
        },
    },
}


def iter_defaults():
    for key, channels in DEFAULT_TEMPLATES.items():
        for channel, langs in channels.items():
            for language, (subject, body) in langs.items():
                yield key, channel, language, subject, body
