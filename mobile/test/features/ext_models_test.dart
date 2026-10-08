import 'package:flutter_test/flutter_test.dart';
import 'package:kaamsathi/core/api/json.dart';
import 'package:kaamsathi/core/auth/me.dart';
import 'package:kaamsathi/core/auth/session.dart';
import 'package:kaamsathi/core/router/router.dart';
import 'package:kaamsathi/core/widgets/simple_markdown.dart';
import 'package:kaamsathi/features/common/inbox/inbox_data.dart';
import 'package:kaamsathi/features/common/inbox/inbox_screen.dart';
import 'package:kaamsathi/features/common/inbox/notification_prefs.dart';
import 'package:kaamsathi/features/common/ref_data.dart';
import 'package:kaamsathi/features/common/security/security_data.dart';
import 'package:kaamsathi/features/common/support/help_center.dart';
import 'package:kaamsathi/features/common/support/support_data.dart';
import 'package:kaamsathi/features/common/timesheet_models.dart';
import 'package:kaamsathi/features/worker/career/career_data.dart';
import 'package:kaamsathi/features/worker/career/ui/career_screen.dart';
import 'package:kaamsathi/features/worker/data/worker_models.dart';
import 'package:kaamsathi/features/worker/employment/employment_data.dart';
import 'package:kaamsathi/features/worker/experience/experience_data.dart';
import 'package:kaamsathi/features/worker/jobs/jobs_data.dart';
import 'package:kaamsathi/features/worker/mobility/mobility_data.dart';
import 'package:kaamsathi/features/worker/money/money_data.dart';
import 'package:kaamsathi/features/worker/preferences/availability_screen.dart';

import '../fixtures/eco_fixtures.dart' show employmentJson;
import '../fixtures/ext_fixtures.dart';

void main() {
  group('inbox', () {
    test('notifications parse bilingual title/body, read state, data', () {
      final list = resultsOf(notificationsJson).map(AppNotification.fromJson).toList();
      expect(list, hasLength(2));
      expect(list[0].isRead, isFalse);
      expect(list[0].titleFor('ne'), 'होटल अन्नपूर्णमा कुकका लागि छनोट भयो');
      expect(list[1].titleFor('ne'), 'Reply on KS-000012'); // falls back to English
      expect(list[1].isRead, isTrue);
      expect(list[1].data['case_id'], 'c1');
    });

    test('unread count accepts {count}, {unread} and bare numbers', () {
      expect(parseUnreadCount({'count': 3}), 3);
      expect(parseUnreadCount({'unread': '2'}), 2);
      expect(parseUnreadCount(5), 5);
      expect(parseUnreadCount(null), 0);
    });

    test('notification routing uses API links, case ids and kinds per mode', () {
      final list = resultsOf(notificationsJson).map(AppNotification.fromJson).toList();
      expect(routeForNotification(list[0], AppMode.worker), Routes.workerApplications);
      expect(routeForNotification(list[1], AppMode.worker), Routes.helpCase('c1'));
      expect(routeForNotification(list[1], AppMode.supervisor), Routes.helpCase('c1'));
      // Worker routes are never offered in supervisor mode.
      expect(routeForNotification(list[0], AppMode.supervisor), isNull);
      const ts = AppNotification(id: 'x', kind: 'timesheet_approved', title: 't');
      expect(routeForNotification(ts, AppMode.supervisor), Routes.supTimesheets);
      const offer = AppNotification(id: 'y', kind: 'job_offer_received', title: 't');
      expect(routeForNotification(offer, AppMode.worker), Routes.workerOffers);
    });
  });

  group('security', () {
    test('sessions: current first, platform and client labels', () {
      final list = sortSessions(sessionsJson.map(SessionDevice.fromJson));
      expect(list.first.id, 's-me');
      expect(list.first.current, isTrue);
      expect(list.first.platform, 'android');
      expect(list.last.clientLabel, 'Chrome');
      expect(list.last.lastSeenAt, isNotNull);
    });
  });

  group('work history', () {
    test('parses refs or codes, status, editable flag', () {
      final list = resultsOf(workHistoryJson).map(WorkHistoryEntry.fromJson).toList();
      expect(list[0].trade?.name('ne'), 'डकर्मी');
      expect(list[0].district?.code, 'KTM');
      expect(list[0].isVerified, isTrue);
      expect(list[0].canEdit, isFalse);
      expect(list[0].verificationMethod, 'reference_call');
      expect(list[1].trade?.code, 'cook');
      expect(list[1].district?.code, 'KAS');
      expect(list[1].employerOnPlatform, isTrue);
      expect(list[1].canEdit, isTrue);
      expect(list[1].endDate, isNull);
    });

    test('input JSON keeps nulls so PATCH can clear the end date', () {
      const input = WorkHistoryInput(
        employerName: ' ABC ',
        roleTitle: 'Helper',
        startDate: '2024-01-01',
        referenceName: '  ',
        referencePhone: '9841000000',
      );
      final j = input.toJson();
      expect(j['employer_name'], 'ABC');
      expect(j.containsKey('end_date'), isTrue);
      expect(j['end_date'], isNull);
      expect(j['reference_name'], isNull);
      expect(j['reference_phone'], '9841000000');
    });
  });

  group('jobs', () {
    test('recommended job: wage_amount, district, perks, verified employer', () {
      final j = JobSummary.fromJson(resultsOf(recommendedJobsJson).first);
      expect(j.wage, '1500.00');
      expect(j.wageType, 'daily');
      expect(j.district?.name('en'), 'Lalitpur');
      expect(j.foodProvided, isTrue);
      expect(j.accommodationProvided, isFalse);
      expect(j.organizationName, 'Shivam Builders');
      expect(j.employerVerified, isTrue);
      expect(j.openings, 4);
    });

    test('applications: pending response first, interest under review', () {
      final list = sortApplications(resultsOf(applicationsJson).map(MyApplication.fromJson).toList());
      expect(list.first.id, 'a1');
      expect(list.first.needsResponse, isTrue);
      expect(list.first.job.employerVerified, isTrue);
      expect(list.first.job.organizationName, 'Hotel Annapurna View');
      expect(list.last.needsResponse, isFalse);
      expect(list.last.underReview, isTrue);
    });

    test('needsResponse honours can_respond and terminal stages', () {
      MyApplication app(Map<String, Object?> extra) =>
          MyApplication.fromJson({'id': 'x', 'stage': 'shortlisted', 'job': <String, Object?>{}, ...extra});
      expect(app({'worker_response': null, 'can_respond': true}).needsResponse, isTrue);
      expect(app({'worker_response': null}).needsResponse, isFalse);
      expect(app({'worker_response': 'pending', 'can_respond': false}).needsResponse, isFalse);
      expect(app({'worker_response': 'pending', 'stage': 'dropped'}).needsResponse, isFalse);
      expect(app({'worker_response': 'interested', 'can_respond': true}).needsResponse, isFalse);
    });

    test('job offer: wages, contract, expiry countdown', () {
      final o = JobOffer.fromJson(resultsOf(jobOffersJson).first);
      expect(o.organizationName, 'Hotel Annapurna View');
      expect(o.isDaily, isFalse);
      expect(o.basicSalary, '12170.00');
      expect(o.dearnessAllowance, '7380.00');
      expect(o.siteName, 'Thamel Main Building');
      expect(o.contractType, 'fixed_term');
      expect(o.canAnswer(DateTime(2026, 10, 7)), isTrue);
      expect(o.isExpired(DateTime(2100)), isTrue);
      expect(o.timeLeft(DateTime(2100)), isNull);
      final daily = JobOffer.fromJson({
        'id': 'x',
        'status': 'pending',
        'job': {'wage_type': 'daily', 'wage_amount': '900.00', 'title': 'Helper'},
      });
      expect(daily.isDaily, isTrue);
      expect(daily.dailyWage, '900.00');
      expect(daily.title, 'Helper');
    });

    test('job alerts parse and build a codes-only body', () {
      final a = JobAlert.fromJson(resultsOf(jobAlertsJson).first);
      expect(a.trade?.code, 'mason');
      expect(a.districts.single.code, 'KTM');
      expect(a.frequency, 'instant');
      expect(a.isActive, isTrue);
      final body = JobAlert.body(
        tradeCode: null,
        districtCodes: ['KTM'],
        minWage: ' ',
        frequency: 'weekly',
        isActive: true,
      );
      expect(body, {
        'trade': null,
        'districts': ['KTM'],
        'min_wage': null,
        'frequency': 'weekly',
        'is_active': true,
      });
    });
  });

  group('preferences', () {
    test('worker profile reads preferred districts (refs or codes) and prefs', () {
      final p = WorkerProfile.fromJson(workerPrefsJson);
      expect(p.preferredDistricts.map((d) => d.code), ['KTM', 'LTP']);
      expect(p.preferredDistricts.first.name('ne'), 'काठमाडौं');
      expect(p.serviceRadiusKm, 25);
      expect(p.expectedMonthlyWage, '25000.00');
      expect(p.availableFrom, '2026-11-01');
    });

    test('patch body matches /me/worker contract fields', () {
      final body = preferencesPatch(
        isAvailable: false,
        districtCodes: ['KTM'],
        radiusKm: null,
        expectedWage: '',
        availableFrom: DateTime(2026, 11, 1),
      );
      expect(body, {
        'is_available': false,
        'preferred_districts': ['KTM'],
        'service_radius_km': null,
        'expected_monthly_wage': null,
        'available_from': '2026-11-01',
      });
    });

    test('districts parse with province', () {
      final d = districtsJson.map(District.fromJson).toList();
      expect(d.first.province, 3);
      expect(d.last.name('ne'), 'कास्की');
    });
  });

  group('support', () {
    test('cases and messages; internal notes are dropped', () {
      final c = SupportCase.fromJson(resultsOf(supportCasesJson).first);
      expect(c.number, 'KS-000012');
      expect(c.status, 'pending_user');
      final msgs = visibleMessages(resultsOf(caseMessagesJson).map((j) => CaseMessage.fromJson(j, meId: 'u1')));
      expect(msgs.map((m) => m.id), ['m1', 'm3']);
      expect(msgs.first.fromStaff, isTrue);
      expect(msgs.first.mine, isFalse);
      expect(msgs.last.mine, isTrue);
    });

    test('safety report body is confidential with the safety category', () {
      final b = safetyReportBody(
        kind: 'harassment',
        subject: 'Harassment or abuse',
        description: ' x ',
        emergency: true,
        anonymous: false,
      );
      expect(b['category'], 'safety');
      expect(b['safety_kind'], 'harassment');
      expect(b['confidential'], isTrue);
      expect(b['emergency'], isTrue);
      expect(b['description'], 'x');
    });
  });

  group('mobility', () {
    test('documents, server safety guidance and expiry state', () {
      final page = MobilityDocuments.fromJson(mobilityDocsJson);
      expect(page.items, hasLength(2));
      expect(page.guidance?.points('ne'), hasLength(2));
      expect(page.guidance?.dofeUrl, 'https://dofe.gov.np');
      final passport = page.items.first;
      expect(passport.kindGroup, 'travel');
      expect(passport.number, 'PA*****21');
      expect(passport.daysToExpiry(DateTime(2026, 10, 7)), 39);
      expect(passport.expiresSoon(DateTime(2026, 10, 7)), isTrue);
      final medical = page.items.last;
      expect(medical.isExpired(DateTime(2026, 10, 7)), isTrue);
      expect(medical.kindGroup, 'clearance');
    });

    test('new document fields per group', () {
      const travel = MobilityDocInput(kind: 'passport', number: ' PA1 ', issuingCountry: 'NP', documentPath: 'x');
      expect(travel.fields(), {'kind_group': 'travel', 'kind': 'passport', 'number': 'PA1', 'issuing_country': 'NP'});
      const clr = MobilityDocInput(
        kind: 'language_test',
        title: 'EPS-TOPIK',
        issuer: 'HRD Korea',
        scoreOrLevel: '180',
        expiresOn: '2027-01-01',
        documentPath: 'x',
      );
      expect(clr.fields()['kind_group'], 'clearance');
      expect(clr.fields()['score_or_level'], '180');
      expect(clr.fields().containsKey('number'), isFalse);
    });

    test('agencies and shares', () {
      final a = RecruitmentAgency.fromJson(resultsOf(agenciesJson).first);
      expect(a.licenseNo, '1234/070/71');
      expect(a.phone, '014000000');
      final g = ConsentGrant.fromJson(resultsOf(mobilitySharesJson).first);
      expect(g.purpose, 'recruitment');
      expect(g.partner.name, 'Himalayan Manpower Pvt. Ltd.');
      expect(g.isActive(DateTime(2026, 10, 7)), isTrue);
    });
  });

  group('career', () {
    test('sorted by uplift, Nepali text, ks:// links mapped', () {
      final c = CareerSummary.fromJson(careerJson);
      expect(c.trades.single.code, 'mason');
      expect(c.recommendations.first.kind, 'course');
      expect(c.recommendations.last.reasonFor('ne'), 'रोजगारदाताले प्रमाणित कामदारलाई पहिले छान्छन्।');
      expect(careerRoute(c.recommendations.first), Routes.workerTraining);
      expect(careerRoute(c.recommendations.last), Routes.workerProfile);
      expect(
        careerRoute(const CareerRecommendation(kind: 'profile', title: 'x', link: 'ks://work-history')),
        Routes.workerWorkHistory,
      );
    });
  });

  group('timesheets', () {
    test('parses days, totals, over-cap flag', () {
      final t = Timesheet.fromJson(myTimesheetJson);
      expect(t.workerName, 'Ram Bahadur Thapa');
      expect(t.siteName, 'Thamel Main Building');
      expect(t.employmentId, 'e1');
      expect(t.dayFor('2026-10-04')?.overtimeMinutes, 60);
      expect(t.overtimeClaimed, 1500);
      expect(t.overCap, isTrue);
      expect(t.canSubmit, isFalse);
      // Fallback when the server omits over_cap.
      expect(Timesheet.fromJson({'id': 'x', 'overtime_minutes_claimed': 1500}).overCap, isTrue);
    });
  });

  test('employment exposes employer_verified', () {
    expect(MyEmployment.fromJson({...employmentJson, 'employer_verified': true}).employerVerified, isTrue);
    expect(MyEmployment.fromJson(employmentJson).employerVerified, isFalse);
  });

  group('settings, help, legal', () {
    test('notification preferences trim seconds and round-trip', () {
      final p = NotificationPrefs.fromJson(notificationPrefsJson);
      expect(p.pushEnabled, isFalse);
      expect(p.jobAlertFrequency, 'weekly');
      expect(p.quietHoursStart, '21:00');
      expect(p.hasQuietHours, isTrue);
      expect(p.copyWith(quietHoursStart: () => null).hasQuietHours, isFalse);
      expect(p.toJson()['quiet_hours_end'], '07:00');
    });

    test('help articles pick the language with English fallback', () {
      final a = HelpArticle.fromJson(resultsOf(helpArticlesJson).first);
      expect(a.title('ne'), 'हाजिरी कसरी काम गर्छ');
      final full = HelpArticle.fromJson(helpArticleJson);
      expect(full.body('en'), startsWith('# Checking in'));
      expect(helpAudience(AppMode.supervisor), 'employer');
      expect(helpAudience(AppMode.worker), 'worker');
    });

    test('markdown parser: headings, lists, paragraphs', () {
      final blocks = parseMarkdown(helpArticleJson['body_en']!);
      expect(blocks.first, isA<MdHeading>());
      expect(blocks.whereType<MdListItem>(), hasLength(4));
      expect(blocks.whereType<MdListItem>().last.number, '2');
      expect(blocks.whereType<MdParagraph>().single.text, 'Scan the **site QR** code.');
    });

    test('Me.pending_legal blocks navigation until accepted', () {
      final me = Me.fromJson(meWithLegalJson);
      expect(me.pendingLegal.map((d) => d.id), ['L1', 'L2']);
      final s = Session(status: AuthStatus.loggedIn, me: me, mode: AppMode.worker);
      expect(resolveRedirect(location: Routes.workerHome, session: s, language: 'en'), Routes.legal);
      expect(resolveRedirect(location: Routes.legal, session: s, language: 'en'), isNull);
      final done = Session(
        status: AuthStatus.loggedIn,
        me: Me.fromJson({...meWithLegalJson, 'pending_legal': <Object>[]}),
        mode: AppMode.worker,
      );
      expect(resolveRedirect(location: Routes.legal, session: done, language: 'en'), Routes.workerHome);
    });
  });
}
