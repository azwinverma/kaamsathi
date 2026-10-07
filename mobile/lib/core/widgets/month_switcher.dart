import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../format.dart';
import '../l10n/l10n.dart';
import '../theme/tokens.dart';

/// `‹  Ashwin 2083  ›` BS month switcher.
class MonthSwitcher extends StatelessWidget {
  const MonthSwitcher({super.key, required this.month, required this.onChanged, this.canGoNext = true});

  final BsDate month;
  final ValueChanged<BsDate> onChanged;
  final bool canGoNext;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: KsSpace.s2, vertical: KsSpace.s2),
      child: Row(
        children: [
          IconButton(
            tooltip: l.commonPreviousMonth,
            onPressed: () => onChanged(month.addMonths(-1)),
            icon: const Icon(LucideIcons.chevronLeft),
          ),
          Expanded(
            child: Text(
              formatBsMonthYear(month.year, month.month, context.lang),
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge,
            ),
          ),
          IconButton(
            tooltip: l.commonNextMonth,
            onPressed: canGoNext ? () => onChanged(month.addMonths(1)) : null,
            icon: const Icon(LucideIcons.chevronRight),
          ),
        ],
      ),
    );
  }
}
