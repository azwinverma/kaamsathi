import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../core/l10n/l10n.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/eco.dart';
import 'roster_models.dart';
import 'timesheet_models.dart';

(String, Tone) timesheetStatus(AppLocalizations l, String status) => switch (status) {
  'submitted' => (l.tsStatusSubmitted, Tone.info),
  'approved' => (l.payrollApproved, Tone.success),
  'rejected' => (l.tsStatusRejected, Tone.danger),
  _ => (l.statusDraft, Tone.neutral),
};

String hoursText(AppLocalizations l, int minutes, String lang) => l.tsHours(formatHours(minutes, lang));

/// Totals + the 7 days of a timesheet.
class TimesheetDetails extends StatelessWidget {
  const TimesheetDetails({super.key, required this.sheet, required this.weekStart, this.showDays = true});
  final Timesheet sheet;
  final DateTime weekStart;
  final bool showDays;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final c = context.statusColors;
    final s = sheet;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        KeyValueRow(label: l.tsRegular, value: hoursText(l, s.regularMinutes, lang)),
        KeyValueRow(label: l.tsOtClaimed, value: hoursText(l, s.overtimeClaimed, lang)),
        if (s.overtimeApproved != null)
          KeyValueRow(label: l.tsOtApproved, value: hoursText(l, s.overtimeApproved!, lang)),
        if (s.overCap) ...[
          const SizedBox(height: KsSpace.s2),
          InfoNote(text: l.tsOverCap, icon: LucideIcons.triangleAlert, tone: Tone.warning),
        ],
        if (s.note?.isNotEmpty ?? false) ...[
          const SizedBox(height: KsSpace.s2),
          Text('${l.tsNote}: ${s.note}', style: t.bodySmall),
        ],
        if (showDays) ...[
          const SizedBox(height: KsSpace.s2),
          const Divider(height: 1),
          for (final d in weekDays(weekStart))
            Builder(
              builder: (_) {
                final day = s.dayFor(isoDate(d));
                final (bg, fg) = attendanceColors(context, day?.status);
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    children: [
                      SizedBox(
                        width: 64,
                        child: Text(
                          '${weekdayName(d, lang, short: true)} ${localizeDigits('${BsDate.fromAd(d).day}', lang)}',
                          style: t.bodyMedium?.copyWith(color: c.textSecondary),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
                        child: Text(attendanceShort(l, day?.status), style: t.labelSmall?.copyWith(color: fg)),
                      ),
                      const SizedBox(width: KsSpace.s2),
                      Expanded(
                        child: Wrap(
                          alignment: WrapAlignment.end,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          spacing: KsSpace.s2,
                          runSpacing: 2,
                          children: [
                            Text(
                              day == null || day.workedMinutes + day.regularMinutes == 0
                                  ? '–'
                                  : hoursText(l, day.workedMinutes > 0 ? day.workedMinutes : day.regularMinutes, lang),
                              style: t.bodyMedium?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
                            ),
                            if ((day?.overtimeMinutes ?? 0) > 0)
                              StatusBadge(
                                label: l.tsOtShort(formatHours(day!.overtimeMinutes, lang)),
                                tone: Tone.warning,
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
        ],
      ],
    );
  }
}
