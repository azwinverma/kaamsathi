/// JSON fixtures shaped exactly like docs/CONTRACT-ECOSYSTEM.md responses.
library;

const trustJson = {
  'verification_level': 2,
  'verification_level_label': 'Employment verified',
  'reliability_score': 78,
  'breakdown': {
    'employer_feedback': 0.8,
    'attendance': 0.92,
    'completion': 1.0,
    'skills': 0.4,
    'repeat_hiring': 0.3,
    'stability': 0.5,
  },
  'next_steps': ['Upload your NSTB certificate', 'Ask your employer to rate you'],
};

const profileViewsJson = {
  'count': 2,
  'next': null,
  'previous': null,
  'results': [
    {
      'id': 'v1',
      'organization': {'id': 'o1', 'name': 'Hotel Annapurna View Pvt. Ltd.'},
      'partner': null,
      'context': 'application',
      'context_label': 'Job application',
      'created_at': '2026-10-06T10:15:00+05:45',
    },
    {
      'id': 'v2',
      'organization': null,
      'partner': {'id': 'p1', 'name': 'Sunrise Bank'},
      'context': 'partner',
      'context_label': 'Partner',
      'created_at': '2026-10-05T09:00:00+05:45',
    },
  ],
};

const disputeJson = {
  'id': 'd1',
  'kind': 'attendance',
  'kind_label': 'Attendance',
  'description': 'I worked on this day but it shows absent.',
  'status': 'employer_responded',
  'status_label': 'Employer responded',
  'organization': {'id': 'o1', 'name': 'Hotel Annapurna View'},
  'employment': 'e1',
  'payslip': null,
  'attendance_date': '2026-10-01',
  'attendance_date_bs': '2083-06-15',
  'employer_note': 'We will check the register.',
  'resolution_note': null,
  'raised_at': '2026-10-02T08:00:00+05:45',
};

const employmentJson = {
  'id': 'e1',
  'organization': {'id': 'o1', 'name': 'Hotel Annapurna View', 'name_ne': 'होटल अन्नपूर्ण भ्यू'},
  'worker': {'id': 'w1', 'full_name': 'Ram Bahadur Thapa'},
  'site': {'id': 's1', 'name': 'Thamel Main Building'},
  'trade': {'code': 'cook', 'name_en': 'Cook', 'name_ne': 'भान्से (कुक)'},
  'designation': 'Cook',
  'employee_code': 'HAV-012',
  'start_date': '2026-01-15',
  'start_date_bs': '2082-10-01',
  'end_date': null,
  'end_date_bs': null,
  'status': 'active',
  'wage_type': 'monthly',
  'basic_salary': '12170.00',
  'dearness_allowance': '7380.00',
  'other_allowance': '1500.00',
  'daily_wage': null,
  'monthly_gross': '21050.00',
  'ssf_enrolled': true,
  'replacement_eligible_until': null,
  'contract': {
    'latest': {'version': 2, 'generated_at': '2026-02-01T10:00:00+05:45', 'accepted_at': null},
    'versions': <Object>[],
  },
};

const crewJson = {
  'id': 'c1',
  'name': "Ram's mason team",
  'members': [
    {
      'id': 'w2',
      'full_name': 'Hari Tamang',
      'phone_masked': '98XXXXX123',
      'photo': null,
      'verification_status': 'unverified',
      'district': {'code': 'makwanpur', 'name_en': 'Makwanpur', 'name_ne': 'मकवानपुर'},
      'skills': [
        {
          'trade': {'code': 'mason', 'name_en': 'Mason', 'name_ne': 'डकर्मी'},
          'years_experience': 6,
          'nstb_level': 'level1',
        },
      ],
      'total_experience_years': 6,
      'rating_avg': null,
      'placements_count': 1,
      'verification_level': 0,
      'reliability_score': null,
      'is_available': false,
      'current_employer': {'id': 'o2', 'name': 'Shivam Builders'},
    },
    {
      'id': 'w3',
      'full_name': 'Sita Gurung',
      'phone_masked': '97XXXXX456',
      'skills': <Object>[],
      'is_available': true,
      'current_employer': null,
    },
  ],
  'stats': {'members': 2, 'placed_90d': 1, 'earned_total': '1000.00', 'pending_total': '1000.00'},
};

const crewReferralsJson = [
  {
    'id': 'r1',
    'worker': {'id': 'w2', 'full_name': 'Hari Tamang'},
    'application': {
      'id': 'a1',
      'job': {
        'id': 'j1',
        'title': 'Mason',
        'organization': {'id': 'o2', 'name': 'Shivam Builders'},
      },
    },
    'amount': '1000.00',
    'status': 'pending',
    'eligible_at': '2026-11-01T00:00:00+05:45',
    'paid_at': null,
    'created_at': '2026-10-01T09:00:00+05:45',
  },
];

const credentialJson = {
  'id': 'cr1',
  'kind': 'nstb',
  'title': 'Cook — Level 1',
  'issuer': 'NSTB',
  'certificate_no': 'NSTB-12345',
  'level': 'level1',
  'issued_on': '2025-03-01',
  'issued_on_bs': '2081-11-17',
  'expires_on': null,
  'status': 'pending',
  'document': 'https://cdn.example.com/doc.jpg',
};

const passportPayloadJson = {
  'name': 'Ram Bahadur Thapa',
  'photo_url': null,
  'trade_primary': {'code': 'cook', 'name_en': 'Cook', 'name_ne': 'भान्से (कुक)'},
  'districts': [
    {'code': 'kathmandu', 'name_en': 'Kathmandu', 'name_ne': 'काठमाडौं'},
  ],
  'verification_level': 3,
  'reliability_score': 82,
  'identity': {'citizenship': true, 'phone': true, 'address': false},
  'skills': [
    {
      'trade': {'code': 'cook', 'name_en': 'Cook', 'name_ne': 'भान्से (कुक)'},
      'years': 5,
      'nstb_level': 'level1',
    },
  ],
  'credentials': [
    {
      'kind': 'nstb',
      'title': 'Cook — Level 1',
      'issuer': 'NSTB',
      'level': 'level1',
      'issued_on': '2025-03-01',
      'expires_on': null,
      'verified': true,
    },
  ],
  'work': {'verified_employers': 2, 'total_months': 26, 'completed_jobs': 1, 'attendance_rate': 0.94},
  'availability': {'is_available': true, 'expected_monthly_wage': '25000.00'},
  'contact': {'phone': '9800000010'},
  'verify_url': 'https://kaamsathi.com/p/ab12cd34ef',
  'generated_at': '2026-10-07T09:00:00+05:45',
};

const shareJson = {
  'id': 'sh1',
  'audience_label': 'Hotel Everest HR',
  'purpose': 'job',
  'expires_at': '2099-01-01T00:00:00+05:45',
  'include_contact': true,
  'views': 3,
  'revoked_at': null,
  'created_at': '2026-10-01T09:00:00+05:45',
  'url': 'https://kaamsathi.com/p/s/tok123',
};

const coursesJson = [
  {
    'id': 'k1',
    'provider': {'id': 'tp1', 'name': 'Balaju Training Centre', 'name_ne': 'बालाजु तालिम केन्द्र'},
    'trade': {'code': 'electrician', 'name_en': 'Electrician', 'name_ne': 'इलेक्ट्रिसियन'},
    'title': 'House wiring',
    'title_ne': 'घर वायरिङ',
    'level': 'level1',
    'duration_days': 30,
    'fee': '0.00',
    'mode': 'classroom',
    'district': {'code': 'kathmandu', 'name_en': 'Kathmandu', 'name_ne': 'काठमाडौं'},
    'starts_on': '2026-11-01',
    'starts_on_bs': '2083-07-15',
    'seats': 20,
    'status': 'open',
    'leads_to_nstb': true,
    'recommended': false,
  },
  {
    'id': 'k2',
    'provider': {'id': 'tp2', 'name': 'Hotel School'},
    'trade': 'cook',
    'title': 'Commis chef',
    'level': 'basic',
    'duration_days': 45,
    'fee': '5000.00',
    'mode': 'on_site',
    'district': 'Kaski',
    'starts_on': '2026-12-01',
    'status': 'open',
    'leads_to_nstb': false,
    'recommended': true,
  },
];

const financialProfileJson = {
  'months_on_platform': 9,
  'verified_months': 8,
  'avg_monthly_net': '19800.50',
  'min_monthly_net': '17500.00',
  'max_monthly_net': '21050.00',
  'income_stability': 0.91,
  'employers_count': 1,
  'current_employment_months': 9,
  'ssf_months': 8,
  'last_payslip_month': '2083-05',
  'monthly': [
    {
      'bs_year': 2083,
      'bs_month': 5,
      'gross': '21050.00',
      'net': '19800.00',
      'employer': 'Hotel Annapurna View',
      'paid': true,
    },
    {
      'bs_year': 2082,
      'bs_month': 12,
      'gross': '20000.00',
      'net': '18700.00',
      'employer': 'Hotel Annapurna View',
      'paid': true,
    },
  ],
  'computed_at': '2026-10-07T02:00:00+05:45',
};

const offersJson = [
  {
    'id': 'of1',
    'partner': {'id': 'p1', 'name': 'Sunrise Bank', 'kind': 'bank', 'regulator': 'nrb'},
    'kind': 'loan',
    'title': 'Small worker loan',
    'title_ne': 'कामदार सानो ऋण',
    'description': 'Up to Rs. 50,000 for verified workers.',
    'min_verified_months': 6,
    'min_avg_net': '15000.00',
    'max_amount': '50000.00',
    'interest_note': '12% per year (bank rate)',
    'eligible': false,
    'reasons': ['Needs 6 verified months'],
  },
  {
    'id': 'of2',
    'partner': {'id': 'p2', 'name': 'Shikhar Insurance', 'kind': 'insurer', 'regulator': 'beema_samiti'},
    'kind': 'insurance',
    'title': 'Accident cover',
    'min_verified_months': 1,
    'eligibility': {'eligible': true, 'reasons': <String>[]},
  },
];

const financeReferralJson = {
  'id': 'fr1',
  'offer': {'id': 'of1', 'title': 'Small worker loan', 'title_ne': 'कामदार सानो ऋण'},
  'partner': {'id': 'p1', 'name': 'Sunrise Bank', 'regulator': 'nrb'},
  'grant': 'g1',
  'amount_requested': '30000.00',
  'purpose_note': 'Tools',
  'status': 'under_review',
  'partner_ref': null,
  'amount_approved': null,
  'created_at': '2026-10-03T12:00:00+05:45',
  'updated_at': '2026-10-04T12:00:00+05:45',
};

const grantJson = {
  'id': 'g1',
  'partner': {'id': 'p1', 'name': 'Sunrise Bank', 'kind': 'bank', 'regulator': 'nrb'},
  'purpose': 'loan_assessment',
  'scopes': ['earnings.read', 'profile.read'],
  'granted_at': '2026-10-03T12:00:00+05:45',
  'expires_at': '2099-01-01T00:00:00+05:45',
  'revoked_at': null,
  'channel': 'app',
};

const partnerAccessJson = {
  'id': 'pa1',
  'partner': {'id': 'p1', 'name': 'Sunrise Bank'},
  'endpoint': '/partner/workers/w1/earnings',
  'scope': 'earnings.read',
  'status_code': 200,
  'created_at': '2026-10-04T10:00:00+05:45',
};

const privacyRequestsJson = [
  {
    'id': 'pr1',
    'kind': 'export',
    'status': 'completed',
    'details': null,
    'response_note': null,
    'file': 'https://cdn.example.com/export.zip',
    'file_expires_at': '2099-01-01T00:00:00+05:45',
    'created_at': '2026-10-01T10:00:00+05:45',
    'completed_at': '2026-10-01T10:05:00+05:45',
  },
  {
    'id': 'pr2',
    'kind': 'deletion',
    'status': 'received',
    'details': 'Leaving the country',
    'created_at': '2026-10-05T10:00:00+05:45',
  },
];

const orgRosterJson = {
  'days': [
    {'date': '2026-10-04', 'date_bs': '2083-06-18'},
    {'date': '2026-10-05', 'date_bs': '2083-06-19'},
    {'date': '2026-10-06', 'date_bs': '2083-06-20'},
    {'date': '2026-10-07', 'date_bs': '2083-06-21'},
    {'date': '2026-10-08', 'date_bs': '2083-06-22'},
    {'date': '2026-10-09', 'date_bs': '2083-06-23'},
    {'date': '2026-10-10', 'date_bs': '2083-06-24'},
  ],
  'rows': [
    {
      'employment_id': 'e1',
      'worker_name': 'Ram Bahadur Thapa',
      'designation': 'Cook',
      'cells': {
        '2026-10-04': {'shift_id': 'sh-m', 'site_id': 's1', 'is_off': false},
        '2026-10-05': null,
        '2026-10-10': {'shift_id': null, 'site_id': 's1', 'is_off': true},
      },
    },
  ],
};
