import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kaamsathi/core/api/cached.dart';
import 'package:kaamsathi/core/api/json.dart';
import 'package:kaamsathi/core/auth/session.dart';
import 'package:kaamsathi/features/common/inbox/inbox_data.dart';
import 'package:kaamsathi/features/common/inbox/inbox_screen.dart';
import 'package:kaamsathi/features/common/inbox/notification_prefs.dart';
import 'package:kaamsathi/features/common/legal/legal_screen.dart';
import 'package:kaamsathi/features/common/ref_data.dart';
import 'package:kaamsathi/features/common/security/security_data.dart';
import 'package:kaamsathi/features/common/security/security_screen.dart';
import 'package:kaamsathi/features/common/support/help_center.dart';
import 'package:kaamsathi/features/common/support/safety_report_screen.dart';
import 'package:kaamsathi/features/common/support/support_data.dart';
import 'package:kaamsathi/features/common/support/support_screen.dart';
import 'package:kaamsathi/features/common/timesheet_models.dart';
import 'package:kaamsathi/features/supervisor/hajiri/hajiri_providers.dart';
import 'package:kaamsathi/features/supervisor/timesheets/timesheets_data.dart';
import 'package:kaamsathi/features/supervisor/timesheets/ui/timesheets_screen.dart';
import 'package:kaamsathi/features/worker/career/career_data.dart';
import 'package:kaamsathi/features/worker/career/ui/career_screen.dart';
import 'package:kaamsathi/features/worker/data/worker_models.dart';
import 'package:kaamsathi/features/worker/data/worker_repository.dart';
import 'package:kaamsathi/features/worker/experience/experience_data.dart';
import 'package:kaamsathi/features/worker/experience/ui/work_history_screen.dart';
import 'package:kaamsathi/features/worker/jobs/jobs_data.dart';
import 'package:kaamsathi/features/worker/jobs/ui/job_alerts_screen.dart';
import 'package:kaamsathi/features/worker/jobs/ui/jobs_screen.dart';
import 'package:kaamsathi/features/worker/jobs/ui/offers.dart';
import 'package:kaamsathi/features/worker/mobility/mobility_data.dart';
import 'package:kaamsathi/features/worker/mobility/ui/mobility_screen.dart';
import 'package:kaamsathi/features/worker/money/money_data.dart';
import 'package:kaamsathi/features/worker/preferences/availability_screen.dart';
import 'package:kaamsathi/features/worker/timesheets/my_timesheets_data.dart';
import 'package:kaamsathi/features/worker/timesheets/ui/my_timesheets_screen.dart';

import '../fixtures/ext_fixtures.dart';
import 'ext_harness.dart';

List<District> _districts() => districtsJson.map(District.fromJson).toList();

final _refOverrides = <Object>[
  tradesProvider.overrideWith((ref) async => <Trade>[const Trade(code: 'mason', nameEn: 'Mason', nameNe: 'डकर्मी')]),
  districtsProvider.overrideWith((ref) async => _districts()),
];

/// (name, screen, overrides with data, overrides with every endpoint off, supervisor?)
typedef _Case = (String, Widget, List<Object>, List<Object>?, AppMode);

final _cases = <_Case>[
  (
    'inbox',
    const InboxScreen(),
    [
      notificationsProvider.overrideWith(
        (ref) async => resultsOf(notificationsJson).map(AppNotification.fromJson).toList(),
      ),
    ],
    [notificationsProvider.overrideWith((ref) => throw off)],
    AppMode.worker,
  ),
  (
    'login & security',
    const SecurityScreen(),
    [sessionsProvider.overrideWith((ref) async => sortSessions(sessionsJson.map(SessionDevice.fromJson)))],
    [sessionsProvider.overrideWith((ref) => throw off)],
    AppMode.worker,
  ),
  (
    'help & support',
    const SupportScreen(),
    [supportCasesProvider.overrideWith((ref) async => resultsOf(supportCasesJson).map(SupportCase.fromJson).toList())],
    [supportCasesProvider.overrideWith((ref) => throw off)],
    AppMode.worker,
  ),
  (
    'support thread',
    const SupportThreadScreen(id: 'c1'),
    [
      supportCasesProvider.overrideWith((ref) async => resultsOf(supportCasesJson).map(SupportCase.fromJson).toList()),
      caseMessagesProvider.overrideWith(
        (ref, id) async => resultsOf(caseMessagesJson).map((j) => CaseMessage.fromJson(j, meId: 'u1')).toList(),
      ),
    ],
    [supportCasesProvider.overrideWith((ref) => throw off), caseMessagesProvider.overrideWith((ref, id) => throw off)],
    AppMode.worker,
  ),
  ('new support case', const NewSupportCaseScreen(), <Object>[], null, AppMode.worker),
  ('safety report', const SafetyReportScreen(), <Object>[], null, AppMode.worker),
  (
    'help center',
    const HelpCenterScreen(),
    [
      helpArticlesProvider.overrideWith(
        (ref, q) async => resultsOf(helpArticlesJson).map(HelpArticle.fromJson).toList(),
      ),
    ],
    [helpArticlesProvider.overrideWith((ref, q) => throw off)],
    AppMode.worker,
  ),
  (
    'help article',
    const HelpArticleScreen(slug: 'how-hajiri-works'),
    [helpArticleProvider.overrideWith((ref, slug) async => HelpArticle.fromJson(helpArticleJson))],
    [helpArticleProvider.overrideWith((ref, slug) => throw off)],
    AppMode.worker,
  ),
  (
    'notification settings',
    const NotificationPrefsScreen(),
    [notificationPrefsProvider.overrideWith((ref) async => NotificationPrefs.fromJson(notificationPrefsJson))],
    [notificationPrefsProvider.overrideWith((ref) => throw off)],
    AppMode.worker,
  ),
  (
    'work history',
    const WorkHistoryScreen(),
    [
      workHistoryProvider.overrideWith(
        (ref) async => resultsOf(workHistoryJson).map(WorkHistoryEntry.fromJson).toList(),
      ),
    ],
    [workHistoryProvider.overrideWith((ref) => throw off)],
    AppMode.worker,
  ),
  (
    'work history form',
    WorkHistoryFormScreen(entry: WorkHistoryEntry.fromJson(resultsOf(workHistoryJson).last)),
    _refOverrides,
    null,
    AppMode.worker,
  ),
  (
    'jobs for you',
    const JobsScreen(),
    [
      recommendedJobsProvider.overrideWith(
        (ref) async => resultsOf(recommendedJobsJson).map(JobSummary.fromJson).toList(),
      ),
    ],
    [recommendedJobsProvider.overrideWith((ref) => throw off)],
    AppMode.worker,
  ),
  (
    'job offers',
    const JobsScreen(initialTab: 1),
    [jobOffersProvider.overrideWith((ref) async => resultsOf(jobOffersJson).map(JobOffer.fromJson).toList())],
    [jobOffersProvider.overrideWith((ref) => throw off)],
    AppMode.worker,
  ),
  (
    'my applications',
    const JobsScreen(initialTab: 2),
    [
      myApplicationsProvider.overrideWith(
        (ref) async => Cached(resultsOf(applicationsJson).map(MyApplication.fromJson).toList(), fromCache: true),
      ),
    ],
    [myApplicationsProvider.overrideWith((ref) => throw off)],
    AppMode.worker,
  ),
  (
    'offer accept',
    OfferAcceptScreen(offer: JobOffer.fromJson(resultsOf(jobOffersJson).first)),
    <Object>[],
    null,
    AppMode.worker,
  ),
  (
    'job alerts',
    const JobAlertsScreen(),
    [
      jobAlertsProvider.overrideWith((ref) async => resultsOf(jobAlertsJson).map(JobAlert.fromJson).toList()),
      ..._refOverrides,
    ],
    [jobAlertsProvider.overrideWith((ref) => throw off), ..._refOverrides],
    AppMode.worker,
  ),
  (
    'job alert form',
    JobAlertFormScreen(alert: JobAlert.fromJson(resultsOf(jobAlertsJson).first)),
    _refOverrides,
    null,
    AppMode.worker,
  ),
  (
    'availability & areas',
    const AvailabilityScreen(),
    [workerProfileProvider.overrideWith((ref) async => WorkerProfile.fromJson(workerPrefsJson)), ..._refOverrides],
    [workerProfileProvider.overrideWith((ref) => throw off), ..._refOverrides],
    AppMode.worker,
  ),
  (
    'district picker',
    DistrictPickerScreen(selected: _districts().take(1).toList()),
    _refOverrides,
    [districtsProvider.overrideWith((ref) => throw off)],
    AppMode.worker,
  ),
  (
    'mobility documents',
    const MobilityScreen(),
    [
      mobilityDocumentsProvider.overrideWith((ref) async => Cached(MobilityDocuments.fromJson(mobilityDocsJson))),
      mobilityAgenciesProvider.overrideWith(
        (ref) async => resultsOf(agenciesJson).map(RecruitmentAgency.fromJson).toList(),
      ),
      mobilitySharesProvider.overrideWith(
        (ref) async => resultsOf(mobilitySharesJson).map(ConsentGrant.fromJson).toList(),
      ),
    ],
    [
      mobilityDocumentsProvider.overrideWith((ref) => throw off),
      mobilityAgenciesProvider.overrideWith((ref) => throw off),
      mobilitySharesProvider.overrideWith((ref) => throw off),
    ],
    AppMode.worker,
  ),
  (
    'add mobility document',
    const AddMobilityDocScreen(),
    [mobilityDocumentsProvider.overrideWith((ref) async => Cached(MobilityDocuments.fromJson(mobilityDocsJson)))],
    null, // a form: nothing to load (safety guidance with the backend off is covered in the flow tests)
    AppMode.worker,
  ),
  (
    'career',
    const CareerScreen(),
    [careerProvider.overrideWith((ref) async => Cached(CareerSummary.fromJson(careerJson)))],
    [careerProvider.overrideWith((ref) => throw off)],
    AppMode.worker,
  ),
  (
    'my timesheets',
    const MyTimesheetsScreen(),
    [
      myTimesheetsProvider.overrideWith((ref, w) async => Cached([Timesheet.fromJson(myTimesheetJson)])),
    ],
    [myTimesheetsProvider.overrideWith((ref, w) => throw off)],
    AppMode.worker,
  ),
  (
    'supervisor timesheets',
    const TimesheetsScreen(),
    [
      sitesProvider.overrideWith((ref) async => []),
      orgTimesheetsProvider.overrideWith(
        (ref, key) async => [
          Timesheet.fromJson({...myTimesheetJson, 'status': 'draft'}),
          Timesheet.fromJson({...myTimesheetJson, 'id': 't2', 'status': 'draft', 'over_cap': false}),
        ],
      ),
    ],
    [sitesProvider.overrideWith((ref) async => []), orgTimesheetsProvider.overrideWith((ref, key) => throw off)],
    AppMode.supervisor,
  ),
];

void main() {
  for (final lang in ['en', 'ne']) {
    for (final (name, screen, data, offOverrides, mode) in _cases) {
      testWidgets('$name renders with data at 360px ($lang)', (tester) async {
        await pumpScreen(tester, screen, data, lang: lang, mode: mode);
        expect(tester.takeException(), isNull);
        // Scroll through so lazily built rows overflow-check too.
        final scrollables = find.byType(Scrollable);
        if (scrollables.evaluate().isNotEmpty) {
          await tester.drag(scrollables.first, const Offset(0, -2000));
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);
        }
      });

      if (offOverrides != null) {
        testWidgets('$name: calm "coming soon" when the backend is off ($lang)', (tester) async {
          await pumpScreen(tester, screen, offOverrides, lang: lang, mode: mode);
          expect(tester.takeException(), isNull);
          expect(find.text(lang == 'ne' ? comingSoonNe : comingSoonEn), findsWidgets);
        });
      }
    }

    testWidgets('legal acceptance renders at 360px ($lang)', (tester) async {
      await pumpScreen(tester, const LegalScreen(), [], lang: lang, meJson: meWithLegalJson);
      expect(tester.takeException(), isNull);
      expect(find.text('https://kaamsathi.com/legal/terms'), findsOneWidget);
    });
  }
}
