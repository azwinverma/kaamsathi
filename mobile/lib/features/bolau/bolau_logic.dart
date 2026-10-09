/// Pure Bolau rules (unit-tested): booking state → actions, price checks,
/// onboarding step payloads, slots, earnings, notification targets.
library;

import '../../core/api/json.dart';
import '../../core/format.dart';
import 'bolau_models.dart';

/// Which side of a booking the user is on.
enum BookingSide { sipalu, ghardhani }

/// Everything a party can do with a booking from its current state.
enum BookingAction {
  // Sipalu
  accept,
  decline,
  onTheWay,
  enterArrivalCode,
  sendQuote,
  start,
  complete,
  // Ghardhani
  showArrivalCode,
  approveQuote,
  rejectQuote,
  confirm,
  cancel,
  reportNoShow,
  // Both
  markPaid,
  rate,
  callOther,
  reportProblem,
}

/// The actions [side] can take on [b] right now ([now] for the no-show
/// window). The order is the order of buttons on screen (primary first).
List<BookingAction> bookingActions(Booking b, BookingSide side, {DateTime? now}) {
  final t = now ?? DateTime.now();
  final s = b.status;
  final out = <BookingAction>[];
  // No-show can be reported 30 min after the start (server rule).
  final started = b.scheduledStart != null && !t.isBefore(b.scheduledStart!.add(const Duration(minutes: 30)));
  if (side == BookingSide.sipalu) {
    switch (s) {
      case BookingStatus.requested:
        out.addAll([BookingAction.accept, BookingAction.decline]);
      case BookingStatus.accepted:
        // Arrival is allowed straight from accepted too.
        out.addAll([BookingAction.onTheWay, BookingAction.enterArrivalCode, BookingAction.cancel]);
      case BookingStatus.onTheWay:
        out.add(BookingAction.enterArrivalCode);
      case BookingStatus.arrived:
        if (b.needsQuote) {
          out.add(BookingAction.sendQuote);
        } else if (!b.awaitingQuoteApproval) {
          out.add(BookingAction.start);
        }
      case BookingStatus.inProgress:
        out.add(BookingAction.complete);
      case BookingStatus.completed:
        if (!b.isPaid) out.add(BookingAction.markPaid);
      case BookingStatus.confirmed:
        if (!b.isPaid) out.add(BookingAction.markPaid);
        if (b.rateOpen) out.add(BookingAction.rate);
    }
  } else {
    switch (s) {
      case BookingStatus.requested:
        out.add(BookingAction.cancel);
      case BookingStatus.accepted:
        out.add(BookingAction.showArrivalCode);
        if (started) out.add(BookingAction.reportNoShow);
        out.add(BookingAction.cancel);
      case BookingStatus.onTheWay:
        out.addAll([BookingAction.showArrivalCode, BookingAction.cancel]);
      case BookingStatus.arrived:
        if (b.awaitingQuoteApproval) out.addAll([BookingAction.approveQuote, BookingAction.rejectQuote]);
      case BookingStatus.completed:
        out.add(BookingAction.confirm);
        if (!b.isPaid) out.add(BookingAction.markPaid);
      case BookingStatus.confirmed:
        if (!b.isPaid) out.add(BookingAction.markPaid);
        if (b.rateOpen) out.add(BookingAction.rate);
    }
  }
  if (BookingStatus.contactOpen.contains(s)) out.add(BookingAction.callOther);
  if (s != BookingStatus.requested && !b.isTerminal) out.add(BookingAction.reportProblem);
  return out;
}

/// Cancelling is free until 2 h before the start (contract §4; the server's
/// `free_cancel_until` when sent).
bool isFreeCancellation(Booking b, {DateTime? now}) {
  final until = b.freeCancelUntil ?? b.scheduledStart?.subtract(const Duration(hours: 2));
  if (until == null) return true;
  return (now ?? DateTime.now()).isBefore(until);
}

/// Index on [BookingStatus.path] reached by [status] (−1 for off-path).
int bookingPathIndex(String status) => BookingStatus.path.indexOf(status);

// ---------------------------------------------------------------------------
// Prices
// ---------------------------------------------------------------------------

/// Why a price is not acceptable, or null when it is.
enum PriceProblem { missing, belowMinimum }

/// Checks a rupee amount typed by a Sipalu (rule 3, "fair by default", same
/// as the server's `check_price`): hourly ≥ the hourly minimum wage; a fixed
/// price ≥ minimum hourly × [estimatedMinutes] when the time is known; visit
/// fees only need to be positive.
PriceProblem? checkPrice(
  String? input, {
  required String priceType,
  required String minimumHourly,
  int? estimatedMinutes,
}) {
  final paisa = parsePaisa(moneyInput(input));
  if (paisa == null || paisa <= 0) return PriceProblem.missing;
  final min = parsePaisa(minimumHourly) ?? 0;
  if (priceType == PriceType.hourly && paisa < min) return PriceProblem.belowMinimum;
  if (priceType == PriceType.fixed && estimatedMinutes != null && estimatedMinutes > 0) {
    if (paisa < (min * estimatedMinutes / 60).ceil()) return PriceProblem.belowMinimum;
  }
  return null;
}

/// Normalises a typed rupee amount to the API money string (`"600"`).
String? moneyInput(String? input) {
  final t = toLatinDigits(input ?? '').replaceAll(',', '').trim();
  return t.isEmpty ? null : t;
}

// ---------------------------------------------------------------------------
// Onboarding (POST /me/sipalu/onboarding-step {step, data})
// ---------------------------------------------------------------------------

/// Server onboarding steps (`apps/bolau/profiles.ONBOARDING_STEPS`).
abstract final class ServerStep {
  static const name = 'name';
  static const photo = 'photo';
  static const skills = 'skills';
  static const languages = 'languages';
  static const serviceArea = 'service_area';
  static const availability = 'availability';
  static const services = 'services';
  static const headline = 'headline';
  static const payment = 'payment';
  static const identity = 'identity';
  static const consent = 'consent';
}

/// Wizard screens in order. Some post more than one server step (basics:
/// name + photo; profile: headline + handle + consent).
abstract final class OnboardingStep {
  static const basics = 'basics';
  static const skills = 'skills';
  static const languages = 'languages';
  static const area = 'area';
  static const availability = 'availability';
  static const services = 'services';
  static const payment = 'payment';
  static const identity = 'identity';
  static const handle = 'handle';

  static const all = [basics, skills, languages, area, availability, services, payment, identity, handle];

  /// The wizard screen that owns a server step.
  static String forServerStep(String step) => switch (step) {
    ServerStep.name || ServerStep.photo => basics,
    ServerStep.serviceArea => area,
    ServerStep.headline || ServerStep.consent => handle,
    _ => all.contains(step) ? step : basics,
  };

  /// Server steps a wizard screen completes.
  static List<String> serverSteps(String screen) => switch (screen) {
    basics => const [ServerStep.name, ServerStep.photo],
    area => const [ServerStep.serviceArea],
    handle => const [ServerStep.headline, ServerStep.consent],
    _ => [screen],
  };

  /// Where to resume: the screen of the server's `next_step`, else the
  /// first screen with a server step not done yet, else the last one.
  static int resumeIndex(OnboardingState s) {
    final next = s.nextStep;
    if (next != null) return all.indexOf(forServerStep(next));
    if (s.completedSteps.isEmpty) return 0;
    for (var i = 0; i < all.length; i++) {
      if (!serverSteps(all[i]).every(s.completedSteps.contains)) return i;
    }
    return all.length - 1;
  }
}

/// One server call of a wizard screen: `{step, data}` + files.
typedef StepCall = ({String step, Json data, Map<String, String> files});

/// `name` step.
Json basicsStep({required String name, String? nameNe}) => {
  'full_name': name.trim(),
  if (nameNe != null && nameNe.trim().isNotEmpty) 'full_name_ne': nameNe.trim(),
};

Json skillsStep(List<SipaluSkill> skills) => {
  'primary_trade': skills.isEmpty ? null : skills.first.trade.code,
  'skills': [for (final s in skills) s.toJson()],
};

Json languagesStep(List<({String code, String proficiency})> langs) => {
  'languages': [
    for (final x in langs) {'language': x.code, 'proficiency': x.proficiency},
  ],
};

/// `service_area` step.
Json areaStep({String? homeDistrict, required List<String> districtCodes, required int radiusKm}) => {
  if (homeDistrict != null) 'current_district': homeDistrict,
  'service_districts': districtCodes,
  'service_radius_km': radiusKm,
};

/// `availability` step (time off is saved separately).
Json availabilityStep(List<AvailabilityRule> rules) => {
  'rules': [for (final r in rules) r.toJson()],
};

Json servicesStep(List<SipaluService> services) => {
  'services': [for (final s in services) s.toJson()],
};

/// Own account only — customers pay the Sipalu directly.
Json paymentStep({
  required String method,
  String? walletId,
  String? bankName,
  String? bankAccountNo,
  String? bankAccountName,
}) => {
  'payment_method': method,
  if (method == 'esewa' || method == 'khalti') 'wallet_id': walletId?.trim(),
  if (method == 'bank') ...{
    'bank_name': bankName?.trim(),
    'bank_account_no': bankAccountNo?.trim(),
    'bank_account_name': bankAccountName?.trim(),
  },
};

/// `identity` step: [idType] is `citizenship` or `nid` (files: `id_front`,
/// `id_back`).
Json identityStep({required String idType, required String idNumber}) => {
  idType == 'nid' ? 'nid_no' : 'citizenship_no': toLatinDigits(idNumber).trim(),
};

/// `headline` step.
Json headlineStep({required String headline, String? headlineNe, String? bio}) => {
  'headline': headline.trim(),
  if (headlineNe != null && headlineNe.trim().isNotEmpty) 'headline_ne': headlineNe.trim(),
  if (bio != null && bio.trim().isNotEmpty) 'bio': bio.trim(),
};

/// `consent` step: data processing + public profile (rule: shown only with
/// consent).
Json consentStep({required bool publicProfile}) => {'data_processing': true, 'public_profile': publicProfile};

/// Same as the server (`HANDLE_RE`): 3–30 of a–z, 0–9 and -, not starting
/// or ending with -.
final _handleRe = RegExp(r'^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$');

bool isValidHandle(String h) => _handleRe.hasMatch(h.trim().toLowerCase());

/// A handle suggestion from a name (`Ram Bahadur Thapa` → `ram-thapa`).
String suggestHandle(String name) {
  final parts = name
      .toLowerCase()
      .replaceAll(RegExp(r'[^a-z0-9\s-]'), ' ')
      .trim()
      .split(RegExp(r'\s+'))
      .where((p) => p.isNotEmpty);
  final list = parts.toList();
  if (list.isEmpty) return '';
  final s = list.length == 1 ? list.first : '${list.first}-${list.last}';
  return s.length > 30 ? s.substring(0, 30) : s;
}

// ---------------------------------------------------------------------------
// Slots
// ---------------------------------------------------------------------------

/// Bookable start times on [day] (a Nepal calendar date) from the weekly
/// [rules]: on the hour, leaving room for [minutes] of work, and at least
/// 60 minutes after [now] (lead time, contract §4). Returned as Nepal
/// wall-clock DateTimes (not UTC).
List<DateTime> slotsFor(DateTime day, List<AvailabilityRule> rules, {int minutes = 60, required DateTime now}) {
  final nowNpt = now.toUtc().add(const Duration(hours: 5, minutes: 45));
  final earliest = DateTime(
    nowNpt.year,
    nowNpt.month,
    nowNpt.day,
    nowNpt.hour,
    nowNpt.minute,
  ).add(const Duration(minutes: 60));
  final out = <DateTime>[];
  for (final r in rules.where((r) => r.weekday == apiWeekday(day))) {
    final from = minutesOfDay(r.start);
    final to = minutesOfDay(r.end);
    if (from == null || to == null) continue;
    final first = ((from + 59) ~/ 60) * 60;
    final need = minutes < 60 ? 60 : minutes;
    for (var m = first; m + need <= to; m += 60) {
      final t = DateTime(day.year, day.month, day.day, m ~/ 60, m % 60);
      if (!t.isBefore(earliest)) out.add(t);
    }
  }
  out.sort();
  return out;
}

// ---------------------------------------------------------------------------
// Earnings (amounts the Sipalu marked paid — KaamSathi never holds them)
// ---------------------------------------------------------------------------

class Earnings {
  const Earnings({required this.thisMonthPaisa, required this.totalPaisa, required this.jobs});
  final int thisMonthPaisa;
  final int totalPaisa;
  final int jobs;
}

Earnings earningsFrom(List<Booking> jobs, {DateTime? now}) {
  final today = BsDate.fromAd(nepalToday(now));
  var month = 0;
  var total = 0;
  var count = 0;
  for (final b in jobs) {
    if (b.paidBySipaluAt == null && b.paidByGhardhaniAt == null) continue;
    final paisa = parsePaisa(b.amount) ?? 0;
    total += paisa;
    count++;
    final d = BsDate.fromAd(nepalToday(b.paidAt ?? now));
    if (d.year == today.year && d.month == today.month) month += paisa;
  }
  return Earnings(thisMonthPaisa: month, totalPaisa: total, jobs: count);
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

/// Bolau notification events. The server sends them as `bolau_<event>`
/// (`apps/bolau/notify.py`); the bare names are accepted too.
const bolauNotificationKinds = {
  'booking_requested',
  'booking_instant',
  'booking_accepted',
  'booking_declined',
  'booking_expired',
  'booking_on_the_way',
  'booking_arrived',
  'booking_quote',
  'booking_quote_approved',
  'booking_quote_rejected',
  'booking_started',
  'booking_completed',
  'booking_confirmed',
  'booking_cancelled',
  'booking_no_show',
  'booking_disputed',
  'booking_paid',
  'booking_reminder',
  'request_new',
  'offer_new',
  'offer_received',
  'offer_accepted',
  'offer_rejected',
  'request_expired',
  'sipalu_suspended',
  'sipalu_unsuspended',
};

/// Events only a Sipalu receives.
const _sipaluEvents = {
  'booking_requested',
  'booking_instant',
  'booking_quote_approved',
  'booking_quote_rejected',
  'booking_no_show',
  'request_new',
  'offer_accepted',
  'offer_rejected',
  'sipalu_suspended',
  'sipalu_unsuspended',
};

/// Events only a Ghardhani receives.
const _ghardhaniEvents = {
  'booking_accepted',
  'booking_declined',
  'booking_expired',
  'booking_on_the_way',
  'booking_arrived',
  'booking_quote',
  'booking_started',
  'booking_completed',
  'offer_new',
  'offer_received',
  'request_expired',
};

/// `bolau_booking_requested` → `booking_requested`.
String bolauEvent(String kind) {
  final k = kind.toLowerCase();
  return k.startsWith('bolau_') ? k.substring(6) : k;
}

bool isBolauNotification(String kind) =>
    kind.toLowerCase().startsWith('bolau_') || bolauNotificationKinds.contains(kind.toLowerCase());

/// Which side a Bolau notification is for. The server's link says it
/// (`/ghar/…` Ghardhani, `/bolau/…` Sipalu); else `data.side`; else the
/// event; events both parties get (confirmed, cancelled, paid…) fall back to
/// [current].
BookingSide? bolauSideFor(String kind, Json data, {String? link, BookingSide? current}) {
  if (!isBolauNotification(kind)) return null;
  final l = link ?? '';
  if (l.startsWith('/ghar/') || l.startsWith('/g/')) return BookingSide.ghardhani;
  if (l.startsWith('/bolau/') || l.startsWith('/w/bolau')) return BookingSide.sipalu;
  final hint = '${data['side'] ?? data['role'] ?? data['for'] ?? ''}'.toLowerCase();
  if (hint == 'sipalu') return BookingSide.sipalu;
  if (hint == 'ghardhani') return BookingSide.ghardhani;
  final e = bolauEvent(kind);
  if (_sipaluEvents.contains(e)) return BookingSide.sipalu;
  if (_ghardhaniEvents.contains(e)) return BookingSide.ghardhani;
  return current ?? BookingSide.ghardhani;
}
