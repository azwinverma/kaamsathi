import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/json.dart';
import '../../../core/auth/me.dart';
import '../../../core/auth/session.dart';
import '../../../core/flags.dart';
import '../../../core/format.dart';
import '../../../core/l10n/l10n.dart';
import '../../../core/router/router.dart';
import '../../../core/theme/tokens.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/eco.dart';
import '../../bolau/bolau_logic.dart';
import '../../bolau/bolau_repository.dart';
import 'inbox_data.dart';

/// Bell with the unread badge, for app bars. Opens the inbox.
class InboxBell extends ConsumerWidget {
  const InboxBell({super.key, this.onMural = false});

  /// White bell on a translucent tile, for the blue worker mural header.
  final bool onMural;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final count = ref.watch(unreadCountProvider);
    final l = context.l10n;
    return IconButton(
      key: const Key('inbox_bell'),
      style:
          onMural
              ? IconButton.styleFrom(
                foregroundColor: KsMural.onGround,
                backgroundColor: KsMural.onGround.withValues(alpha: 0.16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(KsRadius.control)),
              )
              : null,
      tooltip: count > 0 ? '${l.inboxTitle} · ${l.inboxUnread(localizeDigits('$count', context.lang))}' : l.inboxTitle,
      onPressed: () => context.push(Routes.inbox),
      icon: Badge(
        isLabelVisible: count > 0,
        label: Text(localizeDigits(count > 99 ? '99+' : '$count', context.lang)),
        child: const Icon(LucideIcons.bell),
      ),
    );
  }
}

/// Where a Bolau notification opens, and the mode it belongs to (the inbox
/// switches mode first when needed). Null for other kinds, or when the user
/// can't use that side (no Sipalu profile).
({String route, AppMode mode})? bolauNotificationTarget(AppNotification n, AppMode? mode, {Me? me}) {
  final current = switch (mode) {
    AppMode.ghardhani => BookingSide.ghardhani,
    AppMode.worker => BookingSide.sipalu,
    _ => null,
  };
  final side = bolauSideFor(n.kind, n.data, link: n.link, current: current);
  if (side == null) return null;
  // Ids from data, else from the server link (`/ghar/bookings/{id}`,
  // `/bolau/jobs/{id}`, `/bolau/requests/{id}`, `/ghar/requests/{id}`).
  final segs = Uri.tryParse(n.link ?? '')?.pathSegments ?? const <String>[];
  String? fromLink(Set<String> names) =>
      segs.length >= 3 && names.contains(segs[1]) && segs[2].isNotEmpty ? segs[2] : null;
  String? id(String k) {
    final v = n.data[k];
    final s = v is Map ? str(v['id']) : str(v);
    return s == null || s.isEmpty ? null : s;
  }

  final booking = id('booking_id') ?? fromLink({'bookings', 'jobs'});
  final request = id('request_id') ?? fromLink({'requests'});
  if (side == BookingSide.sipalu) {
    if (me != null && !me.isWorker) return null;
    final route =
        booking != null
            ? Routes.sipaluJob(booking)
            : request != null && bolauEvent(n.kind) == 'request_new'
            ? Routes.sipaluRequest(request)
            : Routes.workerBolau;
    return (route: route, mode: AppMode.worker);
  }
  final route =
      booking != null
          ? Routes.gharBooking(booking)
          : request != null
          ? Routes.gharRequest(request)
          : (bolauEvent(n.kind).startsWith('booking') ? Routes.gharBookings : Routes.gharRequests);
  return (route: route, mode: AppMode.ghardhani);
}

/// In-app destination for a notification, or null to just mark it read.
/// Only returns routes that exist in the current [mode] (Bolau kinds: see
/// [bolauNotificationTarget]; ignored while [bolau] is off).
String? routeForNotification(AppNotification n, AppMode? mode, {bool bolau = false, Me? me}) {
  if (isBolauNotification(n.kind)) {
    return bolau ? bolauNotificationTarget(n, mode, me: me)?.route : null;
  }
  if (mode == AppMode.ghardhani) {
    final caseId = str(n.data['case_id'] ?? n.data['support_case_id']);
    if (caseId != null && caseId.isNotEmpty) return Routes.helpCase(caseId);
    if (n.kind.toLowerCase().contains('support')) return Routes.help;
    return null;
  }
  final worker = mode != AppMode.supervisor;
  final link = n.link ?? '';
  final k = n.kind.toLowerCase();
  // Specific kinds first: they carry ids for a deeper screen than the link.
  if (worker) {
    final disputeId = str(n.data['dispute_id']);
    if (k.contains('dispute') && disputeId != null && disputeId.isNotEmpty) return Routes.workerDispute(disputeId);
    if (k == 'roster_changed' || k.contains('roster') || k.contains('shift')) return Routes.workerShifts;
    if (k.contains('attendance_correction') || k.contains('correction')) return Routes.workerHajiri;
  } else if (k.contains('attendance_correction') || k.contains('correction')) {
    return Routes.supCorrections;
  }
  if (link.startsWith('/')) {
    if (worker && link.startsWith('/w/')) return link;
    if (!worker && link.startsWith('/s/')) return link;
    if (link.startsWith('/help') || link == Routes.inbox) return link;
    // The server links to API-style paths (`/me/applications`, …).
    if (worker) {
      for (final (prefix, route) in const [
        ('/me/job-offers', Routes.workerOffers),
        ('/me/job-alerts', Routes.workerJobs),
        ('/me/applications', Routes.workerApplications),
        ('/me/jobs', Routes.workerJobs),
        ('/me/work-history', Routes.workerWorkHistory),
        ('/me/mobility', Routes.workerMobility),
        ('/me/timesheets', Routes.workerTimesheets),
        ('/me/payslips', Routes.workerTalab),
        ('/me/disputes', Routes.workerDisputes),
        ('/me/credentials', Routes.workerCredentials),
        ('/me/career', Routes.workerCareer),
        ('/me/roster', Routes.workerShifts),
        ('/me/attendance', Routes.workerHajiri),
        ('/me/ratings', Routes.workerRatings),
      ]) {
        if (link.startsWith(prefix)) return route;
      }
    }
  }
  final caseId = str(n.data['case_id'] ?? n.data['support_case_id']);
  if (caseId != null && caseId.isNotEmpty) return Routes.helpCase(caseId);
  if (k.contains('support')) return Routes.help;
  if (k.contains('timesheet')) return worker ? Routes.workerTimesheets : Routes.supTimesheets;
  if (!worker) return null;
  if (k.contains('offer') && !k.contains('finance')) return Routes.workerOffers;
  if (k.contains('shortlist') || k.contains('application') || k.contains('interview') || k.contains('invit')) {
    return Routes.workerApplications;
  }
  if (k.contains('payslip') || k.contains('payroll') || k.contains('salary')) return Routes.workerTalab;
  if (k.contains('dispute')) return Routes.workerDisputes;
  if (k.contains('mobility') || k.contains('passport_expir') || k.contains('travel') || k.contains('clearance')) {
    return Routes.workerMobility;
  }
  if (k.contains('work_history') || k.contains('reference')) return Routes.workerWorkHistory;
  if (k.contains('credential')) return Routes.workerCredentials;
  if (k.contains('rating')) return Routes.workerRatings;
  if (k.contains('job')) return Routes.workerJobs;
  return null;
}

class InboxScreen extends ConsumerStatefulWidget {
  const InboxScreen({super.key});

  @override
  ConsumerState<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends ConsumerState<InboxScreen> {
  final Set<String> _readNow = {};
  bool _allRead = false;

  bool _isRead(AppNotification n) => _allRead || n.isRead || _readNow.contains(n.id);

  Future<void> _open(AppNotification n) async {
    if (!_isRead(n)) {
      setState(() => _readNow.add(n.id));
      final unread = ref.read(unreadCountProvider.notifier);
      unread.set(ref.read(unreadCountProvider) - 1);
      try {
        await ref.read(inboxRepositoryProvider).markRead(n.id);
      } catch (_) {
        // Best effort: the next poll corrects the badge.
      }
    }
    if (!mounted) return;
    final session = ref.read(sessionProvider);
    final bolau = ref.read(bolauEnabledProvider);
    final mode = effectiveMode(session, bolau: bolau);
    final target = bolau ? bolauNotificationTarget(n, mode, me: session.me) : null;
    if (target != null && target.mode != mode) {
      await ref.read(sessionProvider.notifier).setMode(target.mode);
      if (!mounted) return;
    }
    final route = target?.route ?? routeForNotification(n, mode, bolau: bolau, me: session.me);
    if (route == null) return;
    if (isWorkerTabLocation(route)) {
      context.go(route); // switch bottom-nav tab
    } else {
      await context.push(route);
    }
  }

  Future<void> _markAll() async {
    setState(() => _allRead = true);
    ref.read(unreadCountProvider.notifier).set(0);
    try {
      await ref.read(inboxRepositoryProvider).markAllRead();
    } catch (e) {
      if (mounted) showSnack(context, errorText(context, e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final value = ref.watch(notificationsProvider);
    final items = value.value ?? const <AppNotification>[];
    final anyUnread = items.any((n) => !_isRead(n));
    return Scaffold(
      appBar: AppBar(
        title: Text(l.inboxTitle),
        actions: [
          IconButton(
            key: const Key('inbox_settings'),
            tooltip: l.notifPrefsTitle,
            onPressed: () => context.push(Routes.notificationPrefs),
            icon: const Icon(LucideIcons.settings2),
          ),
          if (anyUnread)
            IconButton(
              key: const Key('inbox_mark_all'),
              tooltip: l.inboxMarkAllRead,
              onPressed: _markAll,
              icon: const Icon(LucideIcons.checkCheck),
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(notificationsProvider);
          await ref.read(unreadCountProvider.notifier).refresh(force: true);
          try {
            await ref.read(notificationsProvider.future);
          } catch (_) {}
          if (mounted) setState(() => _allRead = false);
        },
        child: FeatureAsyncBody<List<AppNotification>>(
          value: value,
          onRetry: () => ref.invalidate(notificationsProvider),
          data:
              (items) =>
                  items.isEmpty
                      ? ListView(children: [EmptyState(icon: LucideIcons.bellOff, message: l.inboxEmpty)])
                      : ListView.separated(
                        padding: const EdgeInsets.all(KsSpace.page),
                        itemCount: items.length,
                        separatorBuilder: (_, _) => const SizedBox(height: KsSpace.s2),
                        itemBuilder: (context, i) => _Tile(n: items[i], read: _isRead(items[i]), onTap: _open),
                      ),
        ),
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({required this.n, required this.read, required this.onTap});
  final AppNotification n;
  final bool read;
  final ValueChanged<AppNotification> onTap;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final c = context.ks;
    final scheme = Theme.of(context).colorScheme;
    final body = n.bodyFor(lang);
    return Card(
      color: read ? null : scheme.primaryContainer.withValues(alpha: 0.35),
      child: InkWell(
        borderRadius: BorderRadius.circular(KsRadius.card),
        onTap: () => onTap(n),
        child: Padding(
          padding: const EdgeInsets.all(KsSpace.s4),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 6, right: KsSpace.s3),
                child: Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(color: read ? Colors.transparent : scheme.primary, shape: BoxShape.circle),
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(n.titleFor(lang), style: read ? t.bodyLarge : t.titleSmall),
                    if (body.isNotEmpty) ...[const SizedBox(height: 2), Text(body, style: t.bodyMedium)],
                    if (n.createdAt != null) ...[
                      const SizedBox(height: KsSpace.s1),
                      Text(
                        '${formatBsDateTime(n.createdAt, lang)} · ${formatTime(n.createdAt!.toLocal(), lang)}',
                        style: t.bodySmall?.copyWith(color: c.textMuted),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Keeps the unread badge fresh without push: polls once when mounted and
/// again whenever the app returns to the foreground. Shells also call
/// `refresh()` on tab switches (throttled in [UnreadCountController]).
class UnreadPoller extends ConsumerStatefulWidget {
  const UnreadPoller({super.key, required this.child});
  final Widget child;

  @override
  ConsumerState<UnreadPoller> createState() => _UnreadPollerState();
}

class _UnreadPollerState extends ConsumerState<UnreadPoller> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(unreadCountProvider.notifier).refresh(force: true);
      ref.read(flagsProvider.notifier).refresh(force: true);
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      ref.read(unreadCountProvider.notifier).refresh(force: true);
      ref.read(flagsProvider.notifier).refresh();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
