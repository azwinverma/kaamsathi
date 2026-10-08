import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/api/cached.dart';
import '../../../../core/auth/session.dart';
import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/router/router.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/eco.dart';
import '../../../../core/widgets/signature/signature.dart';
import '../../../common/inbox/inbox_screen.dart';
import '../../career/career_data.dart';
import '../../career/ui/career_screen.dart';
import '../../checkin/data/check_in_service.dart';
import '../../data/worker_models.dart';
import '../../data/worker_repository.dart';
import '../../jobs/jobs_data.dart';
import '../../jobs/ui/jobs_screen.dart';
import '../../profile/ui/completeness_card.dart';
import '../../trust/trust_data.dart';

/// Worker Home — street-mural direction (B-WorkerHome).
///
/// Components: [MuralHeader] (greeting, काम lettering, skill-ladder chip),
/// today's hajiri card with the big QR action, tinted quick-fact tiles,
/// "Jobs for you" ([JobCardFrame] + verified-employer badge + match reason),
/// [ProfileCompletenessCard], [CareerCard], latest payslip.
class WorkerHomeScreen extends ConsumerWidget {
  const WorkerHomeScreen({super.key});

  static const _overlap = 36.0;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final me = ref.watch(sessionProvider).me;
    final profileValue = ref.watch(workerProfileProvider);
    final profile = profileValue.value;
    final name = profile?.displayName(lang) ?? me?.fullName ?? '';
    final today = nepalToday();
    final trust = ref.watch(trustProvider).value?.data;

    Future<void> refresh() async {
      ref.invalidate(workerProfileProvider);
      ref.invalidate(myAttendanceProvider);
      ref.invalidate(payslipsProvider);
      ref.invalidate(trustProvider);
      ref.invalidate(careerProvider);
      ref.invalidate(recommendedJobsProvider);
      try {
        await ref.read(currentMonthAttendanceProvider.future);
      } catch (_) {}
    }

    return Scaffold(
      body: MilestoneWatch(
        milestone: Milestone.profileComplete,
        reached: profileValue.hasValue ? profile?.completeness?.isComplete : null,
        child: RefreshIndicator(
          onRefresh: refresh,
          child: ListView(
            padding: EdgeInsets.zero,
            children: [
              MuralHeader(
                overlap: _overlap,
                lettering: 'काम',
                trailing: const InboxBell(onMural: true),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(l.homeHello, style: t.bodyMedium?.copyWith(color: KsMural.onGround)),
                    Text(
                      name,
                      key: const Key('home_name'),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: t.headlineMedium?.copyWith(color: KsMural.onGround, fontWeight: FontWeight.w700),
                    ),
                    Text(
                      '${weekdayName(today, lang)}, ${formatBsDate(BsDate.fromAd(today), lang)}',
                      style: t.bodyMedium?.copyWith(color: KsMural.onGround),
                    ),
                    if (trust != null) ...[
                      const SizedBox(height: KsSpace.s2),
                      _LadderChip(level: trust.verificationLevel),
                    ],
                  ],
                ),
              ),
              // The cards pull up over the bottom of the mural band.
              Transform.translate(
                offset: const Offset(0, -_overlap),
                child: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: KsSpace.page),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _TodayCard(),
                      SizedBox(height: KsSpace.s4),
                      _QuickFacts(),
                      SizedBox(height: KsSpace.s6),
                      _JobsForYou(),
                      ProfileCompletenessCard(),
                      CareerCard(showArt: true),
                      _LatestPayslip(),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Yellow "Skill ladder: level N" chip on the mural; opens the Passport.
class _LadderChip extends StatelessWidget {
  const _LadderChip({required this.level});
  final int level;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    return Semantics(
      button: true,
      child: InkWell(
        key: const Key('home_ladder_chip'),
        borderRadius: BorderRadius.circular(KsRadius.pill),
        onTap: () => context.push(Routes.workerPassport),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: KsSize.touchTarget),
          child: Align(
            alignment: Alignment.centerLeft,
            widthFactor: 1,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: KsMural.strokeYellow,
                borderRadius: BorderRadius.circular(KsRadius.pill),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(LucideIcons.check, size: 14, color: KsPalette.accentOnFill),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      l.homeLadderChip(localizeDigits('$level', context.lang)),
                      style: t.labelSmall?.copyWith(color: KsPalette.accentOnFill, fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ),
            ),
          ),
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
      builder:
          (ctx) => AlertDialog(
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
    final c = context.ks;
    final ci = ref.watch(checkInProvider);
    final month = ref.watch(currentMonthAttendanceProvider).value;
    final todayStatus = month?.dayFor(isoDate(nepalToday()))?.status;

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
    final light = Theme.of(context).brightness == Brightness.light;
    // Check in: ink button with the yellow QR mark (B-WorkerHome).
    // Check out: brand blue, so the two states never look alike.
    final buttonBg = checkOut ? c.actionPrimary : c.textPrimary;
    final buttonFg = checkOut ? c.onActionPrimary : c.surface;

    return Container(
      key: const Key('home_today'),
      padding: const EdgeInsets.all(KsSpace.s4),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(KsRadius.lg),
        boxShadow: KsShadow.floating,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(l.homeTodayHajiri, style: t.titleSmall),
                    Text(line, style: t.bodyMedium?.copyWith(color: c.textMuted)),
                  ],
                ),
              ),
              if (todayStatus != null) StatusBadge(label: attendanceLabel(l, todayStatus), tone: _tone(todayStatus)),
            ],
          ),
          const SizedBox(height: KsSpace.s3),
          SizedBox(
            height: 56,
            child: FilledButton.icon(
              key: const Key('check_in_button'),
              style: FilledButton.styleFrom(
                backgroundColor: buttonBg,
                foregroundColor: buttonFg,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(KsRadius.md)),
              ),
              onPressed: _busy ? null : () => _go(checkOut),
              icon:
                  _busy
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                      : Icon(
                        checkOut ? LucideIcons.logOut : LucideIcons.scanQrCode,
                        size: 24,
                        color: !checkOut && light ? KsMural.strokeYellow : buttonFg,
                      ),
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

  Tone _tone(String status) => switch (status) {
    'present' => Tone.success,
    'absent' => Tone.danger,
    'half_day' => Tone.warning,
    'leave' => Tone.info,
    _ => Tone.neutral,
  };
}

/// Two tinted tiles: days worked this month (teal) and reliability score
/// (yellow). Each opens where the number comes from.
class _QuickFacts extends ConsumerWidget {
  const _QuickFacts();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final lang = context.lang;
    final c = context.ks;
    final month = ref.watch(currentMonthAttendanceProvider).value;
    final trust = ref.watch(trustProvider);
    final hideScore = trust.hasError && isFeatureUnavailable(trust.error);
    final score = trust.value?.data.reliabilityScore;
    num? worked;
    if (month != null) {
      var present = month.totals['present'];
      var half = month.totals['half_day'];
      if (month.totals.isEmpty) {
        present = month.days.where((d) => d.status == 'present').length;
        half = month.days.where((d) => d.status == 'half_day').length;
      }
      worked = (present ?? 0) + (half ?? 0) / 2;
    }
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: _FactTile(
            key: const Key('fact_days'),
            background: c.tealSubtle,
            labelColor: c.tealText,
            label: l.homeThisMonth,
            value: worked == null ? '–' : formatNumber(worked, lang: lang),
            caption: l.homeDaysWorked,
            onTap: () => context.go(Routes.workerHajiri),
          ),
        ),
        if (!hideScore) ...[
          const SizedBox(width: KsSpace.s3),
          Expanded(
            child: _FactTile(
              key: const Key('fact_score'),
              background: c.yellowSubtle,
              labelColor: c.textPrimary,
              label: l.trustScoreLabel,
              value: score == null ? '–' : localizeDigits('$score', lang),
              caption: score == null ? l.homeScoreSoon : l.homeOutOf100,
              onTap: () => context.go(Routes.workerProfile),
            ),
          ),
        ],
      ],
    );
  }
}

class _FactTile extends StatelessWidget {
  const _FactTile({
    super.key,
    required this.background,
    required this.labelColor,
    required this.label,
    required this.value,
    required this.caption,
    required this.onTap,
  });

  final Color background;
  final Color labelColor;
  final String label;
  final String value;
  final String caption;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final c = context.ks;
    return Material(
      color: background,
      borderRadius: BorderRadius.circular(KsRadius.card),
      child: InkWell(
        borderRadius: BorderRadius.circular(KsRadius.card),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: t.labelMedium?.copyWith(color: labelColor, fontWeight: FontWeight.w600)),
              Text(
                value,
                style: t.headlineMedium?.copyWith(
                  color: c.textPrimary,
                  fontWeight: FontWeight.w700,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
              Text(caption, style: t.bodyMedium?.copyWith(color: c.textSecondary)),
            ],
          ),
        ),
      ),
    );
  }
}

/// Top two recommended jobs with the verified-employer badge and why they
/// match. Hidden while the jobs service is off.
class _JobsForYou extends ConsumerWidget {
  const _JobsForYou();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final value = ref.watch(recommendedJobsProvider);
    if (value.hasError && isFeatureUnavailable(value.error)) return const SizedBox.shrink();
    final jobs = value.value;
    return Padding(
      key: const Key('home_jobs_for_you'),
      padding: const EdgeInsets.only(bottom: KsSpace.s4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: Text(l.jobsTitle, style: t.titleMedium?.copyWith(fontWeight: FontWeight.w700))),
              TextButton(
                key: const Key('home_jobs_all'),
                onPressed: () => context.go(Routes.workerJobs),
                child: Text(l.homeSeeAll),
              ),
            ],
          ),
          if (value.hasError)
            Text(errorText(context, value.error), style: t.bodyMedium)
          else if (jobs == null)
            const LinearProgressIndicator()
          else if (jobs.isEmpty)
            InfoNote(text: l.homeNoJobs, icon: LucideIcons.mapPin, tone: Tone.neutral)
          else
            for (final j in jobs.take(2)) ...[
              JobCardFrame(
                key: Key('home_job_${j.id}'),
                onTap: () => context.go(Routes.workerJobs),
                child: JobFacts(job: j, showMatchReason: true),
              ),
              const SizedBox(height: KsSpace.s3),
            ],
        ],
      ),
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
      key: const Key('home_latest_payslip'),
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
                    style: Theme.of(
                      context,
                    ).textTheme.headlineMedium?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
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
