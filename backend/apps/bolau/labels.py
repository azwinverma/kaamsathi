"""Localised labels and messages for Bolau (``*_label`` fields, error messages).

Nepali: msgctxt "bolau" in locale/ne/LC_MESSAGES/django.po. Words: Sipalu (सिपालु), Ghardhani (घरधनी),
Bolau (बोलाउ), Kaam request (कामको अनुरोध), Offer (प्रस्ताव), Arrival code (आगमन कोड).
"""

from django.utils.translation import pgettext_lazy

from apps.core.labels import choices, label  # noqa: F401  (re-exported)


def b(text):
    return pgettext_lazy("bolau", text)


PRICE_TYPE = {
    "fixed": b("Fixed price"),
    "hourly": b("Per hour"),
    "visit_then_quote": b("Visit, then quote"),
}

BOOKING_STATUS = {
    "requested": b("Requested"),
    "accepted": b("Accepted"),
    "declined": b("Declined"),
    "expired": b("Expired"),
    "on_the_way": b("On the way"),
    "arrived": b("Arrived"),
    "in_progress": b("Work in progress"),
    "completed": b("Completed"),
    "confirmed": b("Confirmed"),
    "cancelled": b("Cancelled"),
    "no_show": b("No-show"),
    "disputed": b("Disputed"),
}

FEE_STATUS = {
    "waived": b("Waived"),
    "pending": b("Pending"),
    "paid": b("Paid"),
    "refunded": b("Refunded"),
}

CANCELLED_BY = {"ghardhani": b("Ghardhani"), "sipalu": b("Sipalu"), "ops": b("KaamSathi")}

PAY_METHOD = {
    "cash": b("Cash"),
    "esewa": b("eSewa"),
    "khalti": b("Khalti"),
    "bank": b("Bank transfer"),
}

SOURCE = {"direct": b("Booked directly"), "request": b("From a Kaam request")}

QUOTE_STATUS = {
    "none": b("No quote yet"),
    "proposed": b("Quote waiting for approval"),
    "approved": b("Quote approved"),
    "rejected": b("Quote declined"),
}

REQUEST_STATUS = {
    "open": b("Open"),
    "offers_received": b("Offers received"),
    "booked": b("Booked"),
    "expired": b("Expired"),
    "cancelled": b("Cancelled"),
}

OFFER_STATUS = {
    "pending": b("Pending"),
    "accepted": b("Accepted"),
    "rejected": b("Not chosen"),
    "withdrawn": b("Withdrawn"),
    "expired": b("Expired"),
}

ADDRESS_LABEL = {"home": b("Home"), "office": b("Office"), "other": b("Other")}

RATING_SIDE = {"ghardhani": b("Ghardhani"), "sipalu": b("Sipalu")}

# Tags: what the Ghardhani says about the Sipalu, and what the Sipalu says about the Ghardhani.
SIPALU_TAGS = {
    "on_time": b("On time"),
    "clean_work": b("Clean work"),
    "polite": b("Polite"),
    "fair_price": b("Fair price"),
    "skilled": b("Skilled"),
    "explained_work": b("Explained the work"),
}
GHARDHANI_TAGS = {
    "respectful": b("Respectful"),
    "paid_as_agreed": b("Paid as agreed"),
    "clear_instructions": b("Clear instructions"),
    "safe_place": b("Safe place to work"),
}

REPORT_REASON = {
    "off_platform_payment": b("Asked to pay or deal outside KaamSathi"),
    "abusive": b("Abusive or threatening behaviour"),
    "fake_profile": b("Fake profile or wrong person"),
    "other": b("Other"),
}

COMMENT_STATUS = {"visible": b("Visible"), "flagged": b("Flagged"), "hidden": b("Hidden")}

ONBOARDING_STEP = {
    "name": b("Your name"),
    "photo": b("Photo"),
    "skills": b("Trade and skills"),
    "languages": b("Languages"),
    "service_area": b("Where you work"),
    "availability": b("When you work"),
    "services": b("Services and prices"),
    "headline": b("Headline and about you"),
    "payment": b("How Ghardhani pay you"),
    "identity": b("ID for verification"),
    "consent": b("Consent"),
}

COMPLETENESS = {
    "name": b("Add your name"),
    "photo": b("Add a profile photo"),
    "skills": b("Add your trade and skills"),
    "languages": b("Add the languages you speak"),
    "identity": b("Upload your citizenship or national ID"),
    "verified": b("Get your identity verified by KaamSathi"),
    "headline": b("Write a short headline"),
    "services": b("Add at least one service with a price"),
    "availability": b("Set the days and hours you work"),
    "service_area": b("Choose the areas you work in"),
    "payment_details": b("Add your eSewa, Khalti or bank details"),
    "consent": b("Agree to show your profile publicly"),
    "portfolio": b("Add a photo of your work (optional)"),
}

MESSAGES = {
    "not_bookable": b("This Sipalu cannot be booked right now."),
    "self_booking": b("You cannot book yourself."),
    "lead_time": b("Book at least 60 minutes ahead."),
    "outside_availability": b("The Sipalu does not work at this time. Choose another time."),
    "time_off": b("The Sipalu is away on this day."),
    "slot_taken": b("The Sipalu already has a booking at this time."),
    "outside_area": b("This address is outside the Sipalu's service area."),
    "address_not_found": b("Choose one of your saved addresses."),
    "service_not_found": b("This service is not offered by the Sipalu."),
    "invalid_transition": b("This booking cannot do that now."),
    "arrival_code_invalid": b("The arrival code is wrong."),
    "arrival_code_locked": b("Too many wrong codes. Ask the Ghardhani to contact KaamSathi support."),
    "quote_required": b("The Ghardhani must approve your quote before work starts."),
    "final_above_quote": b("The final price cannot be more than the quoted price."),
    "no_show_too_early": b("You can report a no-show only 30 minutes after the start time."),
    "already_rated": b("You have already rated this booking."),
    "rate_after_confirm": b("You can rate after the booking is confirmed."),
    "request_full": b("This request already has three offers."),
    "already_offered": b("You have already sent an offer for this request."),
    "request_closed": b("This request is no longer taking offers."),
    "not_in_area_or_trade": b("This request is not in your trade or service area."),
    "handle_taken": b("This handle is already taken."),
    "handle_reserved": b("This handle is reserved. Choose another one."),
    "handle_format": b("Use 3–30 small letters, numbers or hyphens."),
    "handle_too_soon": b("You can change your handle once every 30 days."),
    "below_min_hourly": b("The hourly rate cannot be below the minimum wage (Rs %(minimum)s per hour)."),
    "visit_fee_required": b("Add a visit fee for visit-then-quote services."),
    "portfolio_full": b("You can add up to 12 portfolio photos."),
    "suspended": b("Bolau is paused on your profile. Contact KaamSathi support."),
    "phone_in_use": b("Another account already uses this phone number for a Sipalu profile."),
    "fee_not_payable": b("There is no booking fee to pay for this booking."),
    "receipt_unavailable": b("A receipt is available once the booking fee is paid."),
    "dispute_open": b("A dispute is already open for this booking."),
    "too_many_photos": b("Add up to 4 photos."),
    "window_invalid": b("The preferred time window is not valid."),
}

EMERGENCY = {
    "line": "100",
    "en": "In an emergency call Nepal Police on 100.",
    "ne": "आपत्कालमा नेपाल प्रहरीलाई १०० मा फोन गर्नुहोस्।",
}


def message(key: str, **kwargs) -> str:
    text = str(MESSAGES[key])
    return text % kwargs if kwargs else text
