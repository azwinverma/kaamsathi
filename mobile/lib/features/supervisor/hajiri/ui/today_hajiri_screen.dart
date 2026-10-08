import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/auth/session.dart';
import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../common/inbox/inbox_screen.dart';
import '../data/attendance_models.dart';
import '../data/attendance_queue.dart';
import '../hajiri_providers.dart';
import 'hajiri_row.dart';
import 'site_picker.dart';
import 'sync_banner.dart';

/// A roster row merged with any local (unsynced) change.
class EffectiveRow {
  const EffectiveRow(this.row, this.local);
  final RosterRow row;
  final QueuedAttendance? local;

  String? get status => local?.status ?? row.record?.status;
  int get overtimeMinutes => local?.overtimeMinutes ?? row.record?.overtimeMinutes ?? 0;
}

class TodayHajiriScreen extends ConsumerWidget {
  const TodayHajiriScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final session = ref.watch(sessionProvider);
    final orgId = session.orgId;
    final date = ref.watch(hajiriDateProvider);
    final dateIso = isoDate(date);
    if (orgId == null) return const SizedBox.shrink();
    final key = (orgId: orgId, siteId: session.siteId, date: dateIso);
    final roster = ref.watch(dayRosterProvider(key));
    final sync = ref.watch(syncControllerProvider);
    final local = sync.byKey;

    Future<void> refresh() async {
      await ref.read(syncControllerProvider.notifier).syncNow();
      ref.invalidate(dayRosterProvider(key));
      try {
        await ref.read(dayRosterProvider(key).future);
      } catch (_) {}
    }

    return Scaffold(
      appBar: AppBar(title: Text(l.navAttendance), actions: const [SitePickerButton(), InboxBell()]),
      body: RefreshIndicator(
        onRefresh: refresh,
        child: AsyncBody<DayRoster>(
          value: roster,
          onRetry: () => ref.invalidate(dayRosterProvider(key)),
          data: (day) {
            final rows = [for (final r in day.rows) EffectiveRow(r, local['${r.employmentId}|$dateIso'])];
            return _HajiriList(orgId: orgId, date: date, day: day, rows: rows);
          },
        ),
      ),
    );
  }
}

class _HajiriList extends ConsumerWidget {
  const _HajiriList({required this.orgId, required this.date, required this.day, required this.rows});

  final String orgId;
  final DateTime date;
  final DayRoster day;
  final List<EffectiveRow> rows;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final lang = context.lang;
    final ctrl = ref.read(syncControllerProvider.notifier);
    final dateIso = isoDate(date);

    final counts = <String?, int>{};
    for (final r in rows) {
      final s = AttendanceStatus.markable.contains(r.status) ? r.status : null;
      counts[s] = (counts[s] ?? 0) + 1;
    }
    final unmarked = rows.where((r) => r.status == null).toList();

    Future<void> markAll() async {
      if (unmarked.isEmpty) {
        showSnack(context, l.hajiriAllMarked);
        return;
      }
      final ok = await showDialog<bool>(
        context: context,
        builder:
            (ctx) => AlertDialog(
              title: Text(l.hajiriMarkAllPresent),
              content: Text(l.hajiriMarkAllConfirm(localizeDigits('${unmarked.length}', lang))),
              actions: [
                TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l.commonCancel)),
                FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(l.commonConfirm)),
              ],
            ),
      );
      if (ok != true) return;
      for (final r in unmarked) {
        await ctrl.record(
          orgId: orgId,
          employmentId: r.row.employmentId,
          date: dateIso,
          status: AttendanceStatus.present,
        );
      }
    }

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(KsSpace.page, KsSpace.page, KsSpace.page, 96),
      children: [
        _DateHeader(date: date),
        const SizedBox(height: KsSpace.s3),
        const _DateStrip(),
        const SizedBox(height: KsSpace.s4),
        if (day.fromCache) _Note(icon: LucideIcons.wifiOff, text: l.hajiriOfflineCached),
        if (day.isHoliday) _Note(icon: LucideIcons.sparkles, text: l.hajiriHoliday(day.holidayName ?? '')),
        const SyncBanner(),
        Wrap(
          spacing: KsSpace.s2,
          runSpacing: KsSpace.s2,
          children: [
            for (final s in [...AttendanceStatus.markable, null]) _CountChip(status: s, count: counts[s] ?? 0),
          ],
        ),
        const SizedBox(height: KsSpace.s4),
        if (rows.isEmpty)
          EmptyState(icon: LucideIcons.users, message: l.hajiriNoWorkers)
        else ...[
          OutlinedButton.icon(
            key: const Key('mark_all_present'),
            onPressed: markAll,
            icon: const Icon(LucideIcons.checkCheck, size: 20),
            label: Text(l.hajiriMarkAllPresent),
          ),
          const SizedBox(height: KsSpace.s3),
          for (final r in rows) ...[
            HajiriRow(
              key: ValueKey(r.row.employmentId),
              name: r.row.workerName,
              photo: r.row.photo,
              designation: r.row.designation,
              status: r.status,
              overtimeMinutes: r.overtimeMinutes,
              syncState: r.local?.state,
              errorMessage: r.local?.errorMessage,
              onStatus:
                  (s) => ctrl.record(
                    orgId: orgId,
                    employmentId: r.row.employmentId,
                    date: dateIso,
                    status: s,
                    overtimeMinutes:
                        s == AttendanceStatus.present || s == AttendanceStatus.halfDay ? r.overtimeMinutes : 0,
                  ),
              onOvertime:
                  (m) => ctrl.record(
                    orgId: orgId,
                    employmentId: r.row.employmentId,
                    date: dateIso,
                    status: r.status ?? AttendanceStatus.present,
                    overtimeMinutes: m,
                  ),
              onRetry: r.local == null ? null : () => ctrl.retry(r.local!.clientUuid),
              onDiscard: r.local == null ? null : () => ctrl.discard(r.local!.clientUuid),
            ),
            const SizedBox(height: KsSpace.s3),
          ],
        ],
      ],
    );
  }
}

class _DateHeader extends StatelessWidget {
  const _DateHeader({required this.date});
  final DateTime date;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final bs = BsDate.fromAd(date);
    final isToday = date == nepalToday();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '${isToday ? '${context.l10n.commonToday} · ' : ''}${weekdayName(date, lang)}',
          style: t.bodyMedium?.copyWith(color: context.statusColors.textSecondary),
        ),
        Text(formatBsDate(bs, lang), style: t.displaySmall),
        Text(
          '${formatAdDate(date, lang)} ${context.l10n.termAd}',
          style: t.bodyMedium?.copyWith(color: context.statusColors.textSecondary),
        ),
      ],
    );
  }
}

/// Today + the previous 6 days.
class _DateStrip extends ConsumerWidget {
  const _DateStrip();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lang = context.lang;
    final l = context.l10n;
    final selected = ref.watch(hajiriDateProvider);
    final today = nepalToday();
    final days = [for (var i = 0; i < 7; i++) DateTime(today.year, today.month, today.day - i)];
    return SizedBox(
      height: 64,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: days.length,
        separatorBuilder: (_, _) => const SizedBox(width: KsSpace.s2),
        itemBuilder: (context, i) {
          final d = days[i];
          final sel = d == selected;
          final scheme = Theme.of(context).colorScheme;
          final top =
              i == 0
                  ? l.commonToday
                  : i == 1
                  ? l.commonYesterday
                  : weekdayName(d, lang, short: true);
          return Material(
            color: sel ? scheme.primary : scheme.surface,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(KsRadius.md),
              side: BorderSide(color: sel ? scheme.primary : context.statusColors.border),
            ),
            child: InkWell(
              borderRadius: BorderRadius.circular(KsRadius.md),
              onTap: () => ref.read(hajiriDateProvider.notifier).set(d),
              child: Container(
                constraints: const BoxConstraints(minWidth: 64),
                padding: const EdgeInsets.symmetric(horizontal: 12),
                alignment: Alignment.center,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      top,
                      style: TextStyle(
                        fontSize: 12,
                        color: sel ? scheme.onPrimary : context.statusColors.textSecondary,
                      ),
                    ),
                    Text(
                      localizeDigits('${BsDate.fromAd(d).day}', lang),
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                        color: sel ? scheme.onPrimary : scheme.onSurface,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _CountChip extends StatelessWidget {
  const _CountChip({required this.status, required this.count});
  final String? status;
  final int count;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final (bg, fg) =
        status == null
            ? (context.statusColors.neutralBg, context.statusColors.neutralFg)
            : attendanceColors(context, status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Text(
        '${attendanceLabel(l, status)} ${localizeDigits('$count', context.lang)}',
        style: Theme.of(context).textTheme.labelMedium?.copyWith(color: fg, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class _Note extends StatelessWidget {
  const _Note({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final c = context.statusColors;
    return Container(
      margin: const EdgeInsets.only(bottom: KsSpace.s3),
      padding: const EdgeInsets.all(KsSpace.s3),
      decoration: BoxDecoration(color: c.infoBg, borderRadius: BorderRadius.circular(KsRadius.md)),
      child: Row(
        children: [
          Icon(icon, size: 18, color: c.infoFg),
          const SizedBox(width: KsSpace.s2),
          Expanded(child: Text(text, style: TextStyle(color: c.infoFg))),
        ],
      ),
    );
  }
}
