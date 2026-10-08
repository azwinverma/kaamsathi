import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/l10n/l10n.dart';
import '../../../core/router/router.dart';
import '../../../core/theme/tokens.dart';

/// Which half of the Work tab is showing.
enum WorkSection { hajiri, payslips }

/// Top of the Work tab: Hajiri / Payslips switch plus shortcuts to shifts
/// and timesheets, so everything about "my work" is one tab away.
class WorkSwitcher extends StatelessWidget {
  const WorkSwitcher({super.key, required this.current});

  final WorkSection current;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Padding(
      padding: const EdgeInsets.only(top: KsSpace.s3, bottom: KsSpace.s2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SegmentedButton<WorkSection>(
            key: const Key('work_switcher'),
            showSelectedIcon: false,
            segments: [
              ButtonSegment(
                value: WorkSection.hajiri,
                icon: const Icon(LucideIcons.calendarCheck, size: 18),
                label: Text(l.workHajiri, key: const Key('work_seg_hajiri')),
              ),
              ButtonSegment(
                value: WorkSection.payslips,
                icon: const Icon(LucideIcons.wallet, size: 18),
                label: Text(l.workPayslips, key: const Key('work_seg_payslips')),
              ),
            ],
            selected: {current},
            onSelectionChanged: (s) {
              if (s.first == current) return;
              context.go(s.first == WorkSection.hajiri ? Routes.workerHajiri : Routes.workerTalab);
            },
          ),
          const SizedBox(height: KsSpace.s2),
          Wrap(
            spacing: KsSpace.s2,
            runSpacing: KsSpace.s2,
            children: [
              _Shortcut(
                key: const Key('work_shifts'),
                icon: LucideIcons.calendarRange,
                label: l.shiftsTitle,
                onTap: () => context.push(Routes.workerShifts),
              ),
              _Shortcut(
                key: const Key('work_timesheets'),
                icon: LucideIcons.clock,
                label: l.tsTitle,
                onTap: () => context.push(Routes.workerTimesheets),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Shortcut extends StatelessWidget {
  const _Shortcut({super.key, required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(KsSize.touchTarget, KsSize.touchTarget),
        padding: const EdgeInsets.symmetric(horizontal: 14),
        foregroundColor: context.ks.textPrimary,
        side: BorderSide(color: context.ks.borderStrong),
        textStyle: Theme.of(context).textTheme.labelMedium,
      ),
      onPressed: onTap,
      icon: Icon(icon, size: 18),
      label: Text(label),
    );
  }
}
