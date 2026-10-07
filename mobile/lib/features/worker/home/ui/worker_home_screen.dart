import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/auth/session.dart';
import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/router/router.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/eco.dart';
import '../../checkin/data/check_in_service.dart';
import '../../data/worker_models.dart';
import '../../data/worker_repository.dart';
import '../../my_hajiri/ui/my_hajiri_screen.dart';
import '../../trust/trust_data.dart';
import '../../trust/ui/trust_card.dart';

class WorkerHomeScreen extends ConsumerWidget {
  const WorkerHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final me = ref.watch(sessionProvider).me;
    final profile = ref.watch(workerProfileProvider).value;
    final name = profile?.displayName(lang).split(' ').first ?? me?.firstName ?? '';
    final today = nepalToday();

    Future<void> refresh() async {
      ref.invalidate(workerProfileProvider);
      ref.invalidate(myAttendanceProvider);
      ref.invalidate(payslipsProvider);
      ref.invalidate(trustProvider);
      try {
        await ref.read(currentMonthAttendanceProvider.future);
      } catch (_) {}
    }

    return Scaffold(
      appBar: AppBar(title: Text(l.appName)),
      body: RefreshIndicator(
        onRefresh: refresh,
        child: ListView(
          padding: const EdgeInsets.all(KsSpace.page),
          children: [
            Text(l.homeGreeting(name), style: t.headlineMedium),
            const SizedBox(height: KsSpace.s1),
            Text(
              '${weekdayName(today, lang)}, ${formatBsDate(BsDate.fromAd(today), lang)}',
              style: t.bodyLarge?.copyWith(color: context.statusColors.textSecondary),
            ),
            Text(
              formatAdDate(today, lang),
              style: t.bodySmall,
            ),
            const SizedBox(height: KsSpace.s4),
            const _TodayCard(),
            const SizedBox(height: KsSpace.s4),
            const _MonthSummary(),
            const SizedBox(height: KsSpace.s4),
            const TrustCard(),
            const SizedBox(height: KsSpace.s4),
            const _LatestPayslip(),
            const SizedBox(height: KsSpace.s2),
            Card(
              child: MenuTile(
                icon: LucideIcons.calendarRange,
                title: l.shiftsTitle,
                onTap: () => context.push(Routes.workerShifts),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TodayCard extends ConsumerStatefulWidget {
  const _TodayCard();

  @override
  ConsumerState<_TodayCard> createState() => _TodayCardState();
}

class _TodayCardState extends ConsumerState<_TodayCard> {
  bool _busy = false;

  Future<void> _go(bool checkOut) async {
    final l = context.l10n;
    final raw = await context.push<String>(Routes.scan);
    if (raw == null || !mounted) return;
    setState(() => _busy = true);
    try {
      await ref.read(checkInProvider.notifier).submit(rawQr: raw, checkOut: checkOut);
      if (mounted) showSnack(context, checkOut ? l.checkOutSuccess : l.checkInSuccess);
    } on CheckInFailure catch (f) {
      if (mounted) await _problemDialog(f.problem);
    } catch (e) {
      if (mounted) await _messageDialog(errorText(context, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _problemDialog(CheckInProblem p) {
    final l = context.l10n;
    final msg = switch (p) {
      CheckInProblem.invalidQr => l.errInvalidQr,
      CheckInProblem.locationOff => l.errLocationOff,
      CheckInProblem.locationDenied => l.errLocationDenied,
      CheckInProblem.locationDeniedForever => l.errLocationDeniedForever,
    };
    final settings = p != CheckInProblem.invalidQr;
    return _messageDialog(msg, onSettings: settings ? () => CheckInController.openSettings(p) : null);
  }

  Future<void> _messageDialog(String msg, {VoidCallback? onSettings}) {
    final l = context.l10n;
    return showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        icon: Icon(LucideIcons.circleAlert, color: Theme.of(ctx).colorScheme.error),
        content: Text(msg, style: Theme.of(ctx).textTheme.bodyLarge),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(l.commonClose)),
          if (onSettings != null)
            FilledButton(
              onPressed: () {
                Navigator.pop(ctx);
                onSettings();
              },
              child: Text(l.openSettings),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final ci = ref.watch(checkInProvider);
    final month = ref.watch(currentMonthAttendanceProvider).value;
    final todayStatus = month?.dayFor(isoDate(nepalToday()))?.status;
    final (bg, fg) = attendanceColors(context, todayStatus);

    String line;
    if (ci.checkedOutAt != null) {
      line = l.homeCheckedOutAt(formatTime(ci.checkedOutAt!, lang));
    } else if (ci.checkedInAt != null) {
      line = l.homeCheckedInAt(formatTime(ci.checkedInAt!, lang));
    } else {
      line = todayStatus == null ? l.homeNotCheckedIn : l.homeScanHint;
    }
    final checkOut = ci.isIn;
    final done = ci.checkedOutAt != null;

    return SectionCard(
      title: l.homeTodayHajiri,
      trailing: todayStatus == null
          ? null
          : Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
              child: Text(attendanceLabel(l, todayStatus), style: t.labelSmall?.copyWith(color: fg)),
            ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(line, style: t.bodyLarge),
          const SizedBox(height: KsSpace.s4),
          SizedBox(
            height: 56,
            child: FilledButton.icon(
              key: const Key('check_in_button'),
              style: checkOut
                  ? FilledButton.styleFrom(
                      backgroundColor: Theme.of(context).colorScheme.secondary,
                    )
                  : null,
              onPressed: _busy ? null : () => _go(checkOut),
              icon: _busy
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : Icon(checkOut ? LucideIcons.logOut : LucideIcons.scanQrCode),
              label: Text(
                _busy
                    ? l.gettingLocation
                    : checkOut
                    ? l.termCheckOut
                    : l.termCheckIn,
                style: const TextStyle(fontSize: 18),
              ),
            ),
          ),
          if (done) ...[
            const SizedBox(height: KsSpace.s2),
            Text(l.checkOutSuccess, style: t.bodySmall, textAlign: TextAlign.center),
          ],
        ],
      ),
    );
  }
}

class _MonthSummary extends ConsumerWidget {
  const _MonthSummary();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final month = ref.watch(currentMonthAttendanceProvider);
    final bs = BsDate.fromAd(nepalToday());
    return SectionCard(
      title: '${l.homeThisMonth} · ${formatBsMonthYear(bs.year, bs.month, context.lang)}',
      trailing: IconButton(
        tooltip: l.navAttendance,
        onPressed: () => context.go(Routes.workerHajiri),
        icon: const Icon(LucideIcons.chevronRight),
      ),
      child: switch (month) {
        AsyncData(:final value) => AttendanceTotals(month: value),
        AsyncError(:final error) => Text(errorText(context, error)),
        _ => const LinearProgressIndicator(),
      },
    );
  }
}

class _LatestPayslip extends ConsumerWidget {
  const _LatestPayslip();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final lang = context.lang;
    final slips = ref.watch(payslipsProvider).value;
    if (slips == null || slips.isEmpty) return const SizedBox.shrink();
    final Payslip p = slips.first;
    return SectionCard(
      title: l.homeLatestPayslip,
      child: InkWell(
        onTap: () => context.go(Routes.payslip(p.id)),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(p.monthLabel(lang), style: Theme.of(context).textTheme.bodyLarge),
                  Text(
                    formatMoney(p.netPay, lang: lang),
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                ],
              ),
            ),
            StatusBadge(
              label: p.isPaid ? l.payrollPaid : l.talabPaymentPending,
              tone: p.isPaid ? Tone.success : Tone.warning,
            ),
            const Icon(LucideIcons.chevronRight),
          ],
        ),
      ),
    );
  }
}
