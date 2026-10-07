import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/month_switcher.dart';
import '../../data/worker_models.dart';
import '../../data/worker_repository.dart';

/// Worker's own hajiri: BS month calendar with coloured days + totals.
class MyHajiriScreen extends ConsumerStatefulWidget {
  const MyHajiriScreen({super.key});

  @override
  ConsumerState<MyHajiriScreen> createState() => _MyHajiriScreenState();
}

class _MyHajiriScreenState extends ConsumerState<MyHajiriScreen> {
  late BsDate _month = BsDate.fromAd(nepalToday()).firstOfMonth;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final key = (year: _month.year, month: _month.month);
    final value = ref.watch(myAttendanceProvider(key));
    final current = BsDate.fromAd(nepalToday()).firstOfMonth;
    return Scaffold(
      appBar: AppBar(title: Text(l.navAttendance)),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(myAttendanceProvider(key));
          try {
            await ref.read(myAttendanceProvider(key).future);
          } catch (_) {}
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(KsSpace.page, 0, KsSpace.page, KsSpace.s8),
          children: [
            MonthSwitcher(
              month: _month,
              canGoNext: _month.compareTo(current) < 0,
              onChanged: (m) => setState(() => _month = m),
            ),
            switch (value) {
              AsyncData(:final value) => Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SectionCard(child: _Calendar(month: _month, data: value)),
                  const SizedBox(height: KsSpace.s4),
                  SectionCard(title: l.commonTotal, child: AttendanceTotals(month: value)),
                  const SizedBox(height: KsSpace.s4),
                  const _Legend(),
                ],
              ),
              AsyncError(:final error) => ErrorView(
                error: error,
                onRetry: () => ref.invalidate(myAttendanceProvider(key)),
              ),
              _ => const Padding(
                padding: EdgeInsets.all(48),
                child: Center(child: CircularProgressIndicator()),
              ),
            },
          ],
        ),
      ),
    );
  }
}

class _Calendar extends StatelessWidget {
  const _Calendar({required this.month, required this.data});
  final BsDate month;
  final MyAttendanceMonth data;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final c = context.statusColors;
    final byDay = {for (final d in data.days) d.bsDay: d};
    final daysInMonth = data.days.isNotEmpty
        ? data.days.map((d) => d.bsDay).reduce((a, b) => a > b ? a : b)
        : month.daysInMonth;
    final firstAd = data.days.isNotEmpty
        ? (parseIsoDate(data.days.firstWhere((d) => d.bsDay == 1, orElse: () => data.days.first).date) ??
              month.toAd())
        : month.toAd();
    final leading = firstAd.weekday % 7; // Sunday-first grid
    final today = BsDate.fromAd(nepalToday());
    final names = lang == 'ne' ? weekdaysShortNe : weekdaysShortEn;

    return Column(
      children: [
        Row(
          children: [
            for (var i = 0; i < 7; i++)
              Expanded(
                child: Center(
                  child: Text(
                    names[i],
                    style: t.labelSmall?.copyWith(color: i == 6 ? c.dangerFg : c.textSecondary),
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: KsSpace.s2),
        GridView.count(
          crossAxisCount: 7,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 4,
          crossAxisSpacing: 4,
          children: [
            for (var i = 0; i < leading; i++) const SizedBox.shrink(),
            for (var d = 1; d <= daysInMonth; d++)
              Builder(
                builder: (context) {
                  final status = byDay[d]?.status;
                  final (bg, fg) = attendanceColors(context, status);
                  final isToday = today == BsDate(month.year, month.month, d);
                  return Semantics(
                    label: '${localizeDigits('$d', lang)} ${attendanceLabel(l, status)}',
                    child: Container(
                      decoration: BoxDecoration(
                        color: status == null ? null : bg,
                        borderRadius: BorderRadius.circular(KsRadius.md),
                        border: isToday
                            ? Border.all(color: Theme.of(context).colorScheme.primary, width: 2)
                            : null,
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        localizeDigits('$d', lang),
                        style: t.bodyMedium?.copyWith(
                          color: status == null ? null : fg,
                          fontWeight: status == null ? FontWeight.w400 : FontWeight.w600,
                        ),
                      ),
                    ),
                  );
                },
              ),
          ],
        ),
      ],
    );
  }
}

/// Totals row (present / half / absent / leave / OT), tolerant of whichever
/// keys the API includes.
class AttendanceTotals extends StatelessWidget {
  const AttendanceTotals({super.key, required this.month});
  final MyAttendanceMonth month;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    var totals = month.totals;
    if (totals.isEmpty) {
      // Derive from days when the API sends no totals.
      final m = <String, num>{};
      for (final d in month.days) {
        if (d.status != null) m[d.status!] = (m[d.status!] ?? 0) + 1;
      }
      totals = m;
    }
    final items = <(String, String, num)>[
      ('present', l.termPresent, totals['present'] ?? 0),
      ('half_day', l.termHalfDay, totals['half_day'] ?? 0),
      ('absent', l.termAbsent, totals['absent'] ?? 0),
      ('leave', l.termOnLeave, totals['leave'] ?? 0),
    ];
    final ot = totals['overtime_hours'];
    return Wrap(
      spacing: KsSpace.s2,
      runSpacing: KsSpace.s2,
      children: [
        for (final (status, label, n) in items)
          Builder(
            builder: (context) {
              final (bg, fg) = attendanceColors(context, status);
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(KsRadius.md)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      formatNumber(n, lang: lang),
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(color: fg),
                    ),
                    Text(label, style: Theme.of(context).textTheme.labelSmall?.copyWith(color: fg)),
                  ],
                ),
              );
            },
          ),
        if (ot != null && ot > 0)
          StatusBadge(label: l.hajiriOvertime(formatNumber(ot, lang: lang)), tone: Tone.info),
      ],
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend();

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Wrap(
      spacing: KsSpace.s3,
      runSpacing: KsSpace.s2,
      children: [
        for (final s in ['present', 'half_day', 'absent', 'leave', 'holiday', 'weekly_off'])
          Builder(
            builder: (context) {
              final (bg, fg) = attendanceColors(context, s);
              return Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 14,
                    height: 14,
                    decoration: BoxDecoration(
                      color: bg,
                      border: Border.all(color: fg),
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(attendanceLabel(l, s), style: Theme.of(context).textTheme.bodySmall),
                ],
              );
            },
          ),
      ],
    );
  }
}
