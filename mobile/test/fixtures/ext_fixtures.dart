/// JSON fixtures shaped like docs/CONTRACT-EXTENSIONS.md responses (and the
/// backend serializers that implement them).
library;

const notificationsJson = {
  'count': 2,
  'next': null,
  'previous': null,
  'results': [
    {
      'id': 'n1',
      'kind': 'application_shortlisted',
      'title': 'Shortlisted for Cook at Hotel Annapurna',
      'title_ne': 'होटल अन्नपूर्णमा कुकका लागि छनोट भयो',
      'body': 'Confirm interest in the KaamSathi app.',
      'body_ne': 'कामसाथी एपमा रुचि पुष्टि गर्नुहोस्।',
      'data': {'application_id': 'a1', 'job_id': 'j1'},
      'link': '/me/applications',
      'read_at': null,
      'created_at': '2026-10-06T10:15:00+05:45',
    },
    {
      'id': 'n2',
      'kind': 'support_reply',
      'title': 'Reply on KS-000012',
      'title_ne': null,
      'body': 'Our team replied.',
      'body_ne': null,
      'data': {'case_id': 'c1', 'number': 'KS-000012'},
      'link': null,
      'read_at': '2026-10-05T09:00:00+05:45',
      'created_at': '2026-10-05T08:00:00+05:45',
    },
  ],
};

const sessionsJson = [
  {
    'id': 's-other',
    'user_agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/128.0',
    'ip': '27.34.10.2',
    'platform': 'web',
    'created_at': '2026-10-01T09:00:00+05:45',
    'last_seen_at': '2026-10-03T09:00:00+05:45',
    'current': false,
  },
  {
    'id': 's-me',
    'user_agent': 'Dart/3.7 (dart:io)',
    'ip': '110.44.1.1',
    'platform': 'android',
    'created_at': '2026-10-06T09:00:00+05:45',
    'last_seen_at': '2026-10-07T09:00:00+05:45',
    'current': true,
  },
];

const workHistoryJson = {
  'count': 2,
  'results': [
    {
      'id': 'wh1',
      'employer_name': 'Everest Construction',
      'employer_org': null,
      'trade': {'code': 'mason', 'name_en': 'Mason', 'name_ne': 'डकर्मी'},
      'role_title': 'Head mason',
      'district': {'code': 'KTM', 'name_en': 'Kathmandu', 'name_ne': 'काठमाडौं', 'province': 3},
      'start_date': '2022-01-10',
      'start_date_bs': '2078-09-26',
      'end_date': '2024-03-31',
      'end_date_bs': '2080-12-18',
      'months': 26,
      'description': 'Brick work for apartments',
      'reference_name': 'Hari Shrestha',
      'reference_phone': '9841000000',
      'document_url': null,
      'status': 'verified',
      'status_label': 'Verified',
      'verification_method': 'reference_call',
      'editable': false,
      'note': null,
    },
    {
      'id': 'wh2',
      'employer_name': 'Lakeside Hotel',
      'employer_org': {'id': 'o9', 'name': 'Lakeside Hotel'},
      'trade': 'cook',
      'role_title': 'Cook',
      'district': 'KAS',
      'start_date': '2024-05-01',
      'end_date': null,
      'reference_name': 'Sita Gurung',
      'reference_phone': '9856000000',
      'status': 'reference_pending',
      'status_label': 'Checking with reference',
      'editable': true,
    },
  ],
};

const recommendedJobsJson = {
  'count': 1,
  'results': [
    {
      'id': 'j1',
      'title': 'Mason for apartment block',
      'trade': {'code': 'mason', 'name_en': 'Mason', 'name_ne': 'डकर्मी'},
      'wage_type': 'daily',
      'wage_amount': '1500.00',
      'district': {'code': 'LTP', 'name_en': 'Lalitpur', 'name_ne': 'ललितपुर', 'province': 3},
      'food_provided': true,
      'accommodation_provided': false,
      'start_date': '2026-10-20',
      'start_date_bs': '2083-07-03',
      'openings_count': 4,
      'organization': {'id': 'o1', 'name': 'Shivam Builders'},
      'employer_verified': true,
    },
  ],
};

const applicationsJson = {
  'count': 2,
  'results': [
    {
      'id': 'a1',
      'stage': 'shortlisted',
      'source': 'ops',
      'worker_response': 'pending',
      'interview_at': null,
      'created_at': '2026-10-05T10:00:00+05:45',
      'can_respond': true,
      'job': {
        'id': 'j2',
        'title': 'Cook',
        'wage_type': 'monthly',
        'wage_amount': '22000.00',
        'organization': {'id': 'o2', 'name': 'Hotel Annapurna View'},
        'employer_verified': true,
      },
      'organization': {'id': 'o2', 'name': 'Hotel Annapurna View'},
      'employer_verified': true,
    },
    {
      'id': 'a2',
      'stage': 'sourced',
      'source': 'worker_interest',
      'worker_response': null,
      'created_at': '2026-10-06T10:00:00+05:45',
      'can_respond': false,
      'job': {
        'id': 'j1',
        'title': 'Mason for apartment block',
        'wage_type': 'daily',
        'wage_amount': '1500.00',
        'organization': {'id': 'o1', 'name': 'Shivam Builders'},
      },
    },
  ],
};

const workerPrefsJson = {
  'id': 'w1',
  'full_name': 'Ram Bahadur Thapa',
  'phone': '9812345678',
  'verification_status': 'verified',
  'is_available': true,
  'payment_method': 'esewa',
  'preferred_districts': [
    {'code': 'KTM', 'name_en': 'Kathmandu', 'name_ne': 'काठमाडौं', 'province': 3},
    'LTP',
  ],
  'service_radius_km': 25,
  'expected_monthly_wage': '25000.00',
  'available_from': '2026-11-01',
};

const districtsJson = [
  {'code': 'KTM', 'name_en': 'Kathmandu', 'name_ne': 'काठमाडौं', 'province': 3},
  {'code': 'LTP', 'name_en': 'Lalitpur', 'name_ne': 'ललितपुर', 'province': 3},
  {'code': 'KAS', 'name_en': 'Kaski', 'name_ne': 'कास्की', 'province': 4},
];

const supportCasesJson = {
  'count': 1,
  'results': [
    {
      'id': 'c1',
      'number': 'KS-000012',
      'category': 'payment',
      'subject': 'Salary not received',
      'description': 'My Asoj salary has not come yet.',
      'priority': 'normal',
      'status': 'pending_user',
      'status_label': 'Waiting for you',
      'created_at': '2026-10-04T10:00:00+05:45',
      'updated_at': '2026-10-05T10:00:00+05:45',
    },
  ],
};

const caseMessagesJson = {
  'count': 3,
  'results': [
    {
      'id': 'm1',
      'body': 'Please share your payslip month.',
      'internal': false,
      'from_staff': true,
      'author': {'id': null, 'full_name': 'KaamSathi'},
      'created_at': '2026-10-04T12:00:00+05:45',
    },
    {
      'id': 'm2',
      'body': 'INTERNAL: employer is slow payer, escalate',
      'internal': true,
      'from_staff': true,
      'author': {'id': 'staff1', 'full_name': 'Ops Person'},
      'created_at': '2026-10-04T12:05:00+05:45',
    },
    {
      'id': 'm3',
      'body': 'It is for Asoj.',
      'internal': false,
      'from_staff': false,
      'author': {'id': 'u1', 'full_name': 'Ram Bahadur Thapa'},
      'created_at': '2026-10-04T13:00:00+05:45',
    },
  ],
};

const safetyGuidanceJson = {
  'title_en': 'Stay safe when going abroad',
  'title_ne': 'विदेश जाँदा सुरक्षित रहनुहोस्',
  'en': ['Use only DoFE-licensed agencies.', 'Never hand over your original passport without a receipt.'],
  'ne': ['इजाजतपत्रप्राप्त एजेन्सी मात्र प्रयोग गर्नुहोस्।', 'रसिद नलिई सक्कल राहदानी नदिनुहोस्।'],
  'dofe_url': 'https://dofe.gov.np',
};

const mobilityDocsJson = {
  'count': 2,
  'next': null,
  'previous': null,
  'results': [
    {
      'id': 'd1',
      'kind_group': 'travel',
      'kind': 'passport',
      'title': null,
      'issuing_country': 'NP',
      'number_masked': 'PA*****21',
      'issued_on': '2020-01-01',
      'expires_on': '2026-11-15',
      'expires_on_bs': '2083-07-29',
      'status': 'verified',
      'status_label': 'Verified',
    },
    {
      'id': 'd2',
      'kind_group': 'clearance',
      'kind': 'medical_fitness',
      'title': 'Medical fitness report',
      'issuer': 'Nepal Health Clinic',
      'expires_on': '2026-09-01',
      'status': 'pending',
    },
  ],
  'safety_guidance': safetyGuidanceJson,
};

const agenciesJson = {
  'count': 1,
  'results': [
    {
      'id': 'p9',
      'name': 'Himalayan Manpower Pvt. Ltd.',
      'license_no': '1234/070/71',
      'license_valid_until': '2027-07-15',
      'license_valid_until_bs': '2084-03-31',
      'contact_phone': '014000000',
    },
  ],
  'safety_guidance': safetyGuidanceJson,
};

const mobilitySharesJson = {
  'count': 1,
  'results': [
    {
      'id': 'g9',
      'purpose': 'recruitment',
      'scopes': ['passport.read', 'mobility.read'],
      'granted_at': '2026-10-01T10:00:00+05:45',
      'expires_at': '2099-10-31T10:00:00+05:45',
      'revoked_at': null,
      'status': 'active',
      'partner': {'id': 'p9', 'name': 'Himalayan Manpower Pvt. Ltd.', 'kind': 'recruitment_agency'},
    },
  ],
};

const careerJson = {
  'trades': [
    {'code': 'mason', 'name_en': 'Mason', 'name_ne': 'डकर्मी'},
  ],
  'recommendations': [
    {
      'key': 'profile_identity',
      'kind': 'profile',
      'title': 'Get your identity verified',
      'title_ne': 'आफ्नो परिचय प्रमाणित गराउनुहोस्',
      'reason': 'Employers shortlist verified workers first.',
      'reason_ne': 'रोजगारदाताले प्रमाणित कामदारलाई पहिले छान्छन्।',
      'expected_uplift_pct': null,
      'link': 'ks://profile',
    },
    {
      'key': 'course_c1',
      'kind': 'course',
      'title': 'NSTB Level 1 Mason',
      'title_ne': 'एनएसटीबी तह १ डकर्मी',
      'reason': 'Certified masons earn more in your area.',
      'expected_uplift_pct': 18,
      'course_id': 'c1',
      'link': 'ks://courses/c1',
    },
  ],
};

const myTimesheetJson = {
  'id': 't1',
  'employment_id': 'e1',
  'worker': {'id': 'w1', 'full_name': 'Ram Bahadur Thapa'},
  'designation': 'Cook',
  'site': {'id': 's1', 'name': 'Thamel Main Building'},
  'week_start': '2026-10-04',
  'week_end': '2026-10-10',
  'status': 'submitted',
  'days': [
    {'date': '2026-10-04', 'worked_minutes': 540, 'regular_minutes': 480, 'overtime_minutes': 60, 'status': 'present'},
    {'date': '2026-10-05', 'worked_minutes': 240, 'regular_minutes': 240, 'overtime_minutes': 0, 'status': 'half_day'},
    {'date': '2026-10-06', 'worked_minutes': 0, 'regular_minutes': 0, 'overtime_minutes': 0, 'status': 'absent'},
  ],
  'regular_minutes': 720,
  'overtime_minutes_claimed': 1500,
  'overtime_minutes_approved': null,
  'over_cap': true,
  'note': null,
};

const jobOffersJson = {
  'count': 1,
  'results': [
    {
      'id': 'of1',
      'status': 'pending',
      'designation': 'Commis cook',
      'organization': {'id': 'o2', 'name': 'Hotel Annapurna View'},
      'employer_verified': true,
      'site': {'id': 's1', 'name': 'Thamel Main Building'},
      'wage_type': 'monthly',
      'basic_salary': '12170.00',
      'dearness_allowance': '7380.00',
      'monthly_gross': '19550.00',
      'start_date': '2026-10-20',
      'start_date_bs': '2083-07-03',
      'contract_type': 'fixed_term',
      'expires_at': '2099-10-10T17:00:00+05:45',
    },
  ],
};

const jobAlertsJson = {
  'count': 1,
  'results': [
    {
      'id': 'al1',
      'trade': {'code': 'mason', 'name_en': 'Mason', 'name_ne': 'डकर्मी'},
      'districts': [
        {'code': 'KTM', 'name_en': 'Kathmandu', 'name_ne': 'काठमाडौं'},
      ],
      'min_wage': '20000.00',
      'frequency': 'instant',
      'is_active': true,
    },
  ],
};

const notificationPrefsJson = {
  'sms_enabled': true,
  'push_enabled': false,
  'email_enabled': false,
  'marketing_opt_in': false,
  'job_alert_frequency': 'weekly',
  'quiet_hours_start': '21:00:00',
  'quiet_hours_end': '07:00:00',
};

const helpArticlesJson = {
  'count': 1,
  'results': [
    {
      'slug': 'how-hajiri-works',
      'title_en': 'How hajiri works',
      'title_ne': 'हाजिरी कसरी काम गर्छ',
      'summary_en': 'Check in with the site QR code.',
      'summary_ne': 'कार्यस्थलको QR कोडबाट हाजिर गर्नुहोस्।',
      'category': 'attendance',
    },
  ],
};

const helpArticleJson = {
  'slug': 'how-hajiri-works',
  'title_en': 'How hajiri works',
  'title_ne': 'हाजिरी कसरी काम गर्छ',
  'body_en':
      '# Checking in\n\nScan the **site QR** code.\n\n- Turn on location\n- Stand inside the site\n\n1. Open the app\n2. Tap Check in',
  'body_ne': '# हाजिर\n\n**QR कोड** स्क्यान गर्नुहोस्।\n\n- लोकेसन खोल्नुहोस्',
};

const meWithLegalJson = {
  'id': 'u1',
  'phone': '9812345678',
  'full_name': 'Ram Bahadur Thapa',
  'preferred_language': 'en',
  'worker_id': 'w1',
  'memberships': <Object>[],
  'pending_legal': [
    {'id': 'L1', 'kind': 'terms', 'version': '2', 'url': 'https://kaamsathi.com/legal/terms'},
    {'id': 'L2', 'kind': 'privacy', 'version': '3', 'url': 'https://kaamsathi.com/legal/privacy'},
  ],
};
