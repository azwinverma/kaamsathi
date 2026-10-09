/// Bolau (docs/CONTRACT-BOLAU.md): Sipalu self-profiles, Ghardhani bookings,
/// Kaam requests and offers. Hand-written, null-tolerant parsers — the
/// server may send refs as codes or `{code, name_en, name_ne}` objects.
library;

import '../../core/api/json.dart';
import '../../core/format.dart';
import '../common/ref_data.dart';

/// `fixed | hourly | visit_then_quote`.
abstract final class PriceType {
  static const fixed = 'fixed';
  static const hourly = 'hourly';
  static const visitThenQuote = 'visit_then_quote';
  static const all = [fixed, hourly, visitThenQuote];
}

/// Booking statuses (contract §4).
abstract final class BookingStatus {
  static const requested = 'requested';
  static const accepted = 'accepted';
  static const declined = 'declined';
  static const expired = 'expired';
  static const onTheWay = 'on_the_way';
  static const arrived = 'arrived';
  static const inProgress = 'in_progress';
  static const completed = 'completed';
  static const confirmed = 'confirmed';
  static const cancelled = 'cancelled';
  static const noShow = 'no_show';
  static const disputed = 'disputed';

  /// The happy path, in order — drives the tracking timeline.
  static const path = [requested, accepted, onTheWay, arrived, inProgress, completed, confirmed];

  static const terminal = {declined, expired, cancelled, noShow};

  /// Contact details are shared only in these states (rule 4; +48 h after
  /// completion is enforced by the server).
  static const contactOpen = {accepted, onTheWay, arrived, inProgress, completed, confirmed};

  /// Still ahead of the Sipalu ("upcoming jobs").
  static const active = {accepted, onTheWay, arrived, inProgress};
}

/// Money a Sipalu can be paid with, directly (never through KaamSathi).
const directPaymentMethods = ['cash', 'esewa', 'khalti', 'bank'];

/// A 0–100 completeness from `completeness` (int percent, 0–1 fraction, or
/// `{percent|score}`).
int? parseCompleteness(Object? v) {
  if (v is Map) return parseCompleteness(v['percent'] ?? v['score'] ?? v['value']);
  final n = numOf(v);
  if (n == null) return null;
  final fraction = v is double ? n <= 1 && n > 0 : (v is String && v.contains('.') && n <= 1 && n > 0);
  if (fraction) return (n * 100).round();
  return n.round().clamp(0, 100);
}

DateTime? _dt(Object? v) => dateTimeOf(v);

/// A trade with years and NSTB level (Sipalu skills).
class SipaluSkill {
  const SipaluSkill({required this.trade, this.years = 0, this.nstbLevel = 'none'});
  final Trade trade;
  final num years;

  /// none | elementary | level1 | level2 | level3
  final String nstbLevel;

  /// `{trade: ref|code, years, nstb_level}` or the flat API shape
  /// `{code, name_en, name_ne, years, nstb_level}`.
  factory SipaluSkill.fromJson(Json j) => SipaluSkill(
    trade:
        (j['trade'] != null ? Trade.fromAny(j['trade']) : (j['code'] != null ? Trade.fromJson(j) : null)) ??
        const Trade(code: '', nameEn: ''),
    years: numOf(j['years'] ?? j['years_experience']) ?? 0,
    nstbLevel: strOr(j['nstb_level'], 'none'),
  );

  /// Onboarding `skills` row.
  Json toJson() => {'trade': trade.code, 'years_experience': years.round(), 'nstb_level': nstbLevel};
}

/// `SipaluService` (contract §1).
class SipaluService {
  const SipaluService({
    this.id = '',
    required this.trade,
    required this.title,
    this.titleNe,
    this.description,
    required this.priceType,
    this.price,
    this.visitFee,
    this.estimatedMinutes,
    this.isActive = true,
  });

  final String id;
  final Trade trade;
  final String title;
  final String? titleNe;
  final String? description;
  final String priceType;
  final String? price;
  final String? visitFee;
  final int? estimatedMinutes;
  final bool isActive;

  String name(String lang) => lang == 'ne' && (titleNe?.isNotEmpty ?? false) ? titleNe! : title;

  factory SipaluService.fromJson(Json j) => SipaluService(
    id: strOr(j['id']),
    trade: Trade.fromAny(j['trade']) ?? const Trade(code: '', nameEn: ''),
    title: strOr(j['title']),
    titleNe: str(j['title_ne']),
    description: str(j['description']),
    priceType: strOr(j['price_type'], PriceType.fixed),
    price: str(j['price']),
    visitFee: str(j['visit_fee']),
    estimatedMinutes: intOf(j['estimated_minutes']),
    isActive: boolOf(j['is_active'], true),
  );

  Json toJson() => {
    'trade': trade.code,
    'title': title.trim(),
    if (titleNe != null && titleNe!.trim().isNotEmpty) 'title_ne': titleNe!.trim(),
    'price_type': priceType,
    // The API always wants a price; a visit-then-quote service is priced
    // after the visit, so it sends 0 and the visit fee.
    'price': priceType == PriceType.visitThenQuote ? '0' : price,
    if (priceType == PriceType.visitThenQuote) 'visit_fee': visitFee,
    if (estimatedMinutes != null) 'estimated_minutes': estimatedMinutes,
    'is_active': isActive,
  };
}

/// `AvailabilityRule(weekday 0–6, 0 = Sunday, start_time, end_time)`.
class AvailabilityRule {
  const AvailabilityRule({required this.weekday, required this.start, required this.end});

  /// 0 = Sunday … 6 = Saturday (contract convention).
  final int weekday;

  /// `HH:MM`
  final String start;
  final String end;

  factory AvailabilityRule.fromJson(Json j) => AvailabilityRule(
    weekday: intOf(j['weekday']) ?? 0,
    start: _hhmm(strOr(j['start_time'] ?? j['start'], '09:00')),
    end: _hhmm(strOr(j['end_time'] ?? j['end'], '17:00')),
  );

  Json toJson() => {'weekday': weekday, 'start_time': start, 'end_time': end};

  /// Minutes in this window.
  int get minutes => (minutesOfDay(end) ?? 0) - (minutesOfDay(start) ?? 0);

  static String _hhmm(String s) => s.length >= 5 ? s.substring(0, 5) : s;
}

/// `HH:MM` → minutes since midnight.
int? minutesOfDay(String? hhmm) {
  final m = RegExp(r'^(\d{1,2}):(\d{2})').firstMatch(hhmm ?? '');
  if (m == null) return null;
  return int.parse(m.group(1)!) * 60 + int.parse(m.group(2)!);
}

/// API weekday (0 = Sunday … 6 = Saturday) of a calendar date.
int apiWeekday(DateTime d) => d.weekday % 7;

class TimeOff {
  const TimeOff({this.id = '', required this.from, required this.to, this.note});
  final String id;
  final String from;
  final String to;
  final String? note;

  factory TimeOff.fromJson(Json j) =>
      TimeOff(id: strOr(j['id']), from: strOr(j['from_date']), to: strOr(j['to_date']), note: str(j['note']));

  Json toJson() => {'from_date': from, 'to_date': to, if (note != null && note!.isNotEmpty) 'note': note};
}

/// Onboarding progress (`{completed_steps, next_step, completeness}`).
class OnboardingState {
  const OnboardingState({this.completedSteps = const [], this.nextStep, this.completeness});
  final List<String> completedSteps;
  final String? nextStep;
  final int? completeness;

  factory OnboardingState.fromJson(Object? data) {
    final j = asJson(data);
    final inner = asJsonOrNull(j['onboarding']) ?? j;
    return OnboardingState(
      completedSteps: strList(inner['completed_steps']),
      nextStep: str(inner['next_step']),
      completeness: parseCompleteness(inner['completeness'] ?? j['completeness']),
    );
  }
}

/// `GET /me/sipalu` — the Sipalu's own profile (worker fields + Bolau).
class MySipalu {
  const MySipalu({
    this.handle,
    this.headline,
    this.headlineNe,
    this.bio,
    this.bioNe,
    this.bolauEnabled = false,
    this.instantBooking = false,
    this.serviceDistricts = const [],
    this.serviceRadiusKm,
    this.verificationStatus = 'unverified',
    this.verificationLevel = 0,
    this.ratingAvg,
    this.ratingCount = 0,
    this.jobsCompleted = 0,
    this.responseTimeMinutes,
    this.services = const [],
    this.availability = const [],
    this.timeOff = const [],
    this.skills = const [],
    this.onboarding = const OnboardingState(),
    this.paymentMethod,
    this.walletId,
    this.bankName,
    this.bankAccountNo,
    this.bankAccountName,
    this.fullName = '',
    this.fullNameNe,
    this.photo,
    this.district,
    this.bookable,
    this.bookableProblems = const [],
    this.publicConsent = false,
    this.suspended = false,
    this.portfolio = const [],
  });

  final String? handle;
  final String? headline;
  final String? headlineNe;
  final String? bio;
  final String? bioNe;
  final bool bolauEnabled;
  final bool instantBooking;
  final List<District> serviceDistricts;
  final int? serviceRadiusKm;
  final String verificationStatus;
  final int verificationLevel;
  final double? ratingAvg;
  final int ratingCount;
  final int jobsCompleted;
  final int? responseTimeMinutes;
  final List<SipaluService> services;
  final List<AvailabilityRule> availability;
  final List<TimeOff> timeOff;
  final List<SipaluSkill> skills;
  final OnboardingState onboarding;
  final String? paymentMethod;
  final String? walletId;
  final String? bankName;
  final String? bankAccountNo;
  final String? bankAccountName;
  final String fullName;
  final String? fullNameNe;
  final String? photo;
  final District? district;

  /// Server's `bookable` (verified, Bolau on, consent, not suspended…).
  final bool? bookable;

  /// Why not bookable yet (`bookable_problems` keys).
  final List<String> bookableProblems;
  final bool publicConsent;
  final bool suspended;

  /// Work photos (max [PortfolioItem.max]).
  final List<PortfolioItem> portfolio;

  bool get isVerified => verificationStatus == 'verified';

  /// Rule 3: only verified Sipalu with Bolau switched on can be booked.
  bool get isBookable => bookable ?? (isVerified && bolauEnabled);

  int get completeness => onboarding.completeness ?? 0;

  /// Weekly hours from the availability rules.
  double get weeklyHours => availability.fold<int>(0, (s, r) => s + r.minutes) / 60;

  factory MySipalu.fromJson(Object? data) {
    final j = asJson(data);
    final worker = asJsonOrNull(j['worker']) ?? const <String, dynamic>{};
    final payment = asJsonOrNull(j['payment']) ?? const <String, dynamic>{};
    final stats = asJsonOrNull(j['stats']) ?? const <String, dynamic>{};
    Object? pick(String k) => j[k] ?? worker[k];
    return MySipalu(
      handle: str(j['handle']),
      headline: str(j['headline']),
      headlineNe: str(j['headline_ne']),
      bio: str(j['bio']),
      bioNe: str(j['bio_ne']),
      bolauEnabled: boolOf(j['bolau_enabled']),
      instantBooking: boolOf(j['instant_booking']),
      serviceDistricts: [
        for (final d in (j['service_districts'] is List ? j['service_districts'] as List : const <Object>[]))
          if (District.fromAny(d) case final x?) x,
      ],
      serviceRadiusKm: intOf(j['service_radius_km']),
      verificationStatus: strOr(pick('verification_status'), 'unverified'),
      verificationLevel: intOf(pick('verification_level')) ?? 0,
      ratingAvg: numOf(j['rating_avg'] ?? stats['rating_avg']),
      ratingCount: intOf(j['rating_count'] ?? stats['rating_count']) ?? 0,
      jobsCompleted: intOf(j['jobs_completed'] ?? stats['jobs_completed']) ?? 0,
      responseTimeMinutes: intOf(j['response_time_minutes'] ?? stats['response_time_minutes']),
      services: asJsonList(j['services']).map(SipaluService.fromJson).toList(),
      availability: asJsonList(j['availability'] ?? j['availability_rules']).map(AvailabilityRule.fromJson).toList(),
      timeOff: asJsonList(j['time_off']).map(TimeOff.fromJson).toList(),
      skills: asJsonList(pick('skills') ?? pick('trades')).map(SipaluSkill.fromJson).toList(),
      onboarding: OnboardingState.fromJson(j),
      paymentMethod: str(pick('payment_method') ?? payment['method']),
      walletId: str(pick('wallet_id') ?? payment['wallet_id']),
      bankName: str(pick('bank_name') ?? payment['bank_name']),
      bankAccountNo: str(pick('bank_account_no') ?? payment['bank_account_masked']),
      bankAccountName: str(pick('bank_account_name') ?? payment['bank_account_name']),
      fullName: strOr(pick('full_name') ?? pick('name')),
      fullNameNe: str(pick('full_name_ne') ?? pick('name_ne')),
      photo: str(pick('photo') ?? pick('photo_url')),
      district: District.fromAny(pick('current_district') ?? pick('district')),
      bookable: j['bookable'] is bool ? j['bookable'] as bool : null,
      bookableProblems: strList(j['bookable_problems']),
      publicConsent: boolOf(j['public_consent']),
      suspended: j['suspended'] != null && j['suspended'] != false,
      portfolio: asJsonList(j['portfolio']).map(PortfolioItem.fromJson).toList(),
    );
  }
}

/// A search result card (`GET /bolau/search`).
class SipaluCard {
  const SipaluCard({
    required this.handle,
    required this.name,
    this.photoUrl,
    this.headline,
    this.topTrade,
    this.ratingAvg,
    this.ratingCount = 0,
    this.jobsCompleted = 0,
    this.verificationLevel = 0,
    this.fromPrice,
    this.nextAvailable,
    this.distanceBand,
    this.instantBooking = false,
  });

  final String handle;
  final String name;
  final String? photoUrl;
  final String? headline;
  final Trade? topTrade;
  final double? ratingAvg;
  final int ratingCount;
  final int jobsCompleted;
  final int verificationLevel;
  final String? fromPrice;
  final DateTime? nextAvailable;
  final String? distanceBand;
  final bool instantBooking;

  factory SipaluCard.fromJson(Json j) => SipaluCard(
    handle: strOr(j['handle']),
    name: strOr(j['name']),
    photoUrl: str(j['photo_url']),
    headline: str(j['headline']),
    topTrade: Trade.fromAny(j['top_trade']),
    ratingAvg: numOf(j['rating_avg']),
    ratingCount: intOf(j['rating_count']) ?? 0,
    jobsCompleted: intOf(j['jobs_completed']) ?? 0,
    verificationLevel: intOf(j['verification_level']) ?? 0,
    fromPrice: str(j['from_price']),
    nextAvailable: _dt(j['next_available']),
    distanceBand: str(j['distance_band']),
    instantBooking: boolOf(j['instant_booking']),
  );
}

class SipaluReview {
  const SipaluReview({required this.score, this.comment, this.monthBs, this.by});
  final int score;
  final String? comment;
  final String? monthBs;
  final String? by;

  factory SipaluReview.fromJson(Json j) => SipaluReview(
    score: intOf(j['score']) ?? 0,
    comment: str(j['comment']),
    monthBs: str(j['month_bs']),
    by: str(j['by'] ?? j['first_name']),
  );
}

/// `GET /public/sipalu/{handle}` — never phone, address, ID or location.
class PublicSipalu {
  const PublicSipalu({
    required this.handle,
    required this.name,
    this.nameNe,
    this.photoUrl,
    this.headline,
    this.headlineNe,
    this.bio,
    this.bioNe,
    this.trades = const [],
    this.languages = const [],
    this.verificationLevel = 0,
    this.verifiedBadges = const [],
    this.ratingAvg,
    this.ratingCount = 0,
    this.jobsCompleted = 0,
    this.responseTimeMinutes,
    this.services = const [],
    this.serviceDistricts = const [],
    this.availabilityRules = const [],
    this.availabilityText,
    this.reviews = const [],
    this.instantBooking = false,
    this.passportUrl,
    this.bookingFee,
    this.nextAvailable,
    this.portfolio = const [],
  });

  final String handle;
  final String name;
  final String? nameNe;
  final String? photoUrl;
  final String? headline;
  final String? headlineNe;
  final String? bio;
  final String? bioNe;
  final List<SipaluSkill> trades;
  final List<String> languages;
  final int verificationLevel;
  final List<String> verifiedBadges;
  final double? ratingAvg;
  final int ratingCount;
  final int jobsCompleted;
  final int? responseTimeMinutes;
  final List<SipaluService> services;
  final List<District> serviceDistricts;

  /// From `availability_summary` when it is a list of rules.
  final List<AvailabilityRule> availabilityRules;

  /// From `availability_summary` when it is text (or `{text}`).
  final String? availabilityText;
  final List<SipaluReview> reviews;
  final bool instantBooking;
  final String? passportUrl;

  /// The Ghardhani's booking fee for this Sipalu, when the server says.
  final String? bookingFee;
  final DateTime? nextAvailable;

  /// Work photos (signed thumbnail URLs).
  final List<PortfolioItem> portfolio;

  String displayName(String lang) => lang == 'ne' && (nameNe?.isNotEmpty ?? false) ? nameNe! : name;
  String? headlineFor(String lang) => lang == 'ne' && (headlineNe?.isNotEmpty ?? false) ? headlineNe : headline;
  String? bioFor(String lang) => lang == 'ne' && (bioNe?.isNotEmpty ?? false) ? bioNe : bio;

  factory PublicSipalu.fromJson(Json j) {
    final avail = j['availability_summary'];
    final availMap = asJsonOrNull(avail);
    final rulesRaw = avail is List ? avail : (availMap?['rules'] ?? availMap?['weekly']);
    // `weekly: [{weekday, ranges: [["09:00","17:00"], …]}]` → one rule per range.
    final rules = <AvailabilityRule>[
      for (final r in asJsonList(rulesRaw))
        if (r['ranges'] is List)
          for (final range in r['ranges'] as List)
            if (range is List && range.length == 2)
              AvailabilityRule(weekday: intOf(r['weekday']) ?? 0, start: '${range[0]}', end: '${range[1]}')
            else if (range is Map)
              AvailabilityRule.fromJson({'weekday': r['weekday'], ...asJson(range)})
            else
              AvailabilityRule.fromJson(r),
    ];
    return PublicSipalu(
      handle: strOr(j['handle']),
      name: strOr(j['name']),
      nameNe: str(j['name_ne']),
      photoUrl: str(j['photo_url']),
      headline: str(j['headline']),
      headlineNe: str(j['headline_ne']),
      bio: str(j['bio']),
      bioNe: str(j['bio_ne']),
      trades: asJsonList(j['trades']).map(SipaluSkill.fromJson).toList(),
      languages: [
        for (final x in (j['languages'] is List ? j['languages'] as List : const <Object>[]))
          if (x is Map) strOr(x['language'] ?? x['code']) else '$x',
      ],
      verificationLevel: intOf(j['verification_level']) ?? 0,
      verifiedBadges: strList(j['verified_badges']),
      ratingAvg: numOf(j['rating_avg']),
      ratingCount: intOf(j['rating_count']) ?? 0,
      jobsCompleted: intOf(j['jobs_completed']) ?? 0,
      responseTimeMinutes: intOf(j['response_time_minutes']),
      services: asJsonList(j['services']).map(SipaluService.fromJson).where((s) => s.isActive).toList(),
      serviceDistricts: [
        for (final d in (j['service_districts'] is List ? j['service_districts'] as List : const <Object>[]))
          if (District.fromAny(d) case final x?) x,
      ],
      availabilityRules: rules,
      nextAvailable: dateTimeOf(availMap?['next_available'] ?? j['next_available']),
      availabilityText: avail is String ? avail : str(availMap?['text']),
      reviews: asJsonList(j['reviews']).map(SipaluReview.fromJson).toList(),
      instantBooking: boolOf(j['instant_booking']),
      passportUrl: str(j['passport_url']),
      bookingFee: str(j['booking_fee']),
      portfolio: asJsonList(j['portfolio']).map(PortfolioItem.fromJson).toList(),
    );
  }
}

/// A Sipalu work photo (`/me/sipalu/portfolio`, public `portfolio[]`).
class PortfolioItem {
  const PortfolioItem({required this.id, this.imageUrl, this.thumbUrl, this.caption, this.captionNe, this.trade});

  /// Server cap (`PortfolioItem.MAX_ITEMS`).
  static const max = 12;

  /// Upload limit (`validate_upload(max_mb=8)`).
  static const maxBytes = 8 * 1024 * 1024;

  final String id;
  final String? imageUrl;
  final String? thumbUrl;
  final String? caption;
  final String? captionNe;
  final Trade? trade;

  String? get thumb => thumbUrl ?? imageUrl;
  String? get full => imageUrl ?? thumbUrl;

  String? captionFor(String lang) {
    if (lang == 'ne' && (captionNe?.isNotEmpty ?? false)) return captionNe;
    if (caption?.isNotEmpty ?? false) return caption;
    return (captionNe?.isNotEmpty ?? false) ? captionNe : null;
  }

  factory PortfolioItem.fromJson(Json j) => PortfolioItem(
    id: strOr(j['id']),
    imageUrl: str(j['image_url']),
    thumbUrl: str(j['thumb_url']),
    caption: str(j['caption']),
    captionNe: str(j['caption_ne']),
    trade: Trade.fromAny(j['trade']),
  );
}

/// A Ghardhani address (`/me/addresses`).
class BolauAddress {
  const BolauAddress({
    this.id = '',
    this.label = 'home',
    required this.line,
    this.ward,
    this.municipality = '',
    this.district,
    this.landmark,
    this.isDefault = false,
  });

  final String id;

  /// home | office | other
  final String label;
  final String line;
  final int? ward;
  final String municipality;
  final District? district;
  final String? landmark;
  final bool isDefault;

  /// Ward + municipality only — what a Sipalu sees before accepting.
  String area(String lang) {
    final parts = [if (municipality.isNotEmpty) municipality, if (district != null) district!.name(lang)];
    final w = ward == null ? '' : '${lang == 'ne' ? 'वडा' : 'Ward'} ${localizeDigits('$ward', lang)}';
    return [if (w.isNotEmpty) w, ...parts].join(', ');
  }

  factory BolauAddress.fromJson(Json j) => BolauAddress(
    id: strOr(j['id']),
    label: strOr(j['label'], 'home'),
    line: strOr(j['line']),
    ward: intOf(j['ward']),
    municipality: strOr(j['municipality']),
    district: District.fromAny(j['district']),
    landmark: str(j['landmark']),
    isDefault: boolOf(j['is_default']),
  );

  Json toJson() => {
    'label': label,
    'line': line.trim(),
    'ward': ward,
    'municipality': municipality.trim(),
    'district': district?.code,
    if (landmark != null && landmark!.trim().isNotEmpty) 'landmark': landmark!.trim(),
    'is_default': isDefault,
  };
}

/// The other party, as far as the booking shows them.
class BookingParty {
  const BookingParty({
    required this.name,
    this.handle,
    this.photoUrl,
    this.ratingAvg,
    this.ratingCount = 0,
    this.verificationLevel,
  });
  final String name;
  final String? handle;
  final String? photoUrl;
  final double? ratingAvg;
  final int ratingCount;
  final int? verificationLevel;

  static BookingParty? fromAny(Object? v) {
    if (v == null) return null;
    if (v is! Map) return BookingParty(name: '$v');
    final j = asJson(v);
    return BookingParty(
      name: strOr(j['name'] ?? j['display_name'] ?? j['first_name'] ?? j['full_name']),
      handle: str(j['handle']),
      photoUrl: str(j['photo_url'] ?? j['photo']),
      ratingAvg: numOf(j['rating_avg']),
      ratingCount: intOf(j['rating_count']) ?? 0,
      verificationLevel: intOf(j['verification_level']),
    );
  }
}

class BookingEvent {
  const BookingEvent({required this.toStatus, this.fromStatus, this.at, this.note, this.by});
  final String toStatus;
  final String? fromStatus;
  final DateTime? at;
  final String? note;
  final String? by;

  factory BookingEvent.fromJson(Json j) => BookingEvent(
    toStatus: strOr(j['to_status'] ?? j['status']),
    fromStatus: str(j['from_status']),
    at: _dt(j['at'] ?? j['created_at']),
    note: str(j['note']),
    by: str(j['by_party'] ?? j['by']),
  );
}

/// `Booking` (contract §4), as either party sees it (`booking_dict`).
class Booking {
  const Booking({
    required this.id,
    required this.code,
    required this.status,
    this.trade,
    this.serviceTitle,
    this.description = '',
    this.scheduledStart,
    this.estimatedMinutes,
    this.priceType = PriceType.fixed,
    this.quotedPrice,
    this.visitFee,
    this.quoteAmount,
    this.quoteStatus = 'none',
    this.finalPrice,
    this.bookingFee,
    this.bookingFeeStatus,
    this.arrivalCode,
    this.arrivalVerifiedAt,
    this.arrivalAttemptsLeft,
    this.paymentMethod,
    this.paidBySipaluAt,
    this.paidByGhardhaniAt,
    this.cancelledBy,
    this.cancelReason,
    this.lateCancellation = false,
    this.address,
    this.addressRevealed = false,
    this.contactVisible = false,
    this.sipalu,
    this.ghardhani,
    this.myRole,
    this.respondBy,
    this.freeCancelUntil,
    this.createdAt,
    this.completedAt,
    this.canRate,
    this.ratedByMe = false,
    this.source = 'direct',
    this.requestId,
    this.events = const [],
  });

  final String id;
  final String code;
  final String status;
  final Trade? trade;
  final String? serviceTitle;
  final String description;
  final DateTime? scheduledStart;
  final int? estimatedMinutes;
  final String priceType;

  /// Price agreed at booking (hourly: rate × estimated time; visit-then-quote:
  /// the visit fee).
  final String? quotedPrice;
  final String? visitFee;

  /// visit_then_quote: the Sipalu's price after the visit.
  final String? quoteAmount;

  /// none | proposed | approved | rejected
  final String quoteStatus;
  final String? finalPrice;
  final String? bookingFee;

  /// waived | pending | paid | refunded
  final String? bookingFeeStatus;

  /// Ghardhani side only, while accepted / on the way: the 4-digit code to
  /// read out on arrival.
  final String? arrivalCode;
  final DateTime? arrivalVerifiedAt;
  final int? arrivalAttemptsLeft;

  /// Direct payment to the Sipalu, as each side marked it.
  final String? paymentMethod;
  final DateTime? paidBySipaluAt;
  final DateTime? paidByGhardhaniAt;
  final String? cancelledBy;
  final String? cancelReason;
  final bool lateCancellation;

  /// The Ghardhani's address: full for the Ghardhani; ward/municipality for
  /// the Sipalu until accepted ([addressRevealed]).
  final BolauAddress? address;
  final bool addressRevealed;
  final bool contactVisible;
  final BookingParty? sipalu;
  final BookingParty? ghardhani;

  /// ghardhani | sipalu
  final String? myRole;

  /// When an unanswered request expires (`expires_at`).
  final DateTime? respondBy;
  final DateTime? freeCancelUntil;
  final DateTime? createdAt;
  final DateTime? completedAt;

  /// Server's `can_rate` when sent.
  final bool? canRate;
  final bool ratedByMe;

  /// direct | request
  final String source;
  final String? requestId;
  final List<BookingEvent> events;

  /// Ward / municipality line in [lang].
  String? area(String lang) {
    final a = address?.area(lang);
    return a == null || a.isEmpty ? null : a;
  }

  /// Exact address line, only once revealed.
  String? get addressLine {
    final line = address?.line ?? '';
    return addressRevealed && line.isNotEmpty ? line : null;
  }

  /// Marked paid by [myRole] (else by either side).
  bool get isPaid => switch (myRole) {
    'sipalu' => paidBySipaluAt != null,
    'ghardhani' => paidByGhardhaniAt != null,
    _ => paidBySipaluAt != null || paidByGhardhaniAt != null,
  };

  /// When the Sipalu marked the money received (earnings), else the
  /// Ghardhani's mark.
  DateTime? get paidAt => paidBySipaluAt ?? paidByGhardhaniAt;

  bool get isTerminal => BookingStatus.terminal.contains(status);
  bool get isVisitThenQuote => priceType == PriceType.visitThenQuote;

  /// visit_then_quote: the Sipalu has not quoted yet (or the quote was
  /// turned down).
  bool get needsQuote => isVisitThenQuote && (quoteStatus == 'none' || quoteStatus == 'rejected');

  /// visit_then_quote: quoted, waiting for the Ghardhani to approve.
  bool get awaitingQuoteApproval => isVisitThenQuote && quoteStatus == 'proposed';

  /// Whether this party may rate now.
  bool get rateOpen => canRate ?? (status == BookingStatus.confirmed && !ratedByMe);

  /// The amount that changes hands: final, else the approved quote, else the
  /// agreed price.
  String? get amount => finalPrice ?? (quoteStatus == 'approved' ? quoteAmount : null) ?? quotedPrice;

  /// Deadline for the Sipalu to answer: server value, else 30 min after the
  /// request (or 15 min before the start, whichever is first).
  DateTime? get answerBy => answerWithin(BolauConfig.fallback.acceptTimeoutMinutes);

  /// [answerBy] with the server's accept timeout (`/bolau/config`).
  DateTime? answerWithin(int timeoutMinutes) {
    if (respondBy != null) return respondBy;
    final c = createdAt;
    if (c == null) return null;
    var t = c.add(Duration(minutes: timeoutMinutes > 0 ? timeoutMinutes : 30));
    final s = scheduledStart;
    if (s != null) {
      final beforeStart = s.subtract(const Duration(minutes: 15));
      if (beforeStart.isBefore(t)) t = beforeStart;
    }
    return t;
  }

  factory Booking.fromJson(Json j) {
    final service = asJsonOrNull(j['service']);
    final address = asJsonOrNull(j['address'] ?? j['address_snapshot']);
    final pay = asJsonOrNull(j['payment_to_sipalu']) ?? const <String, dynamic>{};
    final myRating = j['my_rating'];
    return Booking(
      id: strOr(j['id']),
      code: strOr(j['code']),
      status: strOr(j['status'], BookingStatus.requested),
      trade: Trade.fromAny(j['trade']),
      serviceTitle: str(service?['title'] ?? j['service_title']),
      description: strOr(j['description']),
      scheduledStart: _dt(j['scheduled_start']),
      estimatedMinutes: intOf(j['estimated_minutes']),
      priceType: strOr(j['price_type'], PriceType.fixed),
      quotedPrice: str(j['quoted_price']),
      visitFee: str(j['visit_fee']),
      quoteAmount: str(j['quote_amount']),
      quoteStatus: strOr(j['quote_status'], 'none'),
      finalPrice: str(j['final_price']),
      bookingFee: str(j['booking_fee']),
      bookingFeeStatus: str(j['booking_fee_status']),
      arrivalCode: str(j['arrival_code']),
      arrivalVerifiedAt: _dt(j['arrival_verified_at']),
      arrivalAttemptsLeft: intOf(j['arrival_attempts_left']),
      paymentMethod: str(pay['method'] ?? j['payment_method_to_sipalu']),
      paidBySipaluAt: _dt(pay['sipalu_marked_at'] ?? j['paid_to_sipalu_at']),
      paidByGhardhaniAt: _dt(pay['ghardhani_marked_at']),
      cancelledBy: str(j['cancelled_by']),
      cancelReason: str(j['cancel_reason']),
      lateCancellation: boolOf(j['late_cancellation']),
      address: address == null ? null : BolauAddress.fromJson(address),
      addressRevealed: boolOf(j['address_revealed']),
      contactVisible: boolOf(j['contact_visible']),
      sipalu: BookingParty.fromAny(j['sipalu']),
      ghardhani: BookingParty.fromAny(j['ghardhani']),
      myRole: str(j['my_role']),
      respondBy: _dt(j['expires_at'] ?? j['respond_by']),
      freeCancelUntil: _dt(j['free_cancel_until']),
      createdAt: _dt(j['created_at']),
      completedAt: _dt(j['completed_at']),
      canRate: j['can_rate'] is bool ? j['can_rate'] as bool : null,
      ratedByMe: myRating is Map || boolOf(j['rated_by_me']),
      source: strOr(j['source'], 'direct'),
      requestId: str(j['request_id']),
      events: asJsonList(j['events']).map(BookingEvent.fromJson).toList(),
    );
  }
}

/// `GET /bolau/bookings/{id}/contact` → `{visible, phone, phone_masked,
/// visible_until}`.
class BookingContact {
  const BookingContact({this.visible = false, this.phone, this.phoneMasked, this.visibleUntil});
  final bool visible;
  final String? phone;
  final String? phoneMasked;
  final DateTime? visibleUntil;

  factory BookingContact.fromJson(Object? data) {
    final j = asJson(data);
    return BookingContact(
      visible: boolOf(j['visible'], j['phone'] != null),
      phone: str(j['phone']),
      phoneMasked: str(j['phone_masked']),
      visibleUntil: _dt(j['visible_until']),
    );
  }
}

/// `Offer` (contract §5).
class BolauOffer {
  const BolauOffer({
    required this.id,
    this.requestId,
    required this.priceType,
    this.price,
    this.visitFee,
    this.message = '',
    this.proposedStart,
    this.status = 'pending',
    this.sipalu,
    this.createdAt,
    this.requestTitle,
  });

  final String id;
  final String? requestId;
  final String priceType;
  final String? price;
  final String? visitFee;
  final String message;
  final DateTime? proposedStart;

  /// pending | accepted | rejected | withdrawn | expired
  final String status;
  final BookingParty? sipalu;
  final DateTime? createdAt;

  /// For "my offers": the request this answers.
  final String? requestTitle;

  factory BolauOffer.fromJson(Json j) {
    final req = j['request'];
    final reqMap = asJsonOrNull(req);
    return BolauOffer(
      id: strOr(j['id']),
      requestId: reqMap == null ? str(req ?? j['request_id']) : str(reqMap['id']),
      priceType: strOr(j['price_type'], PriceType.fixed),
      price: str(j['price']),
      visitFee: str(j['visit_fee']),
      message: strOr(j['message']),
      proposedStart: _dt(j['proposed_start']),
      status: strOr(j['status'], 'pending'),
      sipalu: BookingParty.fromAny(j['sipalu']),
      createdAt: _dt(j['created_at']),
      requestTitle: str(reqMap?['title'] ?? j['request_title']),
    );
  }

  Json toJson() => {
    'price_type': priceType,
    'price': priceType == PriceType.visitThenQuote ? '0' : price,
    if (priceType == PriceType.visitThenQuote) 'visit_fee': visitFee,
    'message': message.trim(),
    'proposed_start': proposedStart == null ? null : nepalIso(proposedStart!),
  };
}

/// Max offers on one Kaam request (contract §5).
const maxOffersPerRequest = 3;

/// `KaamRequest` (contract §5).
class KaamRequest {
  const KaamRequest({
    required this.id,
    required this.code,
    this.trade,
    required this.title,
    this.description = '',
    this.photos = const [],
    this.areaText,
    this.address,
    this.windowStart,
    this.windowEnd,
    this.budgetMax,
    this.status = 'open',
    this.expiresAt,
    this.offers = const [],
    this.offersCount,
    this.myOffer,
    this.bookingId,
  });

  final String id;
  final String code;
  final Trade? trade;
  final String title;
  final String description;
  final List<String> photos;

  /// Ward / municipality only (Sipalu view).
  final String? areaText;
  final BolauAddress? address;
  final DateTime? windowStart;
  final DateTime? windowEnd;
  final String? budgetMax;

  /// open | offers_received | booked | expired | cancelled
  final String status;
  final DateTime? expiresAt;
  final List<BolauOffer> offers;
  final int? offersCount;
  final BolauOffer? myOffer;
  final String? bookingId;

  String? area(String lang) {
    if (areaText != null && areaText!.isNotEmpty) return areaText;
    final a = address?.area(lang);
    return a == null || a.isEmpty ? null : a;
  }

  int get offerCount => offersCount ?? offers.length;
  bool get isFull => offerCount >= maxOffersPerRequest;
  bool get isOpen => status == 'open' || status == 'offers_received';

  factory KaamRequest.fromJson(Json j) {
    final address = asJsonOrNull(j['address']);
    final booking = j['booking'];
    return KaamRequest(
      id: strOr(j['id']),
      code: strOr(j['code']),
      trade: Trade.fromAny(j['trade']),
      title: strOr(j['title']),
      description: strOr(j['description']),
      photos:
          [
            for (final p in (j['photos'] is List ? j['photos'] as List : const <Object>[]))
              if (p is Map) strOr(p['url'] ?? p['thumb_url']) else '$p',
          ].where((s) => s.isNotEmpty).toList(),
      areaText: str(j['area']),
      address: address == null ? null : BolauAddress.fromJson(address),
      windowStart: _dt(j['preferred_window_start']),
      windowEnd: _dt(j['preferred_window_end']),
      budgetMax: str(j['budget_max']),
      status: strOr(j['status'], 'open'),
      expiresAt: _dt(j['expires_at']),
      offers: asJsonList(j['offers']).map(BolauOffer.fromJson).toList(),
      offersCount: intOf(j['offers_count']),
      myOffer: asJsonOrNull(j['my_offer']) == null ? null : BolauOffer.fromJson(asJson(j['my_offer'])),
      bookingId: booking is Map ? str(booking['id']) : str(booking ?? j['booking_id']),
    );
  }
}

/// `GET /bolau/trades` item.
class BolauTrade {
  const BolauTrade({required this.trade, this.sipaluCount, this.typicalPrice});
  final Trade trade;
  final int? sipaluCount;
  final String? typicalPrice;

  factory BolauTrade.fromJson(Json j) => BolauTrade(
    trade: Trade.fromAny(j['trade'] ?? j) ?? const Trade(code: '', nameEn: ''),
    sipaluCount: intOf(j['sipalu_count'] ?? j['count']),
    typicalPrice: str(
      j['typical_price'] ?? j['median_price'] ?? asJsonOrNull(asJsonOrNull(j['price'])?['fixed'])?['median'],
    ),
  );
}

/// `GET|PATCH /me/ghardhani`.
class GhardhaniProfile {
  const GhardhaniProfile({this.displayName = '', this.preferredLanguage});
  final String displayName;
  final String? preferredLanguage;

  factory GhardhaniProfile.fromJson(Object? data) {
    final j = asJson(data);
    return GhardhaniProfile(displayName: strOr(j['display_name']), preferredLanguage: str(j['preferred_language']));
  }
}

/// `GET /ref/minimum-wage` — only the hourly floor matters here.
class MinimumHourly {
  const MinimumHourly(this.amount);

  /// Fallback while the endpoint is unreachable (part-time rate, rule 3).
  static const fallback = MinimumHourly('107');
  final String amount;

  factory MinimumHourly.fromJson(Object? data) {
    final j = asJson(data);
    final v = str(j['hourly_part_time'] ?? j['hourly']);
    return v == null || (parsePaisa(v) ?? 0) <= 0 ? fallback : MinimumHourly(v);
  }
}

/// `GET /bolau/config` — public Bolau settings (404 while Bolau is off).
/// Every field falls back to the contract default.
class BolauConfig {
  const BolauConfig({
    this.bookingFee = defaultBookingFee,
    this.bookingFeeEnabled,
    this.freeCancelHours = 2,
    this.acceptTimeoutMinutes = 30,
    this.minHourlyRate,
    this.maxOffers = 3,
    this.emergencyLine = '100',
  });

  static const fallback = BolauConfig();

  final String bookingFee;

  /// Null when unknown (endpoint unreachable) → the `bolau_fee` flag decides.
  final bool? bookingFeeEnabled;
  final int freeCancelHours;
  final int acceptTimeoutMinutes;

  /// Null when unknown → `/ref/minimum-wage`, then Rs 107.
  final String? minHourlyRate;
  final int maxOffers;
  final String emergencyLine;

  factory BolauConfig.fromJson(Object? data) {
    final j = asJson(data);
    int pos(Object? v, int d) => (intOf(v) ?? 0) > 0 ? intOf(v)! : d;
    final fee = str(j['booking_fee']);
    final min = str(j['min_hourly_rate']);
    return BolauConfig(
      bookingFee: fee == null || (parsePaisa(fee) ?? -1) < 0 ? defaultBookingFee : fee,
      bookingFeeEnabled: j['booking_fee_enabled'] is bool ? j['booking_fee_enabled'] as bool : null,
      freeCancelHours: pos(j['free_cancel_hours'], 2),
      acceptTimeoutMinutes: pos(j['accept_timeout_minutes'], 30),
      minHourlyRate: min != null && (parsePaisa(min) ?? 0) > 0 ? min : null,
      maxOffers: pos(j['max_offers'], 3),
      emergencyLine: strOr(j['emergency_line'], '100').isEmpty ? '100' : strOr(j['emergency_line'], '100'),
    );
  }
}

/// `BOLAU_BOOKING_FEE` default (contract §6) — shown only while the
/// `bolau_fee` flag is on and the server did not send an amount.
const defaultBookingFee = '49';

/// An aware ISO timestamp in Nepal time for a wall-clock [t] in Nepal
/// (`2026-10-12T09:00:00+05:45`). The API stores aware datetimes.
String nepalIso(DateTime t) {
  String two(int n) => n.toString().padLeft(2, '0');
  if (t.isUtc) {
    final n = t.add(const Duration(hours: 5, minutes: 45));
    return '${isoDate(n)}T${two(n.hour)}:${two(n.minute)}:00+05:45';
  }
  return '${isoDate(t)}T${two(t.hour)}:${two(t.minute)}:00+05:45';
}
