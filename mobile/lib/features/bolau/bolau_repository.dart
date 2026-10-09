import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_exception.dart';
import '../../core/api/json.dart';
import '../../core/auth/session.dart';
import '../../core/flags.dart';
import '../../core/providers.dart';
import '../worker/trust/trust_data.dart' show Dispute;
import 'bolau_models.dart';

/// Every Bolau endpoint (docs/CONTRACT-BOLAU.md) in one place.
abstract final class BolauPaths {
  // Sipalu (authenticated user with a Worker)
  static const mySipalu = '/me/sipalu';
  static const onboardingStep = '/me/sipalu/onboarding-step';
  static const services = '/me/sipalu/services';
  static String service(String id) => '$services/$id';
  static const availability = '/me/sipalu/availability';
  static const timeOff = '/me/sipalu/time-off';
  static String timeOffItem(String id) => '$timeOff/$id';
  static const handle = '/me/sipalu/handle';
  static const portfolio = '/me/sipalu/portfolio';
  static String portfolioItem(String id) => '$portfolio/$id';
  static const myJobs = '/me/bolau/jobs';

  /// Sipalu transitions: accept, decline, on-the-way, arrive, start,
  /// complete, quote, cancel.
  static String sipaluAction(String bookingId, String action) => '/me/bolau/bookings/$bookingId/$action';
  static const nearbyRequests = '/me/bolau/requests/nearby';
  static String sipaluRequest(String id) => '/me/bolau/requests/$id';
  static String sendOffer(String requestId) => '/me/bolau/requests/$requestId/offers';
  static const myOffers = '/me/bolau/offers';
  static String withdrawOffer(String offerId) => '/me/bolau/offers/$offerId/withdraw';

  // Ghardhani (any user)
  static const myGhardhani = '/me/ghardhani';
  static const addresses = '/me/addresses';
  static String address(String id) => '$addresses/$id';
  static const favourites = '/me/favourites';
  static String favourite(String handle) => '$favourites/$handle';
  static const search = '/bolau/search';
  static const trades = '/bolau/trades';
  static String publicSipalu(String handle) => '/public/sipalu/$handle';
  static const bookings = '/bolau/bookings';
  static String booking(String id) => '$bookings/$id';

  /// Ghardhani / either-party actions: cancel, confirm, approve-quote,
  /// reject-quote, report-no-show, paid, rate, dispute, safety-report,
  /// report.
  static String bookingAction(String id, String action) => '$bookings/$id/$action';
  static String contact(String id) => '$bookings/$id/contact';

  /// `GET` = the booking's latest dispute (either party; 404 when none),
  /// `POST` = raise one.
  static String bookingDispute(String id) => '$bookings/$id/dispute';
  static const myBookings = '/me/bolau/bookings';
  static const requests = '/bolau/requests';
  static String request(String id) => '$requests/$id';
  static String cancelRequest(String id) => '$requests/$id/cancel';
  static String acceptOffer(String requestId, String offerId) => '$requests/$requestId/offers/$offerId/accept';
  static const myRequests = '/me/bolau/requests';
  static String payFee(String id) => '$bookings/$id/fee/pay';
  static String receipt(String id) => '$bookings/$id/receipt.pdf';
  static const config = '/bolau/config';

  static const minimumWage = '/ref/minimum-wage';
}

class BolauRepository {
  BolauRepository(this._api);
  final ApiClient _api;

  // ---- Sipalu -------------------------------------------------------------

  Future<MySipalu> mySipalu() async => MySipalu.fromJson(await _api.get<dynamic>(BolauPaths.mySipalu));

  Future<MySipalu> updateSipalu(Json patch) async =>
      MySipalu.fromJson(await _api.patch<dynamic>(BolauPaths.mySipalu, data: patch));

  /// `{step, data}` as JSON, or multipart when [files] are attached (photo,
  /// ID images): `step`, the data fields flattened, then the files.
  Future<OnboardingState> onboardingStep(String step, Json data, {Map<String, String> files = const {}}) async {
    final Object body;
    if (files.isEmpty) {
      body = {'step': step, 'data': data};
    } else {
      body = FormData.fromMap({
        'step': step,
        for (final e in data.entries)
          if (e.value != null) e.key: e.value is List || e.value is Map ? jsonEncode(e.value) : '${e.value}',
        for (final f in files.entries) f.key: await MultipartFile.fromFile(f.value),
      });
    }
    return OnboardingState.fromJson(await _api.post<dynamic>(BolauPaths.onboardingStep, data: body));
  }

  Future<List<PortfolioItem>> portfolio() async =>
      resultsOf(await _api.get<dynamic>(BolauPaths.portfolio)).map(PortfolioItem.fromJson).toList();

  /// Multipart `image` + `caption`, `caption_ne`, `trade` (all optional
  /// except the image).
  Future<PortfolioItem> addPortfolio(String imagePath, {String? caption, String? captionNe, String? trade}) async {
    final form = FormData.fromMap({
      'image': await MultipartFile.fromFile(imagePath),
      ...portfolioFields(caption: caption, captionNe: captionNe, trade: trade),
    });
    return PortfolioItem.fromJson(asJson(await _api.post<dynamic>(BolauPaths.portfolio, data: form)));
  }

  Future<PortfolioItem> updatePortfolio(String id, {String? caption, String? captionNe, String? trade}) async =>
      PortfolioItem.fromJson(
        asJson(
          await _api.patch<dynamic>(
            BolauPaths.portfolioItem(id),
            data: {
              'caption': caption?.trim() ?? '',
              'caption_ne': captionNe?.trim() ?? '',
              'trade': (trade?.isEmpty ?? true) ? null : trade,
            },
          ),
        ),
      );

  Future<void> deletePortfolio(String id) => _api.delete(BolauPaths.portfolioItem(id));

  Future<List<SipaluService>> services() async =>
      resultsOf(await _api.get<dynamic>(BolauPaths.services)).map(SipaluService.fromJson).toList();

  Future<SipaluService> saveService(SipaluService s) async {
    final data =
        s.id.isEmpty
            ? await _api.post<dynamic>(BolauPaths.services, data: s.toJson())
            : await _api.patch<dynamic>(BolauPaths.service(s.id), data: s.toJson());
    return SipaluService.fromJson(asJson(data));
  }

  Future<void> deleteService(String id) => _api.delete(BolauPaths.service(id));

  Future<void> putAvailability(List<AvailabilityRule> rules) => _api.put<dynamic>(
    BolauPaths.availability,
    data: {
      'rules': [for (final r in rules) r.toJson()],
    },
  );

  Future<TimeOff> addTimeOff(TimeOff t) async =>
      TimeOff.fromJson(asJson(await _api.post<dynamic>(BolauPaths.timeOff, data: t.toJson())));

  Future<void> deleteTimeOff(String id) => _api.delete(BolauPaths.timeOffItem(id));

  Future<void> setHandle(String handle) => _api.postNoContent(BolauPaths.handle, data: {'handle': handle});

  Future<List<Booking>> myJobs({String? status}) async {
    final data = await _api.get<dynamic>(BolauPaths.myJobs, query: {'status': status, 'page_size': 100});
    return resultsOf(data).map(Booking.fromJson).toList();
  }

  Future<Booking> sipaluAction(String id, String action, [Json body = const {}]) async =>
      Booking.fromJson(asJson(await _api.post<dynamic>(BolauPaths.sipaluAction(id, action), data: body)));

  Future<List<KaamRequest>> nearbyRequests({String? trade}) async {
    final data = await _api.get<dynamic>(BolauPaths.nearbyRequests, query: {'trade': trade, 'page_size': 50});
    return resultsOf(data).map(KaamRequest.fromJson).toList();
  }

  /// A request as a Sipalu may see it (ward/municipality only).
  Future<KaamRequest> sipaluRequest(String id) async =>
      KaamRequest.fromJson(asJson(await _api.get<dynamic>(BolauPaths.sipaluRequest(id))));

  Future<BolauOffer> sendOffer(String requestId, BolauOffer offer) async =>
      BolauOffer.fromJson(asJson(await _api.post<dynamic>(BolauPaths.sendOffer(requestId), data: offer.toJson())));

  Future<List<BolauOffer>> myOffers() async =>
      resultsOf(
        await _api.get<dynamic>(BolauPaths.myOffers, query: {'page_size': 50}),
      ).map(BolauOffer.fromJson).toList();

  Future<void> withdrawOffer(String offerId) => _api.postNoContent(BolauPaths.withdrawOffer(offerId));

  // ---- Ghardhani ----------------------------------------------------------

  Future<GhardhaniProfile> myGhardhani() async =>
      GhardhaniProfile.fromJson(await _api.get<dynamic>(BolauPaths.myGhardhani));

  Future<List<BolauAddress>> addresses() async =>
      resultsOf(await _api.get<dynamic>(BolauPaths.addresses)).map(BolauAddress.fromJson).toList();

  Future<BolauAddress> saveAddress(BolauAddress a) async {
    final data =
        a.id.isEmpty
            ? await _api.post<dynamic>(BolauPaths.addresses, data: a.toJson())
            : await _api.patch<dynamic>(BolauPaths.address(a.id), data: a.toJson());
    return BolauAddress.fromJson(asJson(data));
  }

  Future<void> deleteAddress(String id) => _api.delete(BolauPaths.address(id));

  /// Favourite Sipalu handles.
  Future<List<SipaluCard>> favourites() async {
    final data = await _api.get<dynamic>(BolauPaths.favourites);
    return [
      for (final x in (data is List ? data : (asJson(data)['results'] as List?) ?? const []))
        if (x is Map) SipaluCard.fromJson(asJson(x['sipalu'] ?? x)) else SipaluCard(handle: '$x', name: '$x'),
    ];
  }

  Future<void> addFavourite(String handle) => _api.postNoContent(BolauPaths.favourites, data: {'handle': handle});

  Future<void> removeFavourite(String handle) => _api.delete(BolauPaths.favourite(handle));

  Future<List<SipaluCard>> search(BolauSearch q) async {
    final data = await _api.get<dynamic>(BolauPaths.search, query: q.toQuery());
    return resultsOf(data).map(SipaluCard.fromJson).toList();
  }

  Future<List<BolauTrade>> trades() async =>
      resultsOf(await _api.get<dynamic>(BolauPaths.trades)).map(BolauTrade.fromJson).toList();

  Future<PublicSipalu> publicSipalu(String handle) async =>
      PublicSipalu.fromJson(asJson(await _api.get<dynamic>(BolauPaths.publicSipalu(handle))));

  /// `POST /bolau/bookings` with an `Idempotency-Key` (also echoed in the
  /// body as `idempotency`) so a retry on a bad connection never books
  /// twice.
  Future<Booking> createBooking(Json body, {required String idempotencyKey}) async {
    final data = await _api.post<dynamic>(
      BolauPaths.bookings,
      data: {...body, 'idempotency': idempotencyKey},
      options: Options(headers: {'Idempotency-Key': idempotencyKey}),
    );
    return Booking.fromJson(asJson(data));
  }

  Future<Booking> booking(String id) async => Booking.fromJson(asJson(await _api.get<dynamic>(BolauPaths.booking(id))));

  Future<Booking> bookingAction(String id, String action, [Json body = const {}]) async =>
      Booking.fromJson(asJson(await _api.post<dynamic>(BolauPaths.bookingAction(id, action), data: body)));

  Future<void> rate(String id, {required int score, String? comment, List<String> tags = const []}) =>
      _api.postNoContent(
        BolauPaths.bookingAction(id, 'rate'),
        data: {
          'score': score,
          if (comment != null && comment.trim().isNotEmpty) 'comment': comment.trim(),
          'tags': tags,
        },
      );

  /// Confidential safety report about a booking (support `safety` case).
  /// Returns the case id when sent.
  Future<String?> safetyReport(String id, Json body) async {
    final data = asJson(await _api.post<dynamic>(BolauPaths.bookingAction(id, 'safety-report'), data: body));
    return str(data['case_id']);
  }

  /// Raises a booking dispute (`{description}`); returns the trust dispute.
  Future<Dispute> raiseDispute(String id, String description) async => Dispute.fromJson(
    asJson(await _api.post<dynamic>(BolauPaths.bookingDispute(id), data: {'description': description.trim()})),
  );

  /// The booking's latest dispute, or null when it has none (404).
  Future<Dispute?> bookingDispute(String id) async {
    try {
      return Dispute.fromJson(asJson(await _api.get<dynamic>(BolauPaths.bookingDispute(id))));
    } on ApiException catch (e) {
      if (e.statusCode == 404 && !e.isNetwork) return null;
      rethrow;
    }
  }

  /// Starts an online payment of the booking fee → `{redirect_url, reference}`.
  /// Throws `provider_not_configured` until a merchant agreement exists.
  Future<Json> payFee(String id, String provider) async =>
      asJson(await _api.post<dynamic>(BolauPaths.payFee(id), data: {'provider': provider}));

  Future<BolauConfig> config() async => BolauConfig.fromJson(await _api.get<dynamic>(BolauPaths.config));

  Future<BookingContact> contact(String id) async =>
      BookingContact.fromJson(await _api.get<dynamic>(BolauPaths.contact(id)));

  Future<List<Booking>> myBookings({String? status}) async {
    final data = await _api.get<dynamic>(BolauPaths.myBookings, query: {'status': status, 'page_size': 100});
    return resultsOf(data).map(Booking.fromJson).toList();
  }

  /// Multipart: fields plus up to four `photos`.
  Future<KaamRequest> postRequest(Json fields, List<String> photoPaths, {required String idempotencyKey}) async {
    final form = FormData.fromMap({
      for (final e in fields.entries)
        if (e.value != null) e.key: '${e.value}',
      'idempotency': idempotencyKey,
    });
    for (final p in photoPaths.take(4)) {
      form.files.add(MapEntry('photos', await MultipartFile.fromFile(p)));
    }
    final data = await _api.post<dynamic>(
      BolauPaths.requests,
      data: form,
      options: Options(headers: {'Idempotency-Key': idempotencyKey}),
    );
    return KaamRequest.fromJson(asJson(data));
  }

  Future<List<KaamRequest>> myRequests() async =>
      resultsOf(
        await _api.get<dynamic>(BolauPaths.myRequests, query: {'page_size': 50}),
      ).map(KaamRequest.fromJson).toList();

  Future<KaamRequest> request(String id) async =>
      KaamRequest.fromJson(asJson(await _api.get<dynamic>(BolauPaths.request(id))));

  Future<Booking?> acceptOffer(String requestId, String offerId) async {
    final data = asJson(await _api.post<dynamic>(BolauPaths.acceptOffer(requestId, offerId)));
    final b = asJsonOrNull(data['booking']) ?? (data['status'] != null && data['code'] != null ? data : null);
    return b == null ? null : Booking.fromJson(b);
  }

  Future<void> cancelRequest(String id) => _api.postNoContent(BolauPaths.cancelRequest(id));

  Future<MinimumHourly> minimumHourly() async =>
      MinimumHourly.fromJson(await _api.get<dynamic>(BolauPaths.minimumWage));
}

/// Text fields of a portfolio upload (blank ones left out).
Map<String, String> portfolioFields({String? caption, String? captionNe, String? trade}) => {
  if (caption != null && caption.trim().isNotEmpty) 'caption': caption.trim(),
  if (captionNe != null && captionNe.trim().isNotEmpty) 'caption_ne': captionNe.trim(),
  if (trade != null && trade.isNotEmpty) 'trade': trade,
};

/// Search filters (`GET /bolau/search`).
class BolauSearch {
  const BolauSearch({this.trade, this.district, this.q, this.instant = false, this.minRating});
  final String? trade;
  final String? district;
  final String? q;
  final bool instant;
  final int? minRating;

  BolauSearch copyWith({
    String? trade,
    String? district,
    String? q,
    bool? instant,
    int? minRating,
    bool clearRating = false,
  }) => BolauSearch(
    trade: trade ?? this.trade,
    district: district ?? this.district,
    q: q ?? this.q,
    instant: instant ?? this.instant,
    minRating: clearRating ? null : (minRating ?? this.minRating),
  );

  Map<String, dynamic> toQuery() => {
    'trade': trade,
    'district': district,
    'q': q,
    if (instant) 'instant': 1,
    'min_rating': minRating,
  };

  @override
  bool operator ==(Object other) =>
      other is BolauSearch &&
      other.trade == trade &&
      other.district == district &&
      other.q == q &&
      other.instant == instant &&
      other.minRating == minRating;

  @override
  int get hashCode => Object.hash(trade, district, q, instant, minRating);
}

String newIdempotencyKey() => const Uuid().v4();

final bolauRepositoryProvider = Provider<BolauRepository>((ref) => BolauRepository(ref.watch(apiClientProvider)));

/// Bolau is a separate module behind the client flag `bolau`, **off unless
/// the server explicitly switches it on** (the B2B pilot must not see it).
final bolauEnabledProvider = Provider<bool>((ref) => ref.watch(flagsProvider)[FlagKeys.bolau] == true);

String? _uid(Ref ref) => ref.watch(sessionProvider.select((s) => s.me?.id));

final mySipaluProvider = FutureProvider.autoDispose<MySipalu>((ref) {
  _uid(ref);
  return ref.watch(bolauRepositoryProvider).mySipalu();
});

/// `GET /bolau/config`, else the contract defaults (Bolau off → 404).
final bolauConfigProvider = FutureProvider<BolauConfig>((ref) async {
  try {
    return await ref.watch(bolauRepositoryProvider).config();
  } catch (_) {
    return BolauConfig.fallback;
  }
});

/// The config while loading/failed → defaults (never blocks a screen).
final bolauConfigValueProvider = Provider<BolauConfig>(
  (ref) => ref.watch(bolauConfigProvider).value ?? BolauConfig.fallback,
);

/// Whether the Ghardhani booking fee is on: `/bolau/config`, else the
/// `bolau_fee` client flag.
final bookingFeeEnabledProvider = Provider<bool>(
  (ref) => ref.watch(bolauConfigValueProvider).bookingFeeEnabled ?? ref.watch(flagsProvider)[FlagKeys.bolauFee] == true,
);

/// Minimum hourly rate: `/bolau/config` `min_hourly_rate`, then
/// `/ref/minimum-wage`, then Rs 107.
final minimumHourlyProvider = FutureProvider<MinimumHourly>((ref) async {
  final cfg = await ref.watch(bolauConfigProvider.future);
  return resolveMinimumHourly(cfg, () => ref.read(bolauRepositoryProvider).minimumHourly());
});

Future<MinimumHourly> resolveMinimumHourly(BolauConfig cfg, Future<MinimumHourly> Function() minimumWage) async {
  final fromConfig = cfg.minHourlyRate;
  if (fromConfig != null) return MinimumHourly(fromConfig);
  try {
    return await minimumWage();
  } catch (_) {
    return MinimumHourly.fallback;
  }
}

final portfolioProvider = FutureProvider.autoDispose<List<PortfolioItem>>((ref) {
  _uid(ref);
  return ref.watch(bolauRepositoryProvider).portfolio();
});

final sipaluJobsProvider = FutureProvider.autoDispose<List<Booking>>((ref) {
  _uid(ref);
  return ref.watch(bolauRepositoryProvider).myJobs();
});

final nearbyRequestsProvider = FutureProvider.autoDispose<List<KaamRequest>>((ref) {
  _uid(ref);
  return ref.watch(bolauRepositoryProvider).nearbyRequests();
});

final myOffersProvider = FutureProvider.autoDispose<List<BolauOffer>>((ref) {
  _uid(ref);
  return ref.watch(bolauRepositoryProvider).myOffers();
});

final bookingProvider = FutureProvider.autoDispose.family<Booking, String>((ref, id) {
  return ref.watch(bolauRepositoryProvider).booking(id);
});

/// The dispute on a booking (null = none), for the booking's Dispute section.
final disputeOfBookingProvider = FutureProvider.autoDispose.family<Dispute?, String>((ref, bookingId) {
  _uid(ref);
  return ref.watch(bolauRepositoryProvider).bookingDispute(bookingId);
});

final bolauTradesProvider = FutureProvider.autoDispose<List<BolauTrade>>((ref) {
  return ref.watch(bolauRepositoryProvider).trades();
});

final bolauSearchProvider = FutureProvider.autoDispose.family<List<SipaluCard>, BolauSearch>((ref, q) {
  return ref.watch(bolauRepositoryProvider).search(q);
});

final publicSipaluProvider = FutureProvider.autoDispose.family<PublicSipalu, String>((ref, handle) {
  return ref.watch(bolauRepositoryProvider).publicSipalu(handle);
});

final ghardhaniBookingsProvider = FutureProvider.autoDispose<List<Booking>>((ref) {
  _uid(ref);
  return ref.watch(bolauRepositoryProvider).myBookings();
});

final myRequestsProvider = FutureProvider.autoDispose<List<KaamRequest>>((ref) {
  _uid(ref);
  return ref.watch(bolauRepositoryProvider).myRequests();
});

final kaamRequestProvider = FutureProvider.autoDispose.family<KaamRequest, String>((ref, id) {
  return ref.watch(bolauRepositoryProvider).request(id);
});

/// A nearby request seen by the Sipalu.
final sipaluRequestProvider = FutureProvider.autoDispose.family<KaamRequest, String>((ref, id) {
  return ref.watch(bolauRepositoryProvider).sipaluRequest(id);
});

final addressesProvider = FutureProvider.autoDispose<List<BolauAddress>>((ref) {
  _uid(ref);
  return ref.watch(bolauRepositoryProvider).addresses();
});

final favouritesProvider = FutureProvider.autoDispose<List<SipaluCard>>((ref) {
  _uid(ref);
  return ref.watch(bolauRepositoryProvider).favourites();
});

final ghardhaniProfileProvider = FutureProvider.autoDispose<GhardhaniProfile>((ref) {
  _uid(ref);
  return ref.watch(bolauRepositoryProvider).myGhardhani();
});
