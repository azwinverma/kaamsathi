import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kaamsathi/core/api/cached.dart';
import 'package:kaamsathi/core/api/json.dart';
import 'package:kaamsathi/core/auth/session.dart';
import 'package:kaamsathi/features/common/roster_models.dart';
import 'package:kaamsathi/features/supervisor/corrections/corrections_queue_screen.dart';
import 'package:kaamsathi/features/supervisor/hajiri/hajiri_providers.dart';
import 'package:kaamsathi/features/supervisor/roster/roster_data.dart';
import 'package:kaamsathi/features/supervisor/roster/ui/roster_week_screen.dart';
import 'package:kaamsathi/features/worker/credentials/credentials_data.dart';
import 'package:kaamsathi/features/worker/credentials/ui/credentials_screen.dart';
import 'package:kaamsathi/features/worker/data/worker_models.dart';
import 'package:kaamsathi/features/worker/data/worker_repository.dart';
import 'package:kaamsathi/features/worker/employment/employment_data.dart';
import 'package:kaamsathi/features/worker/employment/ui/employment_detail_screen.dart';
import 'package:kaamsathi/features/worker/jobs/jobs_data.dart';
import 'package:kaamsathi/features/worker/jobs/ui/jobs_screen.dart';
import 'package:kaamsathi/features/worker/my_hajiri/corrections_data.dart';
import 'package:kaamsathi/features/worker/my_hajiri/ui/corrections_screen.dart';
import 'package:kaamsathi/features/worker/my_hajiri/ui/my_hajiri_screen.dart';
import 'package:kaamsathi/features/worker/profile/ui/completeness_card.dart';
import 'package:kaamsathi/features/worker/profile/ui/languages_screen.dart';
import 'package:kaamsathi/features/worker/talab/ui/payslip_detail_screen.dart';
import 'package:kaamsathi/features/worker/trust/trust_data.dart';
import 'package:kaamsathi/features/worker/trust/ui/dispute_detail_screen.dart';
import 'package:kaamsathi/features/worker/trust/ui/disputes_screen.dart';
import 'package:kaamsathi/features/worker/trust/ui/my_ratings_screen.dart';

import '../fixtures/complete_fixtures.dart';
import 'ext_harness.dart';

List<AttendanceCorrection> _corrections() => resultsOf(correctionsJson).map(AttendanceCorrection.fromJson).toList();
List<Dispute> _disputes() => resultsOf(disputesCompleteJson).map(Dispute.fromJson).toList();
final _profile = workerProfileProvider.overrideWith((ref) async => WorkerProfile.fromJson(workerFullJson));
final _hourlyJob = myEmploymentsProvider.overrideWith((ref) async => [MyEmployment.fromJson(hourlyEmploymentJson)]);

/// (name, screen, overrides with data, overrides with every endpoint off, mode)
typedef _Case = (String, Widget, List<Object>, List<Object>?, AppMode);

final _cases = <_Case>[
  (
    'languages',
    const LanguagesScreen(),
    [_profile],
    [workerProfileProvider.overrideWith((ref) => throw off)],
    AppMode.worker,
  ),
  (
    'profile completeness card',
    const Scaffold(body: SingleChildScrollView(child: ProfileCompletenessCard(maxItems: 8))),
    [_profile],
    null, // hidden when the server has no completeness (asserted below)
    AppMode.worker,
  ),
  (
    'my ratings',
    const MyRatingsScreen(),
    [myRatingsProvider.overrideWith((ref) async => MyRatings.fromJson(myRatingsJson))],
    [myRatingsProvider.overrideWith((ref) => throw off)],
    AppMode.worker,
  ),
  (
    'disputes list (appeal/evidence badges)',
    const DisputesScreen(),
    [disputesProvider.overrideWith((ref) async => _disputes())],
    [disputesProvider.overrideWith((ref) => throw off)],
    AppMode.worker,
  ),
  (
    'dispute detail (appeal open)',
    const DisputeDetailScreen(id: 'd5'),
    [
      disputesProvider.overrideWith((ref) async => _disputes()),
      disputeEvidenceProvider.overrideWith((ref, id) async => evidenceListJson.map(DisputeEvidence.fromJson).toList()),
    ],
    [disputesProvider.overrideWith((ref) => throw off), disputeEvidenceProvider.overrideWith((ref, id) => throw off)],
    AppMode.worker,
  ),
  (
    'dispute detail (appealed, evidence off)',
    const DisputeDetailScreen(id: 'd6'),
    [
      disputesProvider.overrideWith((ref) async => _disputes()),
      disputeEvidenceProvider.overrideWith((ref, id) => throw off),
    ],
    null,
    AppMode.worker,
  ),
  ('add evidence', const AddEvidenceScreen(disputeId: 'd6'), <Object>[], null, AppMode.worker),
  (
    'my corrections',
    const MyCorrectionsScreen(),
    [myCorrectionsProvider.overrideWith((ref) async => _corrections())],
    [myCorrectionsProvider.overrideWith((ref) => throw off)],
    AppMode.worker,
  ),
  (
    'correction request',
    const CorrectionRequestScreen(date: '2026-10-01', currentStatus: 'absent'),
    [_hourlyJob],
    [myEmploymentsProvider.overrideWith((ref) => throw off)],
    AppMode.worker,
  ),
  (
    'my hajiri (tappable days)',
    const MyHajiriScreen(),
    [myAttendanceProvider.overrideWith((ref, key) async => MyAttendanceMonth.fromJson(myAttendanceMonthJson))],
    null,
    AppMode.worker,
  ),
  (
    'credentials (resubmit)',
    const CredentialsScreen(),
    [
      credentialsProvider.overrideWith(
        (ref) async => resultsOf(credentialsResubmitJson).map(Credential.fromJson).toList(),
      ),
    ],
    [credentialsProvider.overrideWith((ref) => throw off)],
    AppMode.worker,
  ),
  (
    'credential resubmit form',
    AddCredentialScreen(resubmit: Credential.fromJson(resultsOf(credentialsResubmitJson).first)),
    <Object>[],
    null,
    AppMode.worker,
  ),
  (
    'applications (interviews, invite)',
    const JobsScreen(initialTab: 2),
    [
      myApplicationsProvider.overrideWith(
        (ref) async => Cached(resultsOf(applicationsWithInterviewsJson).map(MyApplication.fromJson).toList()),
      ),
    ],
    [myApplicationsProvider.overrideWith((ref) => throw off)],
    AppMode.worker,
  ),
  (
    'hourly payslip',
    const PayslipDetailScreen(id: 'ps9'),
    [payslipProvider.overrideWith((ref, id) async => Payslip.fromJson(hourlyPayslipJson)), _hourlyJob],
    null,
    AppMode.worker,
  ),
  (
    'hourly part-time employment',
    const EmploymentDetailScreen(id: 'e2'),
    [_hourlyJob, myContractProvider.overrideWith((ref, id) async => null)],
    null,
    AppMode.worker,
  ),
  (
    'supervisor corrections queue',
    const CorrectionsQueueScreen(),
    [correctionQueueProvider.overrideWith((ref, status) async => _corrections())],
    [correctionQueueProvider.overrideWith((ref, status) => throw off)],
    AppMode.supervisor,
  ),
  (
    'supervisor roster (warnings)',
    const RosterWeekScreen(),
    [
      sitesProvider.overrideWith((ref) async => []),
      orgShiftsProvider.overrideWith(
        (ref) async => [const ShiftRef(id: 'sh-m', name: 'Morning', startTime: '07:00', endTime: '15:00')],
      ),
      rosterWeekProvider.overrideWith((ref, key) async => RosterWeek.fromJson(rosterWithWarningsJson, key.weekStart)),
    ],
    [
      sitesProvider.overrideWith((ref) async => []),
      orgShiftsProvider.overrideWith((ref) => throw off),
      rosterWeekProvider.overrideWith((ref, key) => throw off),
    ],
    AppMode.supervisor,
  ),
];

void main() {
  for (final lang in ['en', 'ne']) {
    for (final (name, screen, data, offOverrides, mode) in _cases) {
      testWidgets('$name renders with data at 360px ($lang)', (tester) async {
        await pumpScreen(tester, screen, data, lang: lang, mode: mode);
        expect(tester.takeException(), isNull);
        final scrollables = find.byType(Scrollable);
        if (scrollables.evaluate().isNotEmpty) {
          await tester.drag(scrollables.first, const Offset(0, -2000));
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);
        }
      });

      if (offOverrides != null) {
        testWidgets('$name: calm when the backend is off ($lang)', (tester) async {
          await pumpScreen(tester, screen, offOverrides, lang: lang, mode: mode);
          expect(tester.takeException(), isNull);
          // Correction form: no job list → the "needs a job" note instead.
          if (screen is CorrectionRequestScreen) {
            expect(find.byKey(const Key('corr_no_job')), findsOneWidget);
          } else {
            expect(find.text(lang == 'ne' ? comingSoonNe : comingSoonEn), findsWidgets);
          }
        });
      }
    }

    testWidgets('completeness card hidden without server data ($lang)', (tester) async {
      await pumpScreen(tester, const Scaffold(body: ProfileCompletenessCard()), [
        workerProfileProvider.overrideWith((ref) => throw off),
      ], lang: lang);
      expect(find.byKey(const Key('profile_completeness')), findsNothing);
      expect(tester.takeException(), isNull);
    });

    testWidgets('completeness card lists open items with labels ($lang)', (tester) async {
      await pumpScreen(tester, const Scaffold(body: ProfileCompletenessCard(maxItems: 8)), [_profile], lang: lang);
      expect(find.byKey(const Key('compl_photo')), findsOneWidget);
      expect(find.byKey(const Key('compl_verified_credential')), findsOneWidget);
      expect(find.byKey(const Key('compl_payment_details')), findsOneWidget);
      expect(find.byKey(const Key('compl_languages')), findsNothing);
      expect(find.text(lang == 'ne' ? '६३% पूरा' : '63% complete'), findsOneWidget);
    });

    testWidgets('hajiri day sheet offers "Request a correction" ($lang)', (tester) async {
      await pumpScreen(tester, const MyHajiriScreen(), [
        myAttendanceProvider.overrideWith((ref, key) async => MyAttendanceMonth.fromJson(myAttendanceMonthJson)),
      ], lang: lang);
      await tester.tap(find.byKey(const Key('hajiri_day_2')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('corr_request_btn')), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
}
