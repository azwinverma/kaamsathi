import 'package:flutter_test/flutter_test.dart';
import 'package:kaamsathi/core/api/json.dart';
import 'package:kaamsathi/features/common/roster_models.dart';
import 'package:kaamsathi/features/supervisor/roster/roster_data.dart';
import 'package:kaamsathi/features/worker/credentials/credentials_data.dart';
import 'package:kaamsathi/features/worker/crew/crew_data.dart';
import 'package:kaamsathi/features/worker/employment/employment_data.dart';
import 'package:kaamsathi/features/worker/money/money_data.dart';
import 'package:kaamsathi/features/worker/privacy/privacy_data.dart';
import 'package:kaamsathi/features/worker/roster/my_roster_data.dart';
import 'package:kaamsathi/features/worker/training/training_data.dart';
import 'package:kaamsathi/features/worker/trust/trust_data.dart';

import '../fixtures/eco_fixtures.dart';

void main() {
  group('trust', () {
    test('TrustSummary parses level, score, breakdown and next steps', () {
      final t = TrustSummary.fromJson(trustJson);
      expect(t.verificationLevel, 2);
      expect(t.verificationLevelLabel, 'Employment verified');
      expect(t.reliabilityScore, 78);
      expect(t.breakdown['attendance'], closeTo(0.92, 1e-9));
      expect(t.breakdown.keys, containsAll(trustComponents));
      expect(t.nextSteps, hasLength(2));
    });

    test('TrustSummary tolerates null score and clamps out-of-range values', () {
      final t = TrustSummary.fromJson({
        'verification_level': 9,
        'reliability_score': null,
        'breakdown': {'attendance': 1.4, 'skills': 'x'},
        'next_steps': ['', 'Add a certificate'],
      });
      expect(t.verificationLevel, 5);
      expect(t.reliabilityScore, isNull);
      expect(t.breakdown, {'attendance': 1.0});
      expect(t.nextSteps, ['Add a certificate']);
    });

    test('ProfileView parses org / partner viewers from a paginated list', () {
      final views = resultsOf(profileViewsJson).map(ProfileView.fromJson).toList();
      expect(views, hasLength(2));
      expect(views[0].viewerName, 'Hotel Annapurna View Pvt. Ltd.');
      expect(views[0].context, 'application');
      expect(views[1].partner?.name, 'Sunrise Bank');
      expect(views[1].createdAt, isNotNull);
    });

    test('Dispute parses ids given as plain strings', () {
      final d = Dispute.fromJson(disputeJson);
      expect(d.kind, 'attendance');
      expect(d.status, 'employer_responded');
      expect(d.employmentId, 'e1');
      expect(d.payslipId, isNull);
      expect(d.attendanceDateBs, '2083-06-15');
      expect(d.employerNote, isNotEmpty);
      expect(d.raisedAt, isNotNull);
    });

    test('disputeBody sends both id spellings and trims', () {
      final b = disputeBody(kind: 'wage', description: '  wrong OT  ', employmentId: 'e1', payslipId: 'p1');
      expect(b['description'], 'wrong OT');
      expect(b['employment'], 'e1');
      expect(b['employment_id'], 'e1');
      expect(b['payslip_id'], 'p1');
      expect(b.containsKey('attendance_date'), isFalse);
    });
  });

  group('employment + contract', () {
    test('MyEmployment parses org, trade and nested latest contract', () {
      final e = MyEmployment.fromJson(employmentJson);
      expect(e.orgName('en'), 'Hotel Annapurna View');
      expect(e.orgName('ne'), 'होटल अन्नपूर्ण भ्यू');
      expect(e.trade('ne'), 'भान्से (कुक)');
      expect(e.siteName, 'Thamel Main Building');
      expect(e.isActive, isTrue);
      expect(e.ssfEnrolled, isTrue);
      expect(e.contract?.version, 2);
      expect(e.contract?.isAccepted, isFalse);
    });

    test('canRate after 30 days or once ended; never twice', () {
      final e = MyEmployment.fromJson(employmentJson);
      expect(e.canRate(DateTime(2026, 2, 1)), isFalse);
      expect(e.canRate(DateTime(2026, 2, 20)), isTrue);
      final ended = MyEmployment.fromJson({...employmentJson, 'status': 'ended', 'end_date': '2026-01-20'});
      expect(ended.canRate(DateTime(2026, 1, 21)), isTrue);
      final rated = MyEmployment.fromJson({
        ...employmentJson,
        'my_rating': {'score_a': 4},
      });
      expect(rated.canRate(DateTime(2027)), isFalse);
    });

    test('monthsWorked counts whole months', () {
      final e = MyEmployment.fromJson(employmentJson);
      expect(e.monthsWorked(DateTime(2026, 10, 7)), 8);
      expect(e.monthsWorked(DateTime(2026, 10, 15)), 9);
    });

    test('ContractInfo accepts a flat contract object', () {
      final c = ContractInfo.fromJson({'version': 1, 'accepted_at': '2026-02-02T10:00:00+05:45'});
      expect(c?.isAccepted, isTrue);
      expect(ContractInfo.fromJson(null), isNull);
      expect(ContractInfo.fromJson({'employment_id': 'e1', 'latest': null, 'versions': <Object>[]}), isNull);
      // `GET /me/employments/{id}/contract` (flat ContractSerializer + org).
      final me = ContractInfo.fromJson({
        'id': 'c1',
        'version': 3,
        'accepted_at': null,
        'is_accepted': false,
        'organization': {'id': 'o1', 'name': 'Hotel'},
      });
      expect(me?.version, 3);
      expect(me?.isAccepted, isFalse);
    });
  });

  group('crew', () {
    test('Crew parses members (WorkerCard + availability) and stats', () {
      final c = Crew.fromJson(crewJson);
      expect(c.name, "Ram's mason team");
      expect(c.members, hasLength(2));
      final hari = c.members.first;
      expect(hari.currentEmployer, 'Shivam Builders');
      expect(hari.trades.single.trade.name('ne'), 'डकर्मी');
      expect(hari.trades.single.years, 6);
      expect(c.members[1].isAvailable, isTrue);
      expect(c.members[1].currentEmployer, isNull);
      expect(c.stats.placed90d, 1);
      expect(c.stats.earnedTotal, '1000.00');
    });

    test('CrewReferral reads worker and org from the application', () {
      final r = resultsOf(crewReferralsJson).map(CrewReferral.fromJson).single;
      expect(r.workerName, 'Hari Tamang');
      expect(r.organizationName, 'Shivam Builders');
      expect(r.status, 'pending');
      expect(r.eligibleAt, isNotNull);
    });
  });

  group('credentials + passport', () {
    test('Credential parses and only pending can be deleted', () {
      final c = Credential.fromJson(credentialJson);
      expect(c.kind, 'nstb');
      expect(c.issuedOnBs, '2081-11-17');
      expect(c.canDelete, isTrue);
      expect(Credential.fromJson({...credentialJson, 'status': 'verified'}).canDelete, isFalse);
    });

    test('Passport accepts payload nested under `payload`', () {
      final p = Passport.fromJson({
        'public_code': 'ab12cd34ef',
        'is_public': true,
        'show_contact': false,
        'payload': passportPayloadJson,
      }, lang: 'ne');
      expect(p.publicCode, 'ab12cd34ef');
      expect(p.isPublic, isTrue);
      expect(p.payload.name, 'Ram Bahadur Thapa');
      expect(p.payload.districts, ['काठमाडौं']);
      expect(p.payload.identity['address'], isFalse);
      expect(p.payload.skills.single.nstbLevel, 'level1');
      expect(p.payload.credentials.single.status, 'verified');
      expect(p.payload.attendanceRate, closeTo(0.94, 1e-9));
      expect(p.payload.contactPhone, '9800000010');
      expect(p.publicUrl, 'https://kaamsathi.com/p/ab12cd34ef');
    });

    test('Passport accepts payload merged at the top level', () {
      final p = Passport.fromJson({
        ...passportPayloadJson,
        'is_public': false,
        'work': {'attendance_rate': 88},
      });
      expect(p.isPublic, isFalse);
      expect(p.payload.reliabilityScore, 82);
      expect(p.payload.attendanceRate, closeTo(0.88, 1e-9));
    });

    test('PassportShare active / expired / revoked', () {
      final s = PassportShare.fromJson(shareJson);
      expect(s.isActive(), isTrue);
      expect(s.views, 3);
      expect(s.url, endsWith('/p/s/tok123'));
      final expired = PassportShare.fromJson({...shareJson, 'expires_at': '2020-01-01T00:00:00+05:45'});
      expect(expired.isExpired(), isTrue);
      expect(expired.isActive(), isFalse);
      final revoked = PassportShare.fromJson({...shareJson, 'revoked_at': '2026-10-02T00:00:00+05:45'});
      expect(revoked.isActive(), isFalse);
    });
  });

  group('training', () {
    test('Course parses nested and flat trade/district; recommended sorted first', () {
      final list = sortCourses(resultsOf(coursesJson).map((j) => Course.fromJson(j, lang: 'ne')).toList());
      expect(list.first.id, 'k2');
      expect(list.first.recommended, isTrue);
      expect(list.first.trade?.code, 'cook');
      expect(list.first.district, 'Kaski');
      final wiring = list[1];
      expect(wiring.displayTitle('ne'), 'घर वायरिङ');
      expect(wiring.provider('ne'), 'बालाजु तालिम केन्द्र');
      expect(wiring.district, 'काठमाडौं');
      expect(wiring.leadsToNstb, isTrue);
    });

    test('Enrollment parses an embedded course or a bare id', () {
      final e = Enrollment.fromJson({'id': 'en1', 'course': coursesJson.first, 'status': 'enrolled'});
      expect(e.courseId, 'k1');
      expect(e.course?.title, 'House wiring');
      final bare = Enrollment.fromJson({'id': 'en2', 'course': 'k2', 'status': 'applied'});
      expect(bare.courseId, 'k2');
      expect(bare.course, isNull);
    });
  });

  group('money', () {
    test('FinancialProfile parses and sorts months oldest first', () {
      final f = FinancialProfile.fromJson(financialProfileJson);
      expect(f.verifiedMonths, 8);
      expect(f.avgMonthlyNet, '19800.50');
      expect(f.incomeStability, closeTo(0.91, 1e-9));
      expect(f.monthly.first.bsYear, 2082);
      expect(f.monthly.last.bsMonth, 5);
      expect(f.monthly.last.employer, 'Hotel Annapurna View');
      expect(f.isEmpty, isFalse);
      expect(FinancialProfile.fromJson(const {}).isEmpty, isTrue);
    });

    test('Offer parses flat and nested eligibility, partner + regulator', () {
      final offers = resultsOf(offersJson).map(Offer.fromJson).toList();
      expect(offers[0].eligible, isFalse);
      expect(offers[0].reasons, ['Needs 6 verified months']);
      expect(offers[0].partner.regulator, 'nrb');
      expect(offers[0].grantPurpose, 'loan_assessment');
      expect(offers[0].displayTitle('ne'), 'कामदार सानो ऋण');
      expect(offers[1].eligible, isTrue);
      expect(offers[1].partner.regulator, 'beema_samiti');
      expect(offers[1].grantPurpose, 'insurance');
      expect(offers[1].alreadyApplied, isFalse);
      final applied = Offer.fromJson({...offersJson[1], 'open_referral_id': 'fr9', 'description_ne': 'दुर्घटना बीमा'});
      expect(applied.alreadyApplied, isTrue);
      expect(applied.displayDescription('ne'), 'दुर्घटना बीमा');
    });

    test('FinanceReferral, ConsentGrant and PartnerAccess', () {
      final r = FinanceReferral.fromJson(financeReferralJson, lang: 'ne');
      expect(r.offerTitle, 'कामदार सानो ऋण');
      expect(r.partner.name, 'Sunrise Bank');
      expect(r.status, 'under_review');
      final g = ConsentGrant.fromJson(grantJson);
      expect(g.isActive(), isTrue);
      expect(g.scopes, ['earnings.read', 'profile.read']);
      expect(ConsentGrant.fromJson({...grantJson, 'revoked_at': '2026-10-05T00:00:00+05:45'}).isActive(), isFalse);
      final a = PartnerAccess.fromJson(partnerAccessJson);
      expect(a.scope, 'earnings.read');
      expect(a.partner.name, 'Sunrise Bank');
    });

    test('PartnerRef falls back to flat partner_* keys', () {
      final p = PartnerRef.of({'partner_id': 'p9', 'partner_name': 'Flat Bank', 'regulator': 'nrb'});
      expect(p.id, 'p9');
      expect(p.name, 'Flat Bank');
      expect(p.regulator, 'nrb');
    });
  });

  group('privacy', () {
    test('export download availability', () {
      final list = resultsOf(privacyRequestsJson).map(PrivacyRequest.fromJson).toList();
      expect(list[0].canDownload(), isTrue);
      expect(list[1].canDownload(), isFalse);
      final flagged = PrivacyRequest.fromJson({...privacyRequestsJson[0], 'file_available': false});
      expect(flagged.canDownload(), isFalse);
      final expired = PrivacyRequest.fromJson({...privacyRequestsJson[0], 'file_expires_at': '2020-01-01T00:00:00Z'});
      expect(expired.canDownload(), isFalse);
      expect(expired.downloadExpired(), isTrue);
    });

    test('extensionForContentType', () {
      expect(extensionForContentType('application/zip'), 'zip');
      expect(extensionForContentType('application/json; charset=utf-8'), 'json');
      expect(extensionForContentType('application/pdf'), 'pdf');
      expect(extensionForContentType(null), 'zip');
    });
  });

  group('roster', () {
    test('MyRosterWeek accepts a bare list of flat entries', () {
      final w = MyRosterWeek.fromJson({
        'entries': [
          {
            'date': '2026-10-04',
            'date_bs': '2083-06-18',
            'shift': {'id': 'm', 'name': 'Morning', 'start_time': '07:00:00', 'end_time': '15:00:00'},
            'site': {'id': 's1', 'name': 'Thamel Main Building'},
            'is_off': false,
          },
          {'date': '2026-10-10', 'is_off': true},
          {'date': '2026-10-05', 'shift': null, 'is_off': false},
        ],
      }, DateTime(2026, 10, 4));
      expect(w.entries, hasLength(2));
      expect(w.on(DateTime(2026, 10, 4))?.shift?.name, 'Morning');
      expect(w.on(DateTime(2026, 10, 4))?.siteName, 'Thamel Main Building');
      expect(w.on(DateTime(2026, 10, 10))?.isOff, isTrue);
      expect(w.on(DateTime(2026, 10, 5)), isNull);
    });

    test('MyRosterWeek accepts `{days: [{date, entry}]}` wrappers', () {
      final w = MyRosterWeek.fromJson({
        'days': [
          {
            'date': '2026-10-06',
            'entry': {'shift_name': 'Night', 'start_time': '19:00', 'end_time': '07:00', 'is_off': false},
          },
          {'date': '2026-10-07', 'entry': null},
        ],
      }, DateTime(2026, 10, 4));
      expect(w.entries.keys, ['2026-10-06']);
      expect(w.on(DateTime(2026, 10, 6))?.shift?.label('en'), 'Night · 7:00 PM – 7:00 AM');
    });

    test('Org RosterWeek parses days and cells', () {
      final r = RosterWeek.fromJson(orgRosterJson, DateTime(2026, 10, 4));
      expect(r.days, hasLength(7));
      expect(r.days.first.dateBs, '2083-06-18');
      final row = r.rows.single;
      expect(row.cells['2026-10-04']?.shiftId, 'sh-m');
      expect(row.cells['2026-10-05'], isNull);
      expect(row.cells['2026-10-10']?.isOff, isTrue);
    });

    test('Org RosterWeek fills days when the server omits them', () {
      final r = RosterWeek.fromJson({'rows': <Object>[]}, DateTime(2026, 10, 4));
      expect(r.days.map((d) => d.date), [
        '2026-10-04',
        '2026-10-05',
        '2026-10-06',
        '2026-10-07',
        '2026-10-08',
        '2026-10-09',
        '2026-10-10',
      ]);
    });

    test('ShiftRef short codes and labels', () {
      const morning = ShiftRef(id: '1', name: 'Morning', startTime: '07:00:00', endTime: '15:00:00');
      expect(morning.short, 'Mor');
      expect(const ShiftRef(id: '2', name: 'Late night').short, 'LN');
      expect(morning.label('ne'), 'Morning · ७:०० AM – ३:०० PM');
    });
  });
}
