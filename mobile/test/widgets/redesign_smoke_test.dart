import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kaamsathi/core/api/cached.dart';
import 'package:kaamsathi/core/api/json.dart';
import 'package:kaamsathi/core/auth/session.dart';
import 'package:kaamsathi/core/providers.dart';
import 'package:kaamsathi/core/theme/app_theme.dart';
import 'package:kaamsathi/core/widgets/signature/signature.dart';
import 'package:kaamsathi/features/common/inbox/inbox_data.dart';
import 'package:kaamsathi/features/supervisor/hajiri/data/attendance_models.dart';
import 'package:kaamsathi/features/supervisor/hajiri/hajiri_providers.dart';
import 'package:kaamsathi/features/supervisor/hajiri/ui/today_hajiri_screen.dart';
import 'package:kaamsathi/features/worker/career/career_data.dart';
import 'package:kaamsathi/features/worker/credentials/credentials_data.dart';
import 'package:kaamsathi/features/worker/credentials/ui/passport_screen.dart';
import 'package:kaamsathi/features/worker/data/worker_models.dart';
import 'package:kaamsathi/features/worker/data/worker_repository.dart';
import 'package:kaamsathi/features/worker/home/ui/worker_home_screen.dart';
import 'package:kaamsathi/features/worker/jobs/jobs_data.dart';
import 'package:kaamsathi/features/worker/jobs/ui/jobs_screen.dart';
import 'package:kaamsathi/features/worker/learn/learn_screen.dart';
import 'package:kaamsathi/features/worker/profile/ui/profile_screen.dart';
import 'package:kaamsathi/features/worker/talab/ui/talab_screen.dart';
import 'package:kaamsathi/features/worker/trust/trust_data.dart';

import '../fixtures/complete_fixtures.dart';
import '../fixtures/eco_fixtures.dart';
import '../fixtures/ext_fixtures.dart';
import 'ext_harness.dart';

final _profile = workerProfileProvider.overrideWith((ref) async => WorkerProfile.fromJson(workerFullJson));
final _trust = trustProvider.overrideWith((ref) async => Cached(TrustSummary.fromJson(trustJson)));
final _career = careerProvider.overrideWith((ref) async => Cached(CareerSummary.fromJson(careerJson)));
final _jobs = recommendedJobsProvider.overrideWith(
  (ref) async => resultsOf(recommendedJobsJson).map(JobSummary.fromJson).toList(),
);
final _month = myAttendanceProvider.overrideWith((ref, key) async => MyAttendanceMonth.fromJson(myAttendanceMonthJson));
final _noSlips = payslipsProvider.overrideWith((ref) async => <Payslip>[]);
final _passport = passportProvider.overrideWith(
  (ref) async =>
      Cached(Passport.fromJson({'public_code': 'ab12cd34ef', 'is_public': true, 'payload': passportPayloadJson})),
);
final _shares = passportSharesProvider.overrideWith((ref) async => <PassportShare>[]);
final _consents = consentsProvider.overrideWith((ref) async => <ConsentRecord>[]);

final _homeData = <Object>[_profile, _trust, _career, _jobs, _month, _noSlips];

void main() {
  for (final lang in ['en', 'ne']) {
    testWidgets('home (mural header, today, facts, jobs for you) at 360px ($lang)', (tester) async {
      await pumpScreen(tester, const WorkerHomeScreen(), _homeData, lang: lang);
      expect(tester.takeException(), isNull);
      expect(find.byKey(const Key('mural_header')), findsOneWidget);
      expect(find.byKey(const Key('check_in_button')), findsOneWidget);
      expect(find.byKey(const Key('fact_days')), findsOneWidget);
      expect(find.byKey(const Key('fact_score')), findsOneWidget);
      expect(find.byKey(const Key('home_ladder_chip')), findsOneWidget);
      expect(find.text(lang == 'ne' ? 'सीपको सीढी: तह २' : 'Skill ladder: level 2'), findsOneWidget);
      expect(find.byKey(const Key('home_job_j1')), findsOneWidget);
      expect(find.byKey(const Key('employer_verified')), findsOneWidget);
      expect(
        find.text(lang == 'ne' ? 'तपाईंको सीप (डकर्मी) र ठाउँ मिल्छ' : 'Matches your skill (Mason) and area'),
        findsOneWidget,
      );
      expect(find.byKey(const Key('profile_completeness')), findsOneWidget);
      await tester.drag(find.byType(Scrollable).first, const Offset(0, -2000));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });

    testWidgets('home with every service off stays calm at 360px ($lang)', (tester) async {
      await pumpScreen(tester, const WorkerHomeScreen(), [
        workerProfileProvider.overrideWith((ref) => throw off),
        trustProvider.overrideWith((ref) => throw off),
        careerProvider.overrideWith((ref) => throw off),
        recommendedJobsProvider.overrideWith((ref) => throw off),
        myAttendanceProvider.overrideWith((ref, key) => throw off),
        payslipsProvider.overrideWith((ref) => throw off),
      ], lang: lang);
      expect(tester.takeException(), isNull);
      expect(find.byKey(const Key('check_in_button')), findsOneWidget);
      expect(find.byKey(const Key('home_jobs_for_you')), findsNothing);
      expect(find.byKey(const Key('fact_score')), findsNothing);
    });

    testWidgets('passport card + ladder + timeline at 360px ($lang)', (tester) async {
      await pumpScreen(tester, const PassportScreen(), [_passport, _shares], lang: lang);
      expect(tester.takeException(), isNull);
      expect(find.byKey(const Key('passport_card')), findsOneWidget);
      expect(find.text('AB12CD34EF'), findsOneWidget);
      expect(find.byType(SkillLadder), findsOneWidget);
      expect(find.byType(CutPaperFrame), findsOneWidget);
      expect(find.text(lang == 'ne' ? 'सीढी ४/५' : 'Ladder 4/5'), findsOneWidget);
      await tester.scrollUntilVisible(
        find.byKey(const Key('passport_privacy_note')),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      expect(tester.takeException(), isNull);
    });

    testWidgets('learn tab at 360px ($lang)', (tester) async {
      await pumpScreen(tester, const LearnScreen(), [_career], lang: lang);
      expect(tester.takeException(), isNull);
      for (final k in ['learn_training', 'learn_credentials', 'learn_career']) {
        expect(find.byKey(Key(k)), findsOneWidget);
      }
      expect(find.byKey(const Key('slot_fallback_mobile-learn-workshop')), findsOneWidget);
      expect(find.byKey(const ValueKey('art_training-lab')), findsOneWidget);
    });

    testWidgets('profile (cut-paper photo, trust ladder, menus) at 360px ($lang)', (tester) async {
      await pumpScreen(tester, const ProfileScreen(), [_profile, _trust, _consents], lang: lang);
      expect(tester.takeException(), isNull);
      expect(find.byType(CutPaperFrame), findsOneWidget);
      await tester.scrollUntilVisible(find.byType(SkillLadder), 300, scrollable: find.byType(Scrollable).first);
      await tester.scrollUntilVisible(
        find.byKey(const Key('menu_passport')),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      expect(tester.takeException(), isNull);
    });

    testWidgets('work tab payslips with the switcher at 360px ($lang)', (tester) async {
      await pumpScreen(tester, const TalabScreen(), [_noSlips], lang: lang);
      expect(tester.takeException(), isNull);
      expect(find.byKey(const Key('work_switcher')), findsOneWidget);
      expect(find.byKey(const Key('work_shifts')), findsOneWidget);
      expect(find.byKey(const Key('work_timesheets')), findsOneWidget);
    });

    testWidgets('jobs for you cards explain the match at 360px ($lang)', (tester) async {
      await pumpScreen(tester, const JobsScreen(), [_jobs], lang: lang);
      expect(tester.takeException(), isNull);
      expect(find.byKey(const Key('match_reason_j1')), findsOneWidget);
    });

    testWidgets('supervisor hajiri stays a calm ledger: brand mark, no mural ($lang)', (tester) async {
      // The app gives supervisor mode the ledger theme (app.dart).
      await pumpScreen(
        tester,
        Builder(
          builder:
              (context) => Theme(
                data: buildTheme(Brightness.light, lang: lang, useGoogleFonts: false, ledger: true),
                child: const TodayHajiriScreen(),
              ),
        ),
        [
          dayRosterProvider.overrideWith((ref, key) async => DayRoster(date: key.date, rows: const [])),
          syncControllerProvider.overrideWith(_IdleSync.new),
          sitesProvider.overrideWith((ref) async => []),
          unreadCountProvider.overrideWith(_NoUnread.new),
        ],
        lang: lang,
        mode: AppMode.supervisor,
      );
      expect(tester.takeException(), isNull);
      expect(find.byType(KsBrandMark), findsOneWidget);
      expect(find.byType(MuralHeader), findsNothing);
      expect(find.byType(MuralLettering), findsNothing);
      expect(find.byType(BrushStroke), findsNothing);
      expect(find.byType(IllustratedIcon), findsNothing);
      expect(find.byType(EmptyStateArt), findsNothing);
    });
  }

  testWidgets('milestone: baseline first, then celebrates the change once', (tester) async {
    await pumpScreen(tester, const _MilestoneToggle(), []);
    final container = ProviderScope.containerOf(tester.element(find.byType(MilestoneWatch)));
    final prefs = container.read(prefsProvider);
    expect(prefs.milestone('u1', 'profileComplete'), isFalse);
    expect(find.byType(Celebration), findsNothing);

    // Not reached → reached: one celebration.
    await tester.tap(find.text('reach'));
    await tester.pump();
    await tester.pump();
    await tester.pump();
    expect(find.byType(Celebration), findsOneWidget);
    expect(find.text('Your profile is complete.'), findsOneWidget);
    await tester.pumpAndSettle();
    expect(find.byType(Celebration), findsNothing);
    expect(prefs.milestone('u1', 'profileComplete'), isTrue);

    // Seen again (e.g. after a refresh): never repeated.
    await tester.tap(find.text('reset'));
    await tester.pump();
    await tester.tap(find.text('reach'));
    await tester.pump();
    await tester.pump();
    expect(find.byType(Celebration), findsNothing);
  });

  testWidgets('milestone already reached on first sight is not celebrated', (tester) async {
    await pumpScreen(
      tester,
      const Scaffold(
        body: MilestoneWatch(milestone: Milestone.firstVerifiedCredential, reached: true, child: SizedBox.expand()),
      ),
      [],
    );
    expect(find.byType(Celebration), findsNothing);
  });
}

class _MilestoneToggle extends StatefulWidget {
  const _MilestoneToggle();

  @override
  State<_MilestoneToggle> createState() => _MilestoneToggleState();
}

class _MilestoneToggleState extends State<_MilestoneToggle> {
  bool _reached = false;

  @override
  Widget build(BuildContext context) => Scaffold(
    body: MilestoneWatch(
      milestone: Milestone.profileComplete,
      reached: _reached,
      child: Column(
        children: [
          TextButton(onPressed: () => setState(() => _reached = true), child: const Text('reach')),
          TextButton(onPressed: () => setState(() => _reached = false), child: const Text('reset')),
        ],
      ),
    ),
  );
}

class _IdleSync extends SyncController {
  @override
  SyncState build() => const SyncState();
}

class _NoUnread extends UnreadCountController {
  @override
  int build() => 0;
}
