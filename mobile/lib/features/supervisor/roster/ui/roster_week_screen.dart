import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/auth/session.dart';
import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/eco.dart';
import '../../../common/roster_models.dart';
import '../../../worker/roster/ui/my_shifts_screen.dart';
import '../../hajiri/ui/site_picker.dart';
import '../roster_data.dart';

/// Supervisor: week roster for the selected site(s); tap a cell to edit.
class RosterWeekScreen extends ConsumerStatefulWidget {
  const RosterWeekScreen({super.key});

  @override
  ConsumerState<RosterWeekScreen> createState() => _RosterWeekScreenState();
}

class _RosterWeekScreenState extends ConsumerState<RosterWeekScreen> {
  late DateTime _week = weekStartSunday(nepalToday());

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final session = ref.watch(sessionProvider);
    final orgId = session.orgId;
    if (orgId == null) return const SizedBox.shrink();
    final key = (orgId: orgId, siteId: session.siteId, weekStart: _week);
    final value = ref.watch(rosterWeekProvider(key));
    final shifts = ref.watch(orgShiftsProvider).value ?? const <ShiftRef>[];
    return Scaffold(
      appBar: AppBar(title: Text(l.rosterTitle), actions: const [SitePickerButton()]),
      body: Column(
        children: [
          WeekSwitcher(weekStart: _week, onChanged: (w) => setState(() => _week = w)),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(rosterWeekProvider(key));
                ref.invalidate(orgShiftsProvider);
                try {
                  await ref.read(rosterWeekProvider(key).future);
                } catch (_) {}
              },
              child: FeatureAsyncBody<RosterWeek>(
                value: value,
                onRetry: () => ref.invalidate(rosterWeekProvider(key)),
                data:
                    (w) =>
                        w.rows.isEmpty
                            ? ListView(children: [EmptyState(icon: LucideIcons.calendarRange, message: l.rosterEmpty)])
                            : _Grid(week: w, shifts: shifts, onTap: (row, date) => _edit(key, w, row, date, shifts)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _edit(RosterKey key, RosterWeek week, RosterWeekRow row, String date, List<ShiftRef> shifts) async {
    final l = context.l10n;
    final lang = context.lang;
    final current = row.cells[date];
    final warnings = row.warnings[date] ?? const <String>[];
    // Result: ('shift', id) | ('off', null) | ('clear', null)
    final choice = await showModalBottomSheet<(String, String?)>(
      context: context,
      builder:
          (ctx) => SafeArea(
            child: ListView(
              shrinkWrap: true,
              children: [
                ListTile(
                  title: Text(row.workerName, style: Theme.of(ctx).textTheme.titleMedium),
                  subtitle: Text(formatBsOrAd(null, date, lang)),
                ),
                for (final w in warnings)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(KsSpace.page, 0, KsSpace.page, KsSpace.s2),
                    child: InfoNote(
                      key: Key('roster_warning_$w'),
                      text: rosterWarningLabel(l, w, week.warningLabels),
                      icon: LucideIcons.triangleAlert,
                      tone: Tone.warning,
                    ),
                  ),
                for (final s in shifts)
                  ListTile(
                    leading: const Icon(LucideIcons.clock),
                    title: Text(s.label(lang)),
                    trailing:
                        current?.shiftId == s.id && !(current?.isOff ?? false) ? const Icon(LucideIcons.check) : null,
                    onTap: () => Navigator.pop(ctx, ('shift', s.id)),
                  ),
                ListTile(
                  leading: const Icon(LucideIcons.coffee),
                  title: Text(l.shiftsOff),
                  trailing: current?.isOff ?? false ? const Icon(LucideIcons.check) : null,
                  onTap: () => Navigator.pop(ctx, ('off', null)),
                ),
                ListTile(
                  leading: const Icon(LucideIcons.eraser),
                  title: Text(l.rosterClear),
                  onTap: () => Navigator.pop(ctx, ('clear', null)),
                ),
              ],
            ),
          ),
    );
    if (choice == null || !mounted) return;
    try {
      final result = await ref
          .read(rosterRepositoryProvider)
          .setCell(
            employmentId: row.employmentId,
            date: date,
            shiftId: choice.$1 == 'shift' ? choice.$2 : null,
            siteId: current?.siteId ?? key.siteId,
            isOff: choice.$1 == 'off',
          );
      ref.invalidate(rosterWeekProvider(key));
      if (!mounted) return;
      final saved =
          result.notifiedWorkers > 0
              ? l.rosterNotified(localizeDigits('${result.notifiedWorkers}', lang))
              : l.commonSaved;
      // Warnings never block the save; show them with the confirmation.
      final notes = {
        for (final w in result.warnings)
          (w.message?.isNotEmpty ?? false) ? w.message! : rosterWarningLabel(l, w.code, week.warningLabels),
      };
      showSnack(context, [saved, ...notes].join('\n'));
    } catch (e) {
      if (mounted) showSnack(context, errorText(context, e), error: true);
    }
  }
}

String rosterWarningLabel(AppLocalizations l, String code, Map<String, String> server) {
  final s = server[code];
  if (s != null && s.isNotEmpty) return s;
  return switch (code) {
    RosterWarning.onLeave => l.rosterWarnOnLeave,
    RosterWarning.holiday => l.rosterWarnHoliday,
    RosterWarning.weeklyOff => l.rosterWarnWeeklyOff,
    RosterWarning.conflictElsewhere => l.rosterWarnConflict,
    _ => code,
  };
}

class _Grid extends StatelessWidget {
  const _Grid({required this.week, required this.shifts, required this.onTap});
  final RosterWeek week;
  final List<ShiftRef> shifts;
  final void Function(RosterWeekRow row, String date) onTap;

  static const _nameW = 128.0;
  static const _cellW = 52.0;
  static const _rowH = 52.0;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final c = context.ks;
    final byId = {for (final s in shifts) s.id: s};
    final today = isoDate(nepalToday());

    Widget header(({String date, String? dateBs}) d) {
      final ad = parseIsoDate(d.date);
      final bs = BsDate.tryParse(d.dateBs) ?? (ad == null ? null : BsDate.fromAd(ad));
      return SizedBox(
        width: _cellW,
        height: 40,
        // Devanagari line heights are taller: scale down rather than overflow.
        child: FittedBox(
          fit: BoxFit.scaleDown,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                ad == null ? '' : weekdayName(ad, lang, short: true),
                style: t.labelSmall?.copyWith(color: c.textMuted),
              ),
              Text(
                bs == null ? '' : localizeDigits('${bs.day}', lang),
                style: t.labelMedium?.copyWith(color: d.date == today ? Theme.of(context).colorScheme.primary : null),
              ),
            ],
          ),
        ),
      );
    }

    Widget cell(RosterWeekRow row, String date) {
      final v = row.cells[date];
      final shift = v?.shiftId == null ? null : byId[v!.shiftId];
      final (bg, fg) =
          v == null
              ? (Colors.transparent, c.textMuted)
              : v.isOff
              ? (c.warningSoft, c.warningText)
              : (c.infoSoft, c.infoText);
      final text = v == null ? '' : (v.isOff ? l.rosterOffShort : (shift?.short ?? '•'));
      final warns = row.warnings[date] ?? const <String>[];
      final warnText = warns.map((w) => rosterWarningLabel(l, w, week.warningLabels)).join(', ');
      return Semantics(
        button: true,
        label:
            '${row.workerName} $date ${v == null ? l.shiftsNone : (v.isOff ? l.shiftsOff : shift?.name ?? '')}'
            '${warns.isEmpty ? '' : ' · $warnText'}',
        child: InkWell(
          onTap: () => onTap(row, date),
          borderRadius: BorderRadius.circular(KsRadius.xs),
          child: Container(
            width: _cellW - 4,
            height: 40,
            margin: const EdgeInsets.all(2),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(KsRadius.xs),
              border: v == null ? Border.all(color: c.border) : null,
            ),
            child: Stack(
              clipBehavior: Clip.none,
              alignment: Alignment.center,
              children: [
                Text(text, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: fg)),
                if (warns.isNotEmpty)
                  Positioned(
                    top: -2,
                    right: -2,
                    child: Container(
                      key: Key('roster_warn_${row.employmentId}_$date'),
                      width: 16,
                      height: 16,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: Theme.of(context).colorScheme.error, shape: BoxShape.circle),
                      child: Text(
                        '!',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Theme.of(context).colorScheme.onError),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      );
    }

    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(bottom: 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: KsSpace.page, vertical: KsSpace.s1),
            child: Text(l.rosterTapHint, style: t.bodySmall),
          ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: _nameW,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 40),
                    for (final r in week.rows)
                      Container(
                        height: _rowH,
                        padding: const EdgeInsets.only(left: KsSpace.page, right: 4),
                        alignment: Alignment.centerLeft,
                        decoration: BoxDecoration(border: Border(top: BorderSide(color: c.border))),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(r.workerName, style: t.labelMedium, maxLines: 1, overflow: TextOverflow.ellipsis),
                            if (r.designation != null)
                              Text(r.designation!, style: t.bodySmall, maxLines: 1, overflow: TextOverflow.ellipsis),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.only(right: KsSpace.page),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [for (final d in week.days) header(d)]),
                      for (final r in week.rows)
                        Container(
                          height: _rowH,
                          decoration: BoxDecoration(border: Border(top: BorderSide(color: c.border))),
                          child: Row(children: [for (final d in week.days) cell(r, d.date)]),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          if (shifts.isNotEmpty)
            Padding(
              padding: const EdgeInsets.all(KsSpace.page),
              child: Wrap(
                spacing: KsSpace.s3,
                runSpacing: KsSpace.s1,
                children: [
                  for (final s in shifts) Text('${s.short} = ${s.label(lang)}', style: t.bodySmall),
                  Text('${l.rosterOffShort} = ${l.shiftsOff}', style: t.bodySmall),
                  if (week.rows.any((r) => r.warnings.isNotEmpty)) Text(l.rosterWarnLegend, style: t.bodySmall),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
