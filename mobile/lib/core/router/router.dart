import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/ui/language_screen.dart';
import '../../features/auth/ui/login_screen.dart';
import '../../features/auth/ui/no_access_screen.dart';
import '../../features/auth/ui/org_pick_screen.dart';
import '../../features/auth/ui/otp_screen.dart';
import '../../features/auth/ui/splash_screen.dart';
import '../../features/common/inbox/inbox_screen.dart';
import '../../features/common/inbox/notification_prefs.dart';
import '../../features/common/legal/legal_screen.dart';
import '../../features/common/security/security_screen.dart';
import '../../features/common/support/help_center.dart';
import '../../features/common/support/safety_report_screen.dart';
import '../../features/common/support/support_screen.dart';
import '../../features/supervisor/corrections/corrections_queue_screen.dart';
import '../../features/supervisor/hajiri/ui/register_screen.dart';
import '../../features/supervisor/hajiri/ui/today_hajiri_screen.dart';
import '../../features/supervisor/leave/ui/leaves_screen.dart';
import '../../features/supervisor/more_screen.dart';
import '../../features/supervisor/roster/ui/roster_week_screen.dart';
import '../../features/supervisor/supervisor_shell.dart';
import '../../features/supervisor/timesheets/ui/timesheets_screen.dart';
import '../../features/worker/career/ui/career_screen.dart';
import '../../features/worker/checkin/ui/scan_screen.dart';
import '../../features/worker/credentials/ui/credentials_screen.dart';
import '../../features/worker/credentials/ui/passport_screen.dart';
import '../../features/worker/crew/ui/crew_screen.dart';
import '../../features/worker/employment/ui/contract_accept_screen.dart';
import '../../features/worker/employment/ui/employment_detail_screen.dart';
import '../../features/worker/experience/ui/work_history_screen.dart';
import '../../features/worker/home/ui/worker_home_screen.dart';
import '../../features/worker/jobs/ui/job_alerts_screen.dart';
import '../../features/worker/jobs/ui/jobs_screen.dart';
import '../../features/worker/mobility/ui/mobility_screen.dart';
import '../../features/worker/money/ui/consent_screen.dart';
import '../../features/worker/money/ui/money_screen.dart';
import '../../features/worker/my_hajiri/ui/corrections_screen.dart';
import '../../features/worker/my_hajiri/ui/my_hajiri_screen.dart';
import '../../features/worker/preferences/availability_screen.dart';
import '../../features/worker/privacy/ui/my_data_screen.dart';
import '../../features/worker/profile/ui/history_screen.dart';
import '../../features/worker/profile/ui/languages_screen.dart';
import '../../features/worker/profile/ui/profile_screen.dart';
import '../../features/worker/roster/ui/my_shifts_screen.dart';
import '../../features/worker/talab/ui/payslip_detail_screen.dart';
import '../../features/worker/talab/ui/talab_screen.dart';
import '../../features/worker/timesheets/ui/my_timesheets_screen.dart';
import '../../features/worker/training/ui/training_screen.dart';
import '../../features/worker/trust/ui/dispute_detail_screen.dart';
import '../../features/worker/trust/ui/disputes_screen.dart';
import '../../features/worker/trust/ui/my_ratings_screen.dart';
import '../../features/worker/trust/ui/profile_views_screen.dart';
import '../../features/worker/worker_shell.dart';
import '../auth/session.dart';
import '../providers.dart';

abstract final class Routes {
  static const splash = '/splash';
  static const language = '/language';
  static const login = '/login';
  static const otp = '/otp';
  static const noAccess = '/no-access';
  static const orgPick = '/org-pick';

  static const supHajiri = '/s/hajiri';
  static const supRegister = '/s/register';
  static const supLeaves = '/s/leaves';
  static const supMore = '/s/more';

  static const workerHome = '/w/home';
  static const workerHajiri = '/w/hajiri';
  static const workerTalab = '/w/talab';
  static const workerProfile = '/w/profile';
  static const workerHistory = '/w/profile/history';
  static const scan = '/scan';

  static String payslip(String id) => '$workerTalab/$id';

  // Worker sub-pages (pushed full-screen over the tabs, except the job
  // detail which lives under Profile → Work history).
  static String workerJob(String id) => '$workerHistory/$id';
  static String workerJobContract(String id) => '$workerHistory/$id/contract';
  static const workerProfileViews = '/w/profile-views';
  static const workerDisputes = '/w/disputes';
  static const workerDisputeNew = '/w/dispute-new';
  static const workerCrew = '/w/crew';
  static const workerCredentials = '/w/credentials';
  static const workerPassport = '/w/passport';
  static const workerTraining = '/w/training';
  static const workerMoney = '/w/money';
  static String workerOfferApply(String offerId) => '/w/offer-apply/$offerId';
  static const workerPrivacy = '/w/privacy';
  static const workerShifts = '/w/shifts';

  static const supRoster = '/s/roster';
  static const supTimesheets = '/s/timesheets';

  // Shared by both modes (not under /w or /s so the mode guard allows them).
  static const inbox = '/inbox';
  static const security = '/security';
  static const help = '/help';
  static const helpNew = '/help-new';
  static String helpCase(String id) => '$help/$id';

  // Worker growth, mobility, timesheets (EXTENSIONS §3–5).
  static const workerJobs = '/w/jobs';
  static const workerApplications = '/w/jobs?tab=applications';
  static const workerOffers = '/w/jobs?tab=offers';
  static const workerJobAlerts = '/w/job-alerts';
  static const workerHelpCenter = '/help-center';
  static const helpCenter = workerHelpCenter;
  static String helpArticle(String slug) => '$workerHelpCenter/$slug';
  static const helpSafety = '/help-safety';
  static const notificationPrefs = '/notification-settings';
  static const legal = '/legal';
  static const workerWorkHistory = '/w/work-history';
  static const workerAvailability = '/w/availability';
  static const workerMobility = '/w/mobility';
  static const workerCareer = '/w/career';
  static const workerTimesheets = '/w/timesheets';

  // Checklist completion: languages, ratings, dispute detail, corrections.
  static const workerLanguages = '/w/languages';
  static const workerRatings = '/w/ratings';
  static String workerDispute(String id) => '$workerDisputes/$id';
  static const workerCorrections = '/w/corrections';
  static const supCorrections = '/s/corrections';
}

/// Bridges Riverpod state changes to go_router's refreshListenable.
class _RouterRefresh extends ChangeNotifier {
  _RouterRefresh(Ref ref) {
    ref.listen(sessionProvider, (_, _) => notifyListeners());
    ref.listen(languageProvider, (_, _) => notifyListeners());
  }
}

/// Pure redirect logic (unit-testable).
String? resolveRedirect({required String location, required Session session, required String? language}) {
  const preAuth = {Routes.login, Routes.otp};
  if (session.status == AuthStatus.unknown) {
    return location == Routes.splash ? null : Routes.splash;
  }
  if (language == null) {
    return location == Routes.language ? null : Routes.language;
  }
  if (session.status == AuthStatus.loggedOut) {
    return preAuth.contains(location) ? null : Routes.login;
  }
  // New/updated terms block everything until accepted.
  if (session.me?.pendingLegal.isNotEmpty ?? false) {
    return location == Routes.legal ? null : Routes.legal;
  }
  if (session.mode == null) {
    return location == Routes.noAccess ? null : Routes.noAccess;
  }
  if (session.needsOrgPick) {
    return location == Routes.orgPick ? null : Routes.orgPick;
  }
  final home = session.mode == AppMode.supervisor ? Routes.supHajiri : Routes.workerHome;
  if (location == Routes.splash ||
      location == Routes.legal ||
      location == Routes.language ||
      location == Routes.noAccess ||
      preAuth.contains(location)) {
    return home;
  }
  if (session.mode == AppMode.supervisor && location.startsWith('/w/')) {
    return home;
  }
  if (session.mode == AppMode.worker && (location.startsWith('/s/') || location == Routes.orgPick)) {
    return home;
  }
  return null;
}

final routerProvider = Provider<GoRouter>((ref) {
  final refresh = _RouterRefresh(ref);
  ref.onDispose(refresh.dispose);
  return GoRouter(
    initialLocation: Routes.splash,
    refreshListenable: refresh,
    redirect:
        (context, state) => resolveRedirect(
          location: state.matchedLocation,
          session: ref.read(sessionProvider),
          language: ref.read(languageProvider),
        ),
    routes: [
      GoRoute(path: Routes.splash, builder: (_, _) => const SplashScreen()),
      GoRoute(path: Routes.language, builder: (_, _) => const LanguageScreen()),
      GoRoute(path: Routes.login, builder: (_, _) => const LoginScreen()),
      GoRoute(
        path: Routes.otp,
        builder: (_, state) {
          final args = state.extra is OtpArgs ? state.extra! as OtpArgs : const OtpArgs(phone: '');
          return OtpScreen(args: args);
        },
      ),
      GoRoute(path: Routes.noAccess, builder: (_, _) => const NoAccessScreen()),
      GoRoute(path: Routes.orgPick, builder: (_, _) => const OrgPickScreen()),
      GoRoute(path: Routes.scan, builder: (_, _) => const ScanScreen()),
      // Worker sub-pages (full screen, pushed over the tabs).
      GoRoute(path: Routes.workerProfileViews, builder: (_, _) => const ProfileViewsScreen()),
      GoRoute(
        path: Routes.workerDisputes,
        builder: (_, _) => const DisputesScreen(),
        routes: [GoRoute(path: ':id', builder: (_, state) => DisputeDetailScreen(id: state.pathParameters['id']!))],
      ),
      GoRoute(
        path: Routes.workerDisputeNew,
        builder:
            (_, state) => DisputeFormScreen(
              args: state.extra is DisputeFormArgs ? state.extra! as DisputeFormArgs : const DisputeFormArgs(),
            ),
      ),
      GoRoute(path: Routes.workerCrew, builder: (_, _) => const CrewScreen()),
      GoRoute(path: Routes.workerCredentials, builder: (_, _) => const CredentialsScreen()),
      GoRoute(path: Routes.workerPassport, builder: (_, _) => const PassportScreen()),
      GoRoute(path: Routes.workerTraining, builder: (_, _) => const TrainingScreen()),
      GoRoute(path: Routes.workerMoney, builder: (_, _) => const MoneyScreen()),
      GoRoute(
        path: '/w/offer-apply/:id',
        builder: (_, state) => OfferApplyScreen(offerId: state.pathParameters['id']!),
      ),
      GoRoute(path: Routes.workerPrivacy, builder: (_, _) => const MyDataScreen()),
      GoRoute(path: Routes.workerShifts, builder: (_, _) => const MyShiftsScreen()),
      GoRoute(path: Routes.supRoster, builder: (_, _) => const RosterWeekScreen()),
      GoRoute(path: Routes.supTimesheets, builder: (_, _) => const TimesheetsScreen()),
      // Shared by both modes.
      GoRoute(path: Routes.inbox, builder: (_, _) => const InboxScreen()),
      GoRoute(path: Routes.security, builder: (_, _) => const SecurityScreen()),
      GoRoute(path: Routes.helpNew, builder: (_, _) => const NewSupportCaseScreen()),
      GoRoute(path: Routes.helpSafety, builder: (_, _) => const SafetyReportScreen()),
      GoRoute(path: Routes.notificationPrefs, builder: (_, _) => const NotificationPrefsScreen()),
      GoRoute(path: Routes.legal, builder: (_, _) => const LegalScreen()),
      GoRoute(
        path: Routes.workerHelpCenter,
        builder: (_, _) => const HelpCenterScreen(),
        routes: [GoRoute(path: ':slug', builder: (_, state) => HelpArticleScreen(slug: state.pathParameters['slug']!))],
      ),
      GoRoute(
        path: Routes.help,
        builder: (_, _) => const SupportScreen(),
        routes: [GoRoute(path: ':id', builder: (_, state) => SupportThreadScreen(id: state.pathParameters['id']!))],
      ),
      // Worker growth, mobility, timesheets.
      GoRoute(
        path: Routes.workerJobs,
        builder:
            (_, state) => JobsScreen(
              initialTab: switch (state.uri.queryParameters['tab']) {
                'offers' => 1,
                'applications' => 2,
                _ => 0,
              },
            ),
      ),
      GoRoute(path: Routes.workerJobAlerts, builder: (_, _) => const JobAlertsScreen()),
      GoRoute(path: Routes.workerWorkHistory, builder: (_, _) => const WorkHistoryScreen()),
      GoRoute(path: Routes.workerAvailability, builder: (_, _) => const AvailabilityScreen()),
      GoRoute(path: Routes.workerMobility, builder: (_, _) => const MobilityScreen()),
      GoRoute(path: Routes.workerCareer, builder: (_, _) => const CareerScreen()),
      GoRoute(path: Routes.workerTimesheets, builder: (_, _) => const MyTimesheetsScreen()),
      GoRoute(path: Routes.workerLanguages, builder: (_, _) => const LanguagesScreen()),
      GoRoute(path: Routes.workerRatings, builder: (_, _) => const MyRatingsScreen()),
      GoRoute(path: Routes.workerCorrections, builder: (_, _) => const MyCorrectionsScreen()),
      GoRoute(path: Routes.supCorrections, builder: (_, _) => const CorrectionsQueueScreen()),
      StatefulShellRoute.indexedStack(
        builder: (_, _, shell) => SupervisorShell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: Routes.supHajiri, builder: (_, _) => const TodayHajiriScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: Routes.supRegister, builder: (_, _) => const RegisterScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: Routes.supLeaves, builder: (_, _) => const LeavesScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: Routes.supMore, builder: (_, _) => const MoreScreen())]),
        ],
      ),
      StatefulShellRoute.indexedStack(
        builder: (_, _, shell) => WorkerShell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: Routes.workerHome, builder: (_, _) => const WorkerHomeScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: Routes.workerHajiri, builder: (_, _) => const MyHajiriScreen())]),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Routes.workerTalab,
                builder: (_, _) => const TalabScreen(),
                routes: [
                  GoRoute(path: ':id', builder: (_, state) => PayslipDetailScreen(id: state.pathParameters['id']!)),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Routes.workerProfile,
                builder: (_, _) => const ProfileScreen(),
                routes: [
                  GoRoute(
                    path: 'history',
                    builder: (_, _) => const HistoryScreen(),
                    routes: [
                      GoRoute(
                        path: ':id',
                        builder: (_, state) => EmploymentDetailScreen(id: state.pathParameters['id']!),
                        routes: [
                          GoRoute(
                            path: 'contract',
                            builder: (_, state) => ContractAcceptScreen(id: state.pathParameters['id']!),
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  );
});
