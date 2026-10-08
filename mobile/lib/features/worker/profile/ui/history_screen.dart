import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/router/router.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/eco.dart';
import '../../employment/employment_data.dart';

/// Verified work history: every employment on KaamSathi (GET /me/employments).
/// Tapping one opens the contract, rating and complaint actions.
class HistoryScreen extends ConsumerWidget {
  const HistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final lang = context.lang;
    final value = ref.watch(myEmploymentsProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.historyTitle)),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(myEmploymentsProvider);
          try {
            await ref.read(myEmploymentsProvider.future);
          } catch (_) {}
        },
        child: AsyncBody<List<MyEmployment>>(
          value: value,
          onRetry: () => ref.invalidate(myEmploymentsProvider),
          data:
              (items) =>
                  items.isEmpty
                      ? ListView(children: [EmptyState(icon: LucideIcons.briefcase, message: l.historyEmpty)])
                      : ListView.separated(
                        padding: const EdgeInsets.all(KsSpace.page),
                        itemCount: items.length,
                        separatorBuilder: (_, _) => const SizedBox(height: KsSpace.s3),
                        itemBuilder: (context, i) {
                          final h = items[i];
                          final t = Theme.of(context).textTheme;
                          final from = formatBsOrAd(h.startDateBs, h.startDate, lang);
                          final to = h.isActive ? l.commonNow : formatBsOrAd(h.endDateBs, h.endDate, lang);
                          final role = [h.designation, h.trade(lang)].whereType<String>().where((s) => s.isNotEmpty);
                          return Card(
                            child: InkWell(
                              borderRadius: BorderRadius.circular(KsRadius.card),
                              onTap: () => context.go(Routes.workerJob(h.id)),
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
                                          Text(h.orgName(lang), style: t.titleSmall),
                                          if (h.employerVerified) ...[
                                            const SizedBox(height: KsSpace.s1),
                                            const EmployerVerifiedBadge(),
                                          ],
                                          if (role.isNotEmpty) Text(role.first, style: t.bodyMedium),
                                          const SizedBox(height: KsSpace.s1),
                                          Text('$from – $to', style: t.bodySmall),
                                          Text(
                                            l.historyMonths(formatNumber(h.monthsWorked(), lang: lang)),
                                            style: t.bodySmall,
                                          ),
                                        ],
                                      ),
                                    ),
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        StatusBadge(
                                          label: l.termVerified,
                                          tone: Tone.success,
                                          icon: LucideIcons.shieldCheck,
                                        ),
                                        const SizedBox(height: KsSpace.s2),
                                        StatusBadge(
                                          label: h.isActive ? l.empActive : l.empEnded,
                                          tone: h.isActive ? Tone.info : Tone.neutral,
                                        ),
                                      ],
                                    ),
                                    const Icon(LucideIcons.chevronRight),
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      ),
        ),
      ),
    );
  }
}
