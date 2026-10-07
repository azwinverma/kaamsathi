import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:open_filex/open_filex.dart';

import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../data/worker_models.dart';
import '../../data/worker_repository.dart';

class PayslipDetailScreen extends ConsumerWidget {
  const PayslipDetailScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final value = ref.watch(payslipProvider(id));
    return Scaffold(
      appBar: AppBar(title: Text(l.navPayslip)),
      body: AsyncBody<Payslip>(
        value: value,
        onRetry: () => ref.invalidate(payslipProvider(id)),
        data: (p) => _Detail(slip: p),
      ),
    );
  }
}

class _Detail extends ConsumerStatefulWidget {
  const _Detail({required this.slip});
  final Payslip slip;

  @override
  ConsumerState<_Detail> createState() => _DetailState();
}

class _DetailState extends ConsumerState<_Detail> {
  bool _downloading = false;

  Future<void> _openPdf() async {
    setState(() => _downloading = true);
    try {
      final path = await ref.read(workerRepositoryProvider).downloadPayslipPdf(widget.slip.id);
      final r = await OpenFilex.open(path, type: 'application/pdf');
      if (r.type != ResultType.done && mounted) {
        showSnack(context, context.l10n.talabPdfError, error: true);
      }
    } catch (e) {
      if (mounted) showSnack(context, errorText(context, e), error: true);
    } finally {
      if (mounted) setState(() => _downloading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final p = widget.slip;
    String m(String? v) => formatMoney(v ?? '0', lang: lang);
    String n(num? v) => formatNumber(v ?? 0, lang: lang);
    bool nonZero(String? v) => (parsePaisa(v) ?? 0) != 0;

    final c = context.statusColors;
    return ListView(
      padding: const EdgeInsets.all(KsSpace.page),
      children: [
        // Net pay hero.
        Container(
          padding: const EdgeInsets.all(KsSpace.s6),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.primary,
            borderRadius: BorderRadius.circular(KsRadius.xl),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                p.monthLabel(lang),
                style: t.titleMedium?.copyWith(color: Colors.white),
              ),
              if (p.organizationName != null)
                Text(p.organizationName!, style: t.bodyMedium?.copyWith(color: KsColors.primary100)),
              const SizedBox(height: KsSpace.s4),
              Text(l.talabNetPay, style: t.bodyMedium?.copyWith(color: KsColors.primary100)),
              Text(
                m(p.netPay),
                style: t.displaySmall?.copyWith(
                  color: Colors.white,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
              const SizedBox(height: KsSpace.s2),
              Text(
                p.isPaid
                    ? (p.paidAt != null
                          ? l.talabPaidOn(formatBsDate(BsDate.fromAd(p.paidAt!.toLocal()), lang))
                          : l.payrollPaid)
                    : l.talabPaymentPending,
                style: t.bodyMedium?.copyWith(color: Colors.white),
              ),
              if (p.paymentMethod != null)
                Text(
                  '${l.talabPaymentMethod}: ${paymentMethodLabel(l, p.paymentMethod)}',
                  style: t.bodySmall?.copyWith(color: KsColors.primary100),
                ),
            ],
          ),
        ),
        const SizedBox(height: KsSpace.s4),
        SectionCard(
          title: l.talabAttendance,
          child: Column(
            children: [
              KeyValueRow(label: l.talabDaysInMonth, value: n(p.daysInMonth)),
              KeyValueRow(label: l.talabPresentDays, value: n(p.presentDays)),
              KeyValueRow(label: l.talabPayableDays, value: n(p.payableDays)),
              if ((p.overtimeHours ?? 0) > 0) KeyValueRow(label: l.talabOtHours, value: n(p.overtimeHours)),
            ],
          ),
        ),
        const SizedBox(height: KsSpace.s4),
        SectionCard(
          title: l.talabEarnings,
          child: Column(
            children: [
              KeyValueRow(label: l.termBasicSalary, value: m(p.basicEarned)),
              KeyValueRow(label: l.termDearnessAllowance, value: m(p.daEarned)),
              if (nonZero(p.allowanceEarned)) KeyValueRow(label: l.termAllowance, value: m(p.allowanceEarned)),
              if (nonZero(p.overtimePay)) KeyValueRow(label: l.termOvertime, value: m(p.overtimePay)),
              if (nonZero(p.festivalAllowance))
                KeyValueRow(label: l.termFestivalAllowance, value: m(p.festivalAllowance)),
              const Divider(),
              KeyValueRow(label: l.talabGrossPay, value: m(p.grossPay), bold: true),
            ],
          ),
        ),
        const SizedBox(height: KsSpace.s4),
        SectionCard(
          title: l.talabDeductions,
          child: Column(
            children: [
              KeyValueRow(label: l.talabSsfEmployee, value: '− ${m(p.ssfEmployee)}', valueColor: c.dangerFg),
              KeyValueRow(label: l.talabTds, value: '− ${m(p.tds)}', valueColor: c.dangerFg),
              KeyValueRow(label: l.talabPeskiRecovery, value: '− ${m(p.advanceRecovery)}', valueColor: c.dangerFg),
              if (nonZero(p.otherDeductions))
                KeyValueRow(label: l.talabOtherDeductions, value: '− ${m(p.otherDeductions)}', valueColor: c.dangerFg),
              const Divider(),
              KeyValueRow(label: l.talabNetPay, value: m(p.netPay), bold: true, valueColor: c.successFg),
            ],
          ),
        ),
        if (p.note != null && p.note!.isNotEmpty) ...[
          const SizedBox(height: KsSpace.s4),
          SectionCard(child: Text(p.note!)),
        ],
        const SizedBox(height: KsSpace.s6),
        FilledButton.icon(
          onPressed: _downloading ? null : _openPdf,
          icon: _downloading
              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
              : const Icon(LucideIcons.fileDown),
          label: Text(l.talabOpenPdf),
        ),
        const SizedBox(height: KsSpace.s6),
      ],
    );
  }
}
