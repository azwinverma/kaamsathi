import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/router/router.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../data/worker_models.dart';
import '../../data/worker_repository.dart';

class TalabScreen extends ConsumerWidget {
  const TalabScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final value = ref.watch(payslipsProvider);
    return Scaffold(
      appBar: AppBar(
        title: Text(l.talabTitle),
        actions: [
          TextButton.icon(
            onPressed: () => context.push(Routes.workerMoney),
            icon: const Icon(LucideIcons.handCoins, size: 18),
            label: Text(l.moneyTitle),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(payslipsProvider);
          try {
            await ref.read(payslipsProvider.future);
          } catch (_) {}
        },
        child: AsyncBody<List<Payslip>>(
          value: value,
          onRetry: () => ref.invalidate(payslipsProvider),
          data: (slips) => slips.isEmpty
              ? ListView(children: [EmptyState(icon: LucideIcons.wallet, message: l.talabEmpty)])
              : ListView.separated(
                  padding: const EdgeInsets.all(KsSpace.page),
                  itemCount: slips.length,
                  separatorBuilder: (_, _) => const SizedBox(height: KsSpace.s3),
                  itemBuilder: (_, i) => PayslipTile(slip: slips[i]),
                ),
        ),
      ),
    );
  }
}

class PayslipTile extends StatelessWidget {
  const PayslipTile({super.key, required this.slip});
  final Payslip slip;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(KsRadius.lg),
        onTap: () => context.go(Routes.payslip(slip.id)),
        child: Padding(
          padding: const EdgeInsets.all(KsSpace.s4),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(slip.monthLabel(lang), style: t.titleSmall),
                    if (slip.organizationName != null)
                      Text(slip.organizationName!, style: t.bodySmall),
                    const SizedBox(height: KsSpace.s2),
                    Text(
                      formatMoney(slip.netPay, lang: lang),
                      style: t.headlineMedium?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
                    ),
                    Text(l.talabNetPay, style: t.bodySmall),
                  ],
                ),
              ),
              StatusBadge(
                label: slip.isPaid ? l.payrollPaid : l.talabPaymentPending,
                tone: slip.isPaid ? Tone.success : Tone.warning,
              ),
              const SizedBox(width: KsSpace.s1),
              const Icon(LucideIcons.chevronRight),
            ],
          ),
        ),
      ),
    );
  }
}
