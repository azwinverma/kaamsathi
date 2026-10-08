import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kaamsathi/core/api/cached.dart';
import 'package:kaamsathi/core/api/json.dart';
import 'package:kaamsathi/core/auth/session.dart';
import 'package:kaamsathi/core/flags.dart';
import 'package:kaamsathi/core/providers.dart';
import 'package:kaamsathi/core/storage/prefs.dart';
import 'package:kaamsathi/core/widgets/photo_picker.dart';
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
import 'package:kaamsathi/features/worker/profile/ui/languages_screen.dart';
import 'package:kaamsathi/features/worker/talab/ui/payslip_detail_screen.dart';
import 'package:kaamsathi/features/worker/trust/trust_data.dart';
import 'package:kaamsathi/features/worker/trust/ui/dispute_detail_screen.dart';
import 'package:kaamsathi/features/worker/trust/ui/my_ratings_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../fixtures/complete_fixtures.dart';
import '../fixtures/eco_fixtures.dart' show employmentJson;
import 'ext_harness.dart';

class _FakeWorkerRepo implements WorkerRepository {
  final patches = <Json>[];

  @override
  Future<WorkerProfile> updateProfile(Map<String, dynamic> patch) async {
    patches.add(patch);
    return WorkerProfile.fromJson({...workerFullJson, ...patch});
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

class _FakeTrust implements TrustRepository {
  final uploads = <(String, String, String?)>[];
  final appeals = <(String, String)>[];
  final flags = <(String, String)>[];

  @override
  Future<DisputeEvidence> addEvidence(String disputeId, {required String path, String? note}) async {
    uploads.add((disputeId, path, note));
    return DisputeEvidence.fromJson(evidenceListJson.first);
  }

  @override
  Future<Dispute> appeal(String disputeId, String reason) async {
    appeals.add((disputeId, reason));
    return Dispute.fromJson(resultsOf(disputesCompleteJson).first);
  }

  @override
  Future<void> flagRating(String ratingId, String reason) async => flags.add((ratingId, reason));

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

class _FakeCorrections implements CorrectionsRepository {
  final requests = <Json>[];
  final approved = <(String, String?)>[];
  final rejected = <(String, String)>[];

  @override
  Future<void> request(Json body) async => requests.add(body);

  @override
  Future<void> approve(String id, {String? note}) async => approved.add((id, note));

  @override
  Future<void> reject(String id, {required String note}) async => rejected.add((id, note));

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

class _FakeRoster implements RosterRepository {
  final cells = <(String, String, String?, bool)>[];

  @override
  Future<RosterSaveResult> setCell({
    required String employmentId,
    required String date,
    String? shiftId,
    String? siteId,
    required bool isOff,
  }) async {
    cells.add((employmentId, date, shiftId, isOff));
    return RosterSaveResult.fromJson(rosterSaveJson);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

class _FakeCredentials implements CredentialsRepository {
  final resubmits = <(String, Map<String, Object>, String?)>[];

  @override
  Future<void> resubmit(String id, Map<String, Object> fields, {String? documentPath}) async =>
      resubmits.add((id, fields, documentPath));

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

class _FakeJobs implements JobsRepository {
  final responses = <(String, bool)>[];

  @override
  Future<void> respond(String applicationId, {required bool interested, String? note}) async =>
      responses.add((applicationId, interested));

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

List<Dispute> _disputes() => resultsOf(disputesCompleteJson).map(Dispute.fromJson).toList();

/// A > 10 MB file for the evidence size check (created outside fake async).
late final File _bigFile;

void main() {
  setUpAll(() {
    final dir = Directory.systemTemp.createTempSync('ks_big');
    _bigFile = File('${dir.path}/big.jpg')..writeAsBytesSync(List.filled(evidenceMaxBytes + 1, 0));
  });
  tearDownAll(() => _bigFile.parent.deleteSync(recursive: true));

  testWidgets('languages editor sends the whole replaced list', (tester) async {
    final fake = _FakeWorkerRepo();
    await pumpScreen(tester, const LanguagesScreen(), [
      workerProfileProvider.overrideWith((ref) async => WorkerProfile.fromJson(workerFullJson)),
      workerRepositoryProvider.overrideWithValue(fake),
    ]);
    expect(find.text('Nepali'), findsOneWidget);
    expect(find.text('Hindi'), findsOneWidget);

    await tester.tap(find.byKey(const Key('prof_hi_fluent')));
    await tester.tap(find.byKey(const Key('lang_remove_ne')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('lang_add')));
    await tester.pumpAndSettle();
    // Already chosen languages are not offered again.
    expect(find.byKey(const Key('lang_pick_hi')), findsNothing);
    await tester.ensureVisible(find.byKey(const Key('lang_pick_ko')));
    await tester.tap(find.byKey(const Key('lang_pick_ko')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('prof_ko_basic')));
    await tester.ensureVisible(find.byKey(const Key('lang_save')));
    await tester.tap(find.byKey(const Key('lang_save')));
    await tester.pumpAndSettle();

    expect(fake.patches, [
      {
        'languages': [
          {'language': 'hi', 'proficiency': 'fluent'},
          {'language': 'ko', 'proficiency': 'basic'},
        ],
      },
    ]);
    expect(find.text('Languages saved.'), findsOneWidget);
  });

  testWidgets('languages editor in Nepali shows Nepali names', (tester) async {
    await pumpScreen(tester, const LanguagesScreen(), [
      workerProfileProvider.overrideWith((ref) async => WorkerProfile.fromJson(workerFullJson)),
    ], lang: 'ne');
    expect(find.text('नेपाली'), findsOneWidget);
    expect(find.text('हिन्दी'), findsOneWidget);
    expect(find.text('मातृभाषा'), findsWidgets);
  });

  group('dispute evidence', () {
    testWidgets('picks a photo, adds a note and uploads it to the dispute', (tester) async {
      final fake = _FakeTrust();
      await pumpScreen(tester, const AddEvidenceScreen(disputeId: 'd6'), [
        trustRepositoryProvider.overrideWithValue(fake),
        photoPickProvider.overrideWithValue((source) async => '/nonexistent/ev.jpg'),
      ]);
      final upload = find.byKey(const Key('evidence_upload'));
      expect(tester.widget<FilledButton>(upload).onPressed, isNull);
      await tester.tap(find.byKey(const Key('photo_camera')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('evidence_note')), 'Register page for 1 Asoj');
      await tester.ensureVisible(upload);
      await tester.tap(upload);
      await tester.pumpAndSettle();
      expect(fake.uploads, [('d6', '/nonexistent/ev.jpg', 'Register page for 1 Asoj')]);
    });

    testWidgets('files over 10 MB are refused before upload', (tester) async {
      final fake = _FakeTrust();
      await pumpScreen(tester, const AddEvidenceScreen(disputeId: 'd6'), [
        trustRepositoryProvider.overrideWithValue(fake),
        photoPickProvider.overrideWithValue((source) async => _bigFile.path),
      ]);
      await tester.tap(find.byKey(const Key('photo_gallery')));
      await tester.pumpAndSettle();
      expect(find.text('This file is too large (max 10 MB).'), findsOneWidget);
      expect(tester.widget<FilledButton>(find.byKey(const Key('evidence_upload'))).onPressed, isNull);
      expect(fake.uploads, isEmpty);
    });

    testWidgets('detail lists evidence; add button only while the case is open', (tester) async {
      await pumpScreen(tester, const DisputeDetailScreen(id: 'd6'), [
        disputesProvider.overrideWith((ref) async => _disputes()),
        disputeEvidenceProvider.overrideWith(
          (ref, id) async => evidenceListJson.map(DisputeEvidence.fromJson).toList(),
        ),
      ]);
      expect(find.text('Photo of the OT register'), findsOneWidget);
      expect(find.text('PDF document'), findsOneWidget);
      expect(find.byKey(const Key('evidence_add')), findsOneWidget);
      expect(find.text('Appealed'), findsOneWidget);

      await pumpScreen(tester, const DisputeDetailScreen(id: 'd5'), [
        disputesProvider.overrideWith((ref) async => _disputes()),
        disputeEvidenceProvider.overrideWith((ref, id) async => const <DisputeEvidence>[]),
      ]);
      expect(find.byKey(const Key('evidence_add')), findsNothing); // rejected: closed for evidence
    });
  });

  group('appeal', () {
    List<Object> overrides(_FakeTrust fake) => [
      disputesProvider.overrideWith((ref) async => _disputes()),
      disputeEvidenceProvider.overrideWith((ref, id) async => const <DisputeEvidence>[]),
      trustRepositoryProvider.overrideWithValue(fake),
    ];

    testWidgets('shown with the deadline when can_appeal; sends the reason', (tester) async {
      final fake = _FakeTrust();
      await pumpScreen(tester, const DisputeDetailScreen(id: 'd5'), overrides(fake));
      expect(find.byKey(const Key('appeal_deadline')), findsOneWidget);
      expect(find.textContaining('You can appeal until'), findsOneWidget);
      await tester.ensureVisible(find.byKey(const Key('appeal_button')));
      await tester.tap(find.byKey(const Key('appeal_button')));
      await tester.pumpAndSettle();
      final confirm = find.byKey(const Key('appeal_confirm'));
      expect(tester.widget<FilledButton>(confirm).onPressed, isNull);
      await tester.enterText(find.byKey(const Key('appeal_reason')), 'I have the OT approval slip.');
      await tester.pumpAndSettle();
      await tester.tap(confirm);
      await tester.pumpAndSettle();
      expect(fake.appeals, [('d5', 'I have the OT approval slip.')]);
      expect(find.text('Appeal sent.'), findsOneWidget);
    });

    testWidgets('hidden when can_appeal is false; an existing appeal shows its state', (tester) async {
      await pumpScreen(tester, const DisputeDetailScreen(id: 'd7'), overrides(_FakeTrust()));
      expect(find.byKey(const Key('appeal_button')), findsNothing);
      expect(find.byKey(const Key('appeal_card')), findsNothing);

      await pumpScreen(tester, const DisputeDetailScreen(id: 'd6'), overrides(_FakeTrust()));
      expect(find.byKey(const Key('appeal_button')), findsNothing);
      expect(find.text('Waiting for review'), findsOneWidget);
      expect(find.text('The register photo shows my signature.'), findsOneWidget);
    });

    testWidgets('hidden when the server switches the appeal flag off', (tester) async {
      await pumpScreen(tester, const DisputeDetailScreen(id: 'd5'), [
        ...overrides(_FakeTrust()),
        flagOnProvider.overrideWith((ref, key) => key != FlagKeys.disputeAppeal),
      ]);
      expect(find.byKey(const Key('appeal_button')), findsNothing);
      expect(find.byKey(const Key('evidence_card')), findsOneWidget);
    });
  });

  group('attendance correction request', () {
    testWidgets('sends employment, date, requested status and reason', (tester) async {
      final fake = _FakeCorrections();
      await pumpScreen(tester, const CorrectionRequestScreen(date: '2026-10-01', currentStatus: 'absent'), [
        correctionsRepositoryProvider.overrideWithValue(fake),
        myEmploymentsProvider.overrideWith((ref) async => [MyEmployment.fromJson(employmentJson)]),
      ]);
      expect(find.text('Recorded: Absent'), findsOneWidget);
      final submit = find.byKey(const Key('corr_submit'));
      expect(tester.widget<FilledButton>(submit).onPressed, isNull);
      // The current status cannot be requested again.
      expect(tester.widget<ChoiceChip>(find.byKey(const Key('corr_status_absent'))).onSelected, isNull);

      await tester.tap(find.byKey(const Key('corr_status_present')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('corr_check_in')), findsOneWidget);
      await tester.enterText(find.byKey(const Key('corr_reason')), 'QR did not scan');
      await tester.ensureVisible(submit);
      await tester.tap(submit);
      await tester.pumpAndSettle();
      expect(fake.requests, [
        {'employment_id': 'e1', 'date': '2026-10-01', 'requested_status': 'present', 'reason': 'QR did not scan'},
      ]);
    });

    testWidgets('no job on that day: explains and cannot submit (ne)', (tester) async {
      await pumpScreen(tester, const CorrectionRequestScreen(date: '2025-12-01', currentStatus: null), [
        correctionsRepositoryProvider.overrideWithValue(_FakeCorrections()),
        myEmploymentsProvider.overrideWith((ref) async => [MyEmployment.fromJson(employmentJson)]),
      ], lang: 'ne');
      expect(find.byKey(const Key('corr_no_job')), findsOneWidget);
      await tester.tap(find.byKey(const Key('corr_status_present')));
      await tester.pumpAndSettle();
      expect(tester.widget<FilledButton>(find.byKey(const Key('corr_submit'))).onPressed, isNull);
    });
  });

  group('supervisor corrections queue', () {
    List<Object> overrides(_FakeCorrections fake) => [
      correctionsRepositoryProvider.overrideWithValue(fake),
      correctionQueueProvider.overrideWith((ref, status) async {
        final all = resultsOf(correctionsJson).map(AttendanceCorrection.fromJson).toList();
        return status == 'pending' ? all.where((c) => c.isPending).toList() : all.where((c) => !c.isPending).toList();
      }),
    ];

    testWidgets('approve with an optional note removes it from the queue', (tester) async {
      final fake = _FakeCorrections();
      await pumpScreen(tester, const CorrectionsQueueScreen(), overrides(fake), mode: AppMode.supervisor);
      expect(find.text('Ram Bahadur Thapa'), findsOneWidget);
      expect(find.text('Absent → Present'), findsOneWidget);
      await tester.tap(find.byKey(const Key('approve_ac1')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('decision_confirm')));
      await tester.pumpAndSettle();
      expect(fake.approved, [('ac1', '')]);
      expect(find.byKey(const Key('queue_ac1')), findsNothing);
      expect(find.text('Approved. Hajiri updated.'), findsOneWidget);
    });

    testWidgets('reject needs a note for the worker', (tester) async {
      final fake = _FakeCorrections();
      await pumpScreen(tester, const CorrectionsQueueScreen(), overrides(fake), mode: AppMode.supervisor);
      await tester.tap(find.byKey(const Key('reject_ac1')));
      await tester.pumpAndSettle();
      final confirm = find.byKey(const Key('decision_confirm'));
      expect(tester.widget<FilledButton>(confirm).onPressed, isNull);
      await tester.enterText(find.byKey(const Key('decision_note')), 'Register shows absent');
      await tester.pumpAndSettle();
      await tester.tap(confirm);
      await tester.pumpAndSettle();
      expect(fake.rejected, [('ac1', 'Register shows absent')]);
    });

    testWidgets('decided tab shows the outcome and note', (tester) async {
      await pumpScreen(tester, const CorrectionsQueueScreen(), overrides(_FakeCorrections()), mode: AppMode.supervisor);
      await tester.tap(find.text('Decided'));
      await tester.pumpAndSettle();
      expect(find.text('Note: No leave request on file.'), findsOneWidget);
      expect(find.byKey(const Key('approve_ac2')), findsNothing);
    });
  });

  testWidgets('ratings: averages, moderation badges, flag a comment', (tester) async {
    final fake = _FakeTrust();
    await pumpScreen(tester, const MyRatingsScreen(), [
      myRatingsProvider.overrideWith((ref) async => MyRatings.fromJson(myRatingsJson)),
      trustRepositoryProvider.overrideWithValue(fake),
    ]);
    expect(find.text('Average 3.5 · 2 ratings'), findsOneWidget);
    expect(find.text('Comment hidden by KaamSathi'), findsOneWidget);
    expect(find.text('Not counted'), findsOneWidget);
    expect(find.byKey(const Key('flag_r2')), findsNothing);
    await tester.tap(find.byKey(const Key('flag_r1')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('flag_reason')), 'I was never late');
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('flag_confirm')));
    await tester.pumpAndSettle();
    expect(fake.flags, [('r1', 'I was never late')]);
    expect(find.text('Under review'), findsOneWidget);
    expect(find.byKey(const Key('flag_r1')), findsNothing);

    await tester.tap(find.text('Given by me'));
    await tester.pumpAndSettle();
    expect(find.text('“Salary always paid on the 1st.”'), findsOneWidget);
  });

  testWidgets('credential resubmit pre-fills and sends only changes', (tester) async {
    final fake = _FakeCredentials();
    final c = Credential.fromJson(resultsOf(credentialsResubmitJson).first);
    await pumpScreen(tester, AddCredentialScreen(resubmit: c), [credentialsRepositoryProvider.overrideWithValue(fake)]);
    expect(find.text('Resubmit certificate'), findsOneWidget);
    expect(find.textContaining('Earlier reason: Photo is blurry.'), findsOneWidget);
    await tester.enterText(find.widgetWithText(TextFormField, 'NSTB-999'), 'NSTB-1000');
    await tester.ensureVisible(find.byKey(const Key('credential_save')));
    await tester.tap(find.byKey(const Key('credential_save')));
    await tester.pumpAndSettle();
    expect(fake.resubmits, hasLength(1));
    final (id, fields, doc) = fake.resubmits.single;
    expect(id, 'cr2');
    expect(fields, {'certificate_no': 'NSTB-1000'});
    expect(doc, isNull);
  });

  testWidgets('credentials list: resubmit button and resubmission link', (tester) async {
    await pumpScreen(tester, const CredentialsScreen(), [
      credentialsProvider.overrideWith(
        (ref) async => resultsOf(credentialsResubmitJson).map(Credential.fromJson).toList(),
      ),
    ]);
    expect(find.byKey(const Key('resubmit_cr2')), findsOneWidget);
    expect(find.byKey(const Key('resubmit_cr3')), findsNothing);
    expect(find.byKey(const Key('resubmission_of_cr3')), findsOneWidget);
    expect(find.text('Earlier reason: Expired certificate.'), findsOneWidget);
  });

  testWidgets('applications: employer invite badge, interviews, confirm still works', (tester) async {
    final fake = _FakeJobs();
    await pumpScreen(tester, const JobsScreen(initialTab: 2), [
      jobsRepositoryProvider.overrideWithValue(fake),
      myApplicationsProvider.overrideWith(
        (ref) async => Cached(resultsOf(applicationsWithInterviewsJson).map(MyApplication.fromJson).toList()),
      ),
    ]);
    expect(find.byKey(const Key('invited_a3')), findsOneWidget);
    expect(find.byKey(const Key('invited_a4')), findsNothing);
    expect(find.byKey(const Key('interview_iv1')), findsOneWidget);
    expect(find.text('Skill test'), findsOneWidget);
    expect(find.text('Place: Thamel kitchen, 2nd floor'), findsOneWidget);
    expect(find.text('With Head chef'), findsOneWidget);
    expect(find.text('Passed'), findsOneWidget);
    await tester.ensureVisible(find.byKey(const Key('confirm_a3')));
    await tester.tap(find.byKey(const Key('confirm_a3')));
    await tester.pumpAndSettle();
    expect(fake.responses, [('a3', true)]);
  });

  testWidgets('hourly payslip shows regular hours and the hourly rate', (tester) async {
    await pumpScreen(tester, const PayslipDetailScreen(id: 'ps9'), [
      payslipProvider.overrideWith((ref, id) async => Payslip.fromJson(hourlyPayslipJson)),
      myEmploymentsProvider.overrideWith((ref) async => [MyEmployment.fromJson(hourlyEmploymentJson)]),
    ]);
    expect(find.byKey(const Key('payslip_regular_hours')), findsOneWidget);
    expect(find.text('96'), findsOneWidget);
    expect(find.text('Rs. 120 per hour'), findsOneWidget);
  });

  testWidgets('employment detail: hourly wage and part-time (ne)', (tester) async {
    await pumpScreen(tester, const EmploymentDetailScreen(id: 'e2'), [
      myEmploymentsProvider.overrideWith((ref) async => [MyEmployment.fromJson(hourlyEmploymentJson)]),
      myContractProvider.overrideWith((ref, id) async => null),
    ], lang: 'ne');
    expect(find.text('प्रति घण्टा रु. १२०'), findsOneWidget);
    expect(find.text('आंशिक समय'), findsOneWidget);
  });

  testWidgets('roster: warning marks, labels in the sheet, "N workers notified"', (tester) async {
    final fake = _FakeRoster();
    await pumpScreen(tester, const RosterWeekScreen(), [
      sitesProvider.overrideWith((ref) async => []),
      orgShiftsProvider.overrideWith(
        (ref) async => [const ShiftRef(id: 'sh-m', name: 'Morning', startTime: '07:00', endTime: '15:00')],
      ),
      rosterWeekProvider.overrideWith((ref, key) async => RosterWeek.fromJson(rosterWithWarningsJson, key.weekStart)),
      rosterRepositoryProvider.overrideWithValue(fake),
    ], mode: AppMode.supervisor);
    final mark = find.byKey(const Key('roster_warn_e1_2026-10-05'));
    expect(mark, findsOneWidget);
    expect(find.text('! = check this day'), findsOneWidget);
    await tester.tap(mark);
    await tester.pumpAndSettle();
    expect(find.text('On approved leave'), findsOneWidget);
    expect(find.text('Rostered at another workplace'), findsOneWidget);
    await tester.tap(find.text('Morning · 7:00 AM – 3:00 PM'));
    await tester.pumpAndSettle();
    expect(fake.cells, [('e1', '2026-10-05', 'sh-m', false)]);
    expect(find.textContaining('Saved · 1 workers notified'), findsOneWidget);
    expect(find.textContaining('Ram is on leave this day.'), findsOneWidget);
  });

  test('feature flags start from the cached copy; unknown keys stay on', () async {
    SharedPreferences.setMockInitialValues({'cache:feature_flags': '{"flags": {"dispute_appeal": false}}'});
    final prefs = await Prefs.load();
    final c = ProviderContainer(
      overrides: [prefsProvider.overrideWithValue(prefs), sessionProvider.overrideWith(FakeSession.new)],
    );
    addTearDown(c.dispose);
    expect(c.read(flagOnProvider(FlagKeys.disputeAppeal)), isFalse);
    expect(c.read(flagOnProvider(FlagKeys.disputeEvidence)), isTrue);
    expect(c.read(flagsProvider.notifier).isOn('anything_else'), isTrue);
  });
}
