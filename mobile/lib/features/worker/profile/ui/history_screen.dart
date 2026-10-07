import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../data/worker_models.dart';
import '../../data/worker_repository.dart';

/// Verified employment history.
class HistoryScreen extends ConsumerWidget {
  const HistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final lang = context.lang;
    final value = ref.watch(historyProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.historyTitle)),
      body: AsyncBody<List<HistoryItem>>(
        value: value,
        onRetry: () => ref.invalidate(historyProvider),
        data: (items) => items.isEmpty
            ? EmptyState(icon: LucideIcons.briefcase, message: l.historyEmpty)
            : ListView.separated(
                padding: const EdgeInsets.all(KsSpace.page),
                itemCount: items.length,
                separatorBuilder: (_, _) => const SizedBox(height: KsSpace.s3),
                itemBuilder: (context, i) {
                  final h = items[i];
                  final t = Theme.of(context).textTheme;
                  String date(String? bs, String? ad) {
                    if (bs != null) return formatBsString(bs, lang);
                    final d = parseIsoDate(ad);
                    return d == null ? '' : formatBsDate(BsDate.fromAd(d), lang);
                  }

                  final from = date(h.startDateBs, h.startDate);
                  final to = h.endDate == null && h.endDateBs == null
                      ? l.commonNow
                      : date(h.endDateBs, h.endDate);
                  return Card(
                    child: Padding(
                      padding: const EdgeInsets.all(KsSpace.s4),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(LucideIcons.briefcase),
                          const SizedBox(width: KsSpace.s3),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(h.organizationName, style: t.titleSmall),
                                if (h.trade != null) Text(h.trade!, style: t.bodyMedium),
                                const SizedBox(height: KsSpace.s1),
                                Text('$from – $to', style: t.bodySmall),
                                if (h.months != null)
                                  Text(l.historyMonths(formatNumber(h.months!, lang: lang)), style: t.bodySmall),
                              ],
                            ),
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              StatusBadge(label: l.termVerified, tone: Tone.success, icon: LucideIcons.shieldCheck),
                              if (h.rating != null) ...[
                                const SizedBox(height: KsSpace.s2),
                                Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Icon(LucideIcons.star, size: 16, color: KsColors.warning600),
                                    const SizedBox(width: 2),
                                    Text(formatNumber(h.rating!, lang: lang), style: t.labelMedium),
                                  ],
                                ),
                              ],
                            ],
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
      ),
    );
  }
}
