/// JSON fixtures shaped like the Bolau backend payloads
/// (backend/apps/bolau/payloads.py, docs/CONTRACT-BOLAU.md).
library;

const _trade = {'code': 'electrician', 'name_en': 'Electrician', 'name_ne': 'बिजुली मिस्त्री'};
const _district = {'code': 'lalitpur', 'name_en': 'Lalitpur', 'name_ne': 'ललितपुर'};

Map<String, dynamic> completenessJson(int percent, {List<String> missing = const []}) => {
  'percent': percent,
  'missing': missing,
  'items': [
    {'key': 'name', 'done': true, 'optional': false, 'label': 'Name'},
    {'key': 'verified', 'done': percent == 100, 'optional': false, 'label': 'ID verified'},
  ],
};

final onboardingResponseJson = {
  'completed_steps': ['name', 'photo', 'skills'],
  'next_step': 'languages',
  'completeness': completenessJson(25, missing: ['languages', 'service_area']),
};

const serviceFixedJson = {
  'id': 's1',
  'trade': _trade,
  'title': 'Ceiling fan fitting',
  'title_ne': 'सिलिङ फ्यान जडान',
  'description': null,
  'price_type': 'fixed',
  'price_type_label': 'Fixed price',
  'price': '600.00',
  'visit_fee': null,
  'estimated_minutes': 60,
  'is_active': true,
  'order': 0,
};

const serviceHourlyJson = {
  'id': 's2',
  'trade': _trade,
  'title': 'House wiring',
  'title_ne': null,
  'description': null,
  'price_type': 'hourly',
  'price_type_label': 'By the hour',
  'price': '300.00',
  'visit_fee': null,
  'estimated_minutes': 120,
  'is_active': true,
  'order': 1,
};

const serviceVisitJson = {
  'id': 's3',
  'trade': _trade,
  'title': 'Fault finding',
  'title_ne': null,
  'description': null,
  'price_type': 'visit_then_quote',
  'price_type_label': 'Visit, then quote',
  'price': '0.00',
  'visit_fee': '200.00',
  'estimated_minutes': null,
  'is_active': true,
  'order': 2,
};

final mySipaluJson = {
  'id': 'sp1',
  'worker_id': 'w1',
  'handle': 'suman-electric',
  'handle_changed_at': null,
  'handle_change_available_at': null,
  'public_url': 'https://kaamsathi.com/sipalu/suman-electric',
  'name': 'Suman Tamang',
  'name_ne': 'सुमन तामाङ',
  'photo_url': null,
  'verification_status': 'verified',
  'headline': 'House wiring and fan fitting, 8 years',
  'headline_ne': '',
  'bio': '',
  'bio_ne': '',
  'bolau_enabled': true,
  'instant_booking': false,
  'service_districts': [_district],
  'service_municipality': null,
  'service_radius_km': 5,
  'base_lat': null,
  'base_lng': null,
  'gender_visible': false,
  'public_indexable': false,
  'public_consent': true,
  'years_total': 8,
  'trades': [
    {'code': 'electrician', 'name_en': 'Electrician', 'name_ne': 'बिजुली मिस्त्री', 'years': 8, 'nstb_level': 'level2'},
  ],
  'languages': [
    {'language': 'ne', 'proficiency': 'native'},
  ],
  'payment': {
    'method': 'esewa',
    'wallet_id': '9800000010',
    'bank_name': null,
    'bank_account_masked': null,
    'bank_account_name': null,
  },
  'stats': {'rating_avg': '4.80', 'rating_count': 12, 'jobs_completed': 15, 'response_time_minutes': 9},
  'suspended': null,
  'bookable': true,
  'bookable_problems': <String>[],
  'services': [serviceFixedJson, serviceHourlyJson, serviceVisitJson],
  'availability': [
    {'id': 'r1', 'weekday': 0, 'start_time': '09:00', 'end_time': '17:00'},
    {'id': 'r2', 'weekday': 1, 'start_time': '09:00', 'end_time': '17:00'},
  ],
  'time_off': [
    {
      'id': 't1',
      'from_date': '2030-10-20',
      'from_date_bs': '2087-07-03',
      'to_date': '2030-10-22',
      'to_date_bs': '2087-07-05',
      'note': 'Dashain',
    },
  ],
  'portfolio': <Object>[],
  'completed_steps': [
    'name',
    'photo',
    'skills',
    'languages',
    'service_area',
    'availability',
    'services',
    'headline',
    'payment',
    'identity',
    'consent',
  ],
  'next_step': null,
  'completeness': completenessJson(100),
};

/// A fresh, lazily created profile (nothing Bolau-specific yet).
final newSipaluJson = {
  ...mySipaluJson,
  'handle': 'ram-thapa',
  'verification_status': 'pending',
  'bolau_enabled': false,
  'bookable': false,
  'bookable_problems': ['verified', 'bolau_enabled', 'services', 'availability'],
  'services': <Object>[],
  'availability': <Object>[],
  'time_off': <Object>[],
  'trades': <Object>[],
  'completed_steps': ['name'],
  'next_step': 'photo',
  'completeness': completenessJson(8),
};

final publicSipaluJson = {
  'handle': 'suman-electric',
  'name': 'Suman Tamang',
  'name_ne': 'सुमन तामाङ',
  'photo_url': null,
  'headline': 'House wiring and fan fitting, 8 years',
  'headline_ne': null,
  'bio': 'I work around Lalitpur. Safe, tidy wiring.',
  'bio_ne': null,
  'trades': mySipaluJson['trades'],
  'languages': [
    {'language': 'ne', 'proficiency': 'native'},
    {'language': 'en', 'proficiency': 'basic'},
  ],
  'verification_level': 2,
  'verified_badges': ['identity'],
  'rating_avg': '4.80',
  'rating_count': 12,
  'jobs_completed': 15,
  'response_time_minutes': 9,
  'years_total': 8,
  'instant_booking': false,
  'services': [serviceFixedJson, serviceHourlyJson, serviceVisitJson],
  'from_price': '200.00',
  'service_districts': [_district],
  'availability_summary': {
    'weekly': [
      {
        'weekday': 0,
        'ranges': [
          ['09:00', '17:00'],
        ],
      },
      {
        'weekday': 1,
        'ranges': [
          ['09:00', '12:00'],
          ['14:00', '17:00'],
        ],
      },
    ],
    'next_available': '2030-10-13T09:00:00+05:45',
  },
  'portfolio': <Object>[],
  'reviews': [
    {
      'score': 5,
      'comment': 'Came on time and left the room clean.',
      'tags': ['on_time', 'clean_work'],
      'tag_labels': ['On time', 'Clean work'],
      'first_name': 'Sita',
      'month_bs': '2083-06',
    },
  ],
  'passport_url': null,
  'indexable': false,
  'public_url': 'https://kaamsathi.com/sipalu/suman-electric',
};

final searchJson = {
  'count': 2,
  'next': null,
  'previous': null,
  'results': [
    {
      'handle': 'suman-electric',
      'name': 'Suman Tamang',
      'name_ne': 'सुमन तामाङ',
      'photo_url': null,
      'headline': 'House wiring and fan fitting, 8 years',
      'headline_ne': null,
      'top_trade': _trade,
      'rating_avg': '4.80',
      'rating_count': 12,
      'jobs_completed': 15,
      'verification_level': 2,
      'from_price': '200.00',
      'next_available': '2030-10-13T09:00:00+05:45',
      'distance_band': null,
      'instant_booking': true,
      'score': 0.82,
    },
    {
      'handle': 'hari-bijuli',
      'name': 'Hari Shrestha',
      'name_ne': null,
      'photo_url': null,
      'headline': null,
      'headline_ne': null,
      'top_trade': _trade,
      'rating_avg': null,
      'rating_count': 0,
      'jobs_completed': 0,
      'verification_level': 1,
      'from_price': '500.00',
      'next_available': null,
      'distance_band': null,
      'instant_booking': false,
      'score': 0.4,
    },
  ],
};

const tradesJson = [
  {
    'code': 'electrician',
    'name_en': 'Electrician',
    'name_ne': 'बिजुली मिस्त्री',
    'category': 'construction',
    'sipalu_count': 6,
    'typical_services': ['Ceiling fan fitting'],
    'price': {
      'fixed': {'median': '600.00', 'min': '400.00', 'max': '900.00'},
      'hourly': null,
    },
    'k_anonymity': 5,
  },
  {
    'code': 'plumber',
    'name_en': 'Plumber',
    'name_ne': 'प्लम्बर',
    'category': 'construction',
    'sipalu_count': 2,
    'typical_services': <String>[],
    'price': {'fixed': null, 'hourly': null},
    'k_anonymity': 5,
  },
];

Map<String, dynamic> _booking({
  required String id,
  required String status,
  required String role,
  String priceType = 'fixed',
  Map<String, dynamic>? address,
  bool revealed = false,
  String quoteStatus = 'none',
  String? quoteAmount,
  Map<String, dynamic>? extra,
}) => {
  'id': id,
  'code': 'BK-7Q4M',
  'status': status,
  'status_label': status,
  'source': 'direct',
  'request_id': null,
  'trade': _trade,
  'service': {'id': 's1', 'title': 'Ceiling fan fitting', 'title_ne': null},
  'description': 'Two fans in the bedrooms.',
  'address': address ?? {'ward': 3, 'municipality': 'Lalitpur Metropolitan City', 'district': _district},
  'address_revealed': revealed,
  'scheduled_start': '2030-10-13T10:00:00+05:45',
  'scheduled_end': '2030-10-13T11:00:00+05:45',
  'estimated_minutes': 60,
  'price_type': priceType,
  'price_type_label': priceType,
  'quoted_price': priceType == 'visit_then_quote' ? '200.00' : '600.00',
  'visit_fee': priceType == 'visit_then_quote' ? '200.00' : null,
  'quote_amount': quoteAmount,
  'quote_status': quoteStatus,
  'final_price': null,
  'booking_fee': '0.00',
  'booking_fee_status': 'waived',
  'booking_fee_status_label': 'Waived',
  'cancelled_by': null,
  'cancel_reason': null,
  'late_cancellation': false,
  'expires_at': status == 'requested' ? '2030-10-13T09:00:00+05:45' : null,
  'accepted_at': null,
  'arrival_verified_at': null,
  'arrival_attempts_left': 5,
  'started_at': null,
  'completed_at': null,
  'confirmed_at': null,
  'free_cancel_until': '2030-10-13T08:00:00+05:45',
  'payment_to_sipalu': {
    'method': null,
    'ghardhani_marked_at': null,
    'ghardhani_method': null,
    'sipalu_marked_at': null,
    'sipalu_method': null,
    'agreed': false,
  },
  'contact_visible': revealed,
  'contact_visible_until': null,
  'sipalu': {
    'worker_id': 'w1',
    'handle': 'suman-electric',
    'name': 'Suman Tamang',
    'photo_url': null,
    'phone_masked': '98XXXXX010',
    'phone': null,
    'rating_avg': '4.80',
  },
  'ghardhani': {
    'user_id': 'u20',
    'name': 'Sita',
    'phone_masked': '98XXXXX020',
    'phone': null,
    'rating': {'avg': null, 'count': 0},
  },
  'my_role': role,
  'safety': {'emergency_line': '100', 'en': 'In danger? Call 100.', 'ne': 'खतरामा? १०० मा फोन।'},
  'my_rating': null,
  'can_rate': false,
  'created_at': '2030-10-12T08:30:00+05:45',
  'events': [
    {
      'from_status': null,
      'to_status': 'requested',
      'to_status_label': 'Requested',
      'by_party': 'ghardhani',
      'note': null,
      'at': '2030-10-12T08:30:00+05:45',
    },
  ],
  ...?extra,
};

/// Sipalu view of a new request: ward/municipality only.
final bookingRequestedSipaluJson = _booking(id: 'b1', status: 'requested', role: 'sipalu');

/// Sipalu view after acceptance: exact address revealed.
final bookingAcceptedSipaluJson = _booking(
  id: 'b2',
  status: 'accepted',
  role: 'sipalu',
  revealed: true,
  address: {
    'label': 'home',
    'line': 'House 12, Jhamsikhel Marg',
    'ward': 3,
    'municipality': 'Lalitpur Metropolitan City',
    'district': _district,
    'landmark': 'Opposite the blue gate school',
    'lat': null,
    'lng': null,
  },
);

/// Ghardhani view: accepted, with the arrival code.
final bookingAcceptedGhardhaniJson = _booking(
  id: 'b3',
  status: 'accepted',
  role: 'ghardhani',
  revealed: true,
  address: {
    'label': 'home',
    'line': 'House 12, Jhamsikhel Marg',
    'ward': 3,
    'municipality': 'Lalitpur Metropolitan City',
    'district': _district,
    'landmark': null,
    'lat': null,
    'lng': null,
  },
  extra: {'arrival_code': '4821'},
);

/// Ghardhani view: Sipalu quoted after the visit.
final bookingQuoteGhardhaniJson = _booking(
  id: 'b4',
  status: 'arrived',
  role: 'ghardhani',
  priceType: 'visit_then_quote',
  revealed: true,
  quoteStatus: 'proposed',
  quoteAmount: '1500.00',
);

/// Confirmed, paid by the Sipalu's mark, open to rate.
final bookingConfirmedSipaluJson = _booking(
  id: 'b5',
  status: 'confirmed',
  role: 'sipalu',
  revealed: true,
  extra: {
    'final_price': '600.00',
    'payment_to_sipalu': {
      'method': 'esewa',
      'ghardhani_marked_at': '2030-10-13T11:05:00+05:45',
      'ghardhani_method': 'esewa',
      'sipalu_marked_at': '2030-10-13T11:10:00+05:45',
      'sipalu_method': 'esewa',
      'agreed': true,
    },
    'can_rate': true,
  },
);

Map<String, dynamic> page(List<Map<String, dynamic>> rows) => {
  'count': rows.length,
  'next': null,
  'previous': null,
  'results': rows,
};

Map<String, dynamic> _offer(String id, String name, String price, {String type = 'fixed', String status = 'pending'}) =>
    {
      'id': id,
      'request_id': 'kr1',
      'status': status,
      'status_label': status,
      'price_type': type,
      'price_type_label': type,
      'price': price,
      'visit_fee': type == 'visit_then_quote' ? '200.00' : null,
      'estimated_minutes': 60,
      'message': 'I have fixed this kind of leak many times.',
      'proposed_start': '2030-10-13T10:00:00+05:45',
      'created_at': '2030-10-12T09:00:00+05:45',
      'sipalu': {
        'handle': 'sipalu-$id',
        'name': name,
        'photo_url': null,
        'rating_avg': '4.50',
        'rating_count': 4,
        'jobs_completed': 6,
        'verification_level': 1,
        'instant_booking': false,
      },
    };

/// The Ghardhani's request with offers. The fourth offer must never be
/// shown (max 3 per request).
final kaamRequestGharJson = {
  'id': 'kr1',
  'code': 'KR-5H2D',
  'trade': {'code': 'plumber', 'name_en': 'Plumber', 'name_ne': 'प्लम्बर'},
  'title': 'Bathroom tap leaking',
  'description': 'Leaks all night. Need it fixed today.',
  'address': {
    'id': 'a1',
    'label': 'home',
    'label_label': 'Home',
    'line': 'House 12, Jhamsikhel Marg',
    'ward': 3,
    'municipality': 'Lalitpur Metropolitan City',
    'district': _district,
    'landmark': null,
    'lat': null,
    'lng': null,
    'is_default': true,
  },
  'preferred_window_start': '2030-10-13T09:00:00+05:45',
  'preferred_window_end': '2030-10-13T17:00:00+05:45',
  'budget_max': '1500.00',
  'status': 'offers_received',
  'status_label': 'Offers received',
  'expires_at': '2030-10-14T08:00:00+05:45',
  'created_at': '2030-10-13T08:00:00+05:45',
  'photos': <String>[],
  'offers_count': 3,
  'offers_left': 0,
  'offers': [
    _offer('o1', 'Bikash Rai', '800.00'),
    _offer('o2', 'Dipak Gurung', '650.00'),
    _offer('o3', 'Anil Magar', '0.00', type: 'visit_then_quote'),
    _offer('o4', 'Too Many', '100.00'),
  ],
  'booking_id': null,
};

/// Sipalu's view of a nearby request (coarse address).
final nearbyRequestJson = {
  ...kaamRequestGharJson,
  'id': 'kr2',
  'status': 'open',
  'address': {'ward': 3, 'municipality': 'Lalitpur Metropolitan City', 'district': _district},
  'offers_count': 1,
  'offers_left': 2,
  'my_offer': null,
}..remove('offers');

final myOffersJson = page([
  {..._offer('o9', 'Suman Tamang', '700.00'), 'request_code': 'KR-5H2D', 'request_title': 'Bathroom tap leaking'}
    ..remove('sipalu'),
]);

final addressesJson = [
  {
    'id': 'a1',
    'label': 'home',
    'label_label': 'Home',
    'line': 'House 12, Jhamsikhel Marg',
    'ward': 3,
    'municipality': 'Lalitpur Metropolitan City',
    'district': _district,
    'landmark': null,
    'lat': null,
    'lng': null,
    'is_default': true,
  },
];

const ghardhaniJson = {
  'id': 'g1',
  'display_name': 'Sita Sharma',
  'preferred_language': 'en',
  'phone': '9800000020',
  'rating': {'avg': null, 'count': 0},
};

/// A Bolau notification as the server sends it (`bolau_<event>`).
Map<String, dynamic> bolauNotificationJson(String event, {String? link, Map<String, dynamic>? data}) => {
  'id': 'n-$event',
  'kind': 'bolau_$event',
  'title': event,
  'body': '',
  'data': data ?? {'booking_id': 'b1', 'code': 'BK-7Q4M'},
  'link': link,
  'read_at': null,
  'created_at': '2030-10-12T08:30:00+05:45',
};
