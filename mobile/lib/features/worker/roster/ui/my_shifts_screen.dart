import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/api/cached.dart';
import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/eco.dart';
import '../../../common/roster_models.dart';
import '../my_roster_data.dart';

/// `‹ Week from 19 Ashwin 2083 ›` switcher (Sunday-start weeks).
class WeekSwitcher extends StatelessWidget {
  const WeekSwitcher({super.key, required this.weekStart, required this.onChanged});
  final DateTime weekStart;
  final ValueChanged<DateTime> onChanged;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: KsSpace.s2, vertical: KsSpace.s1),
      child: Row(
        children: [
          IconButton(
            tooltip: l.weekPrev,
            onPressed: () => onChanged(weekStart.subtract(const Duration(days: 7))),
            icon: const Icon(LucideIcons.chevronLeft),
          ),
          Expanded(
            child: Text(
              l.weekOf(formatBsDate(BsDate.fromAd(weekStart), context.lang)),
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ),
          IconButton(
            tooltip: l.weekNext,
            onPressed: () => onChanged(weekStart.add(const Duration(days: 7))),
            icon: const Icon(LucideIcons.chevronRight),
          ),
        ],
      ),
    );
  }
}

class MyShiftsScreen extends ConsumerStatefulWidget {
  const MyShiftsScreen({super.key});

  @override
  ConsumerState<MyShiftsScreen> createState() => _MyShiftsScreenState();
}

class _MyShiftsScreenState extends ConsumerState<MyShiftsScreen> {
  late DateTime _week = weekStartSunday(nepalToday());

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final c = context.statusColors;
    final value = ref.watch(myRosterProvider(_week));
    final today = nepalToday();
    return Scaffold(
      appBar: AppBar(title: Text(l.shiftsTitle)),
      body: Column(
        children: [
          WeekSwitcher(weekStart: _week, onChanged: (w) => setState(() => _week = w)),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(myRosterProvider(_week));
                try {
                  await ref.read(myRosterProvider(_week).future);
                } catch (_) {}
              },
              child: FeatureAsyncBody<Cached<MyRosterWeek>>(
                value: value,
                onRetry: () => ref.invalidate(myRosterProvider(_week)),
                data: (cached) {
                  final w = cached.data;
                  return ListView(
                    padding: const EdgeInsets.fromLTRB(KsSpace.page, 0, KsSpace.page, KsSpace.page),
                    children: [
                      if (cached.fromCache) const CachedNotice(),
                      if (w.entries.isEmpty)
                        Padding(
                          padding: const EdgeInsets.only(bottom: KsSpace.s3),
                          child: Text(l.shiftsEmpty, style: t.bodyMedium),
                        ),
                      for (final d in weekDays(_week))
                        Builder(
                          builder: (_) {
                            final s = w.on(d);
                            final isToday = d == today;
                            final (label, tone) =
                                s == null
                                    ? (l.shiftsNone, Tone.neutral)
                                    : s.isOff
                                    ? (l.shiftsOff, Tone.warning)
                                    : (s.shift?.label(lang) ?? l.shiftsNone, Tone.info);
                            return Card(
                              shape:
                                  isToday
                                      ? RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(KsRadius.lg),
                                        side: BorderSide(color: Theme.of(context).colorScheme.primary, width: 2),
                                      )
                                      : null,
                              child: ListTile(
                                leading: SizedBox(
                                  width: 52,
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Text(
                                        weekdayName(d, lang, short: true),
                                        style: t.labelSmall?.copyWith(color: c.textSecondary),
                                      ),
                                      Text(localizeDigits('${BsDate.fromAd(d).day}', lang), style: t.titleMedium),
                                    ],
                                  ),
                                ),
                                title: Text(label),
                                subtitle: Text(
                                  [
                                    if (isToday) l.commonToday,
                                    if (s?.siteName != null) s!.siteName!,
                                    if (s?.organizationName != null) s!.organizationName!,
                                    if (s?.note?.isNotEmpty ?? false) s!.note!,
                                  ].join(' · '),
                                ),
                                trailing: StatusBadge(
                                  label: s == null ? '–' : (s.isOff ? l.rosterOffShort : (s.shift?.short ?? '–')),
                                  tone: tone,
                                ),
                              ),
                            );
                          },
                        ),
                    ],
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}
