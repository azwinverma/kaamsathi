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
import '../../trust/ui/disputes_screen.dart';
import '../../trust/ui/rate_employer_sheet.dart';
import '../employment_data.dart';

/// One job: details, contract (status, PDF, accept), rate employer, complain.
class EmploymentDetailScreen extends ConsumerWidget {
  const EmploymentDetailScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final value = ref.watch(myEmploymentProvider(id));
    return Scaffold(
      appBar: AppBar(title: Text(l.empDetails)),
      body: AsyncBody<MyEmployment>(
        value: value,
        onRetry: () => ref.invalidate(myEmploymentsProvider),
        data: (e) => _Body(job: e),
      ),
    );
  }
}

class _Body extends ConsumerStatefulWidget {
  const _Body({required this.job});
  final MyEmployment job;

  @override
  ConsumerState<_Body> createState() => _BodyState();
}

class _BodyState extends ConsumerState<_Body> {
  bool _pdfBusy = false;
  bool _rated = false;

  Future<void> _openPdf() async {
    setState(() => _pdfBusy = true);
    await downloadAndOpen(
      context,
      ref,
      apiPath: EmploymentRepository.contractPdfPath(widget.job.id),
      fileName: 'contract-${widget.job.id}.pdf',
    );
    if (mounted) setState(() => _pdfBusy = false);
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final e = widget.job;
    final remote = ref.watch(myContractProvider(e.id));
    final contract = remote.value ?? e.contract;
    // The contract endpoint answered 404: the employer hasn't made one yet.
    final noContract = remote.hasValue && remote.value == null && e.contract == null;
    String m(String? v) => formatMoney(v ?? '0', lang: lang);
    final wage =
        e.wageType == 'daily' ? l.empWageDaily(m(e.dailyWage)) : l.empWageMonthly(m(e.monthlyGross ?? e.basicSalary));
    final canRate = !_rated && e.canRate();

    return ListView(
      padding: const EdgeInsets.all(KsSpace.page),
      children: [
        SectionCard(
          title: e.orgName(lang),
          trailing: StatusBadge(
            label: e.isActive ? l.empActive : l.empEnded,
            tone: e.isActive ? Tone.info : Tone.neutral,
          ),
          child: Column(
            children: [
              if (e.designation?.isNotEmpty ?? false) KeyValueRow(label: l.empDesignation, value: e.designation!),
              if (e.siteName != null) KeyValueRow(label: l.workSite, value: e.siteName!),
              KeyValueRow(label: l.empStart, value: formatBsOrAd(e.startDateBs, e.startDate, lang)),
              if (!e.isActive) KeyValueRow(label: l.empEndDate, value: formatBsOrAd(e.endDateBs, e.endDate, lang)),
              KeyValueRow(label: l.empWage, value: wage),
              KeyValueRow(label: l.termSsf, value: e.ssfEnrolled ? l.empSsfYes : l.empSsfNo),
            ],
          ),
        ),
        const SizedBox(height: KsSpace.s4),
        SectionCard(
          title: l.contractTitle,
          trailing:
              contract?.version == null
                  ? null
                  : Text(l.contractVersion(localizeDigits('${contract!.version}', lang)), style: t.bodySmall),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (remote.isLoading && contract == null)
                const LinearProgressIndicator()
              else if (noContract)
                Text(l.contractNone, style: t.bodyMedium)
              else if (contract == null)
                Text(l.contractUnknown, style: t.bodyMedium)
              else
                Align(
                  alignment: Alignment.centerLeft,
                  child: StatusBadge(
                    label:
                        contract.isAccepted
                            ? l.contractAccepted(formatBsDateTime(contract.acceptedAt, lang))
                            : l.contractNotAccepted,
                    tone: contract.isAccepted ? Tone.success : Tone.warning,
                    icon: contract.isAccepted ? LucideIcons.circleCheck : LucideIcons.clock,
                  ),
                ),
              if (!noContract) ...[
                const SizedBox(height: KsSpace.s3),
                OutlinedButton.icon(
                  onPressed: _pdfBusy ? null : _openPdf,
                  icon:
                      _pdfBusy
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(LucideIcons.fileText),
                  label: Text(l.contractOpenPdf),
                ),
              ],
              if (!noContract && !(contract?.isAccepted ?? false) && e.isActive) ...[
                const SizedBox(height: KsSpace.s2),
                FilledButton.icon(
                  key: const Key('contract_review'),
                  onPressed: () => context.go(Routes.workerJobContract(e.id)),
                  icon: const Icon(LucideIcons.fileSignature),
                  label: Text(l.contractReview),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: KsSpace.s4),
        Card(
          child: Column(
            children: [
              ListTile(
                leading: const Icon(LucideIcons.star),
                title: Text(l.rateTitle),
                subtitle: Text(
                  e.ratedByMe || _rated
                      ? l.empRated
                      : canRate
                      ? l.rateHint
                      : l.rateNotYet,
                ),
                trailing: canRate ? const Icon(LucideIcons.chevronRight) : null,
                onTap:
                    canRate
                        ? () async {
                          final ok = await showRateEmployerSheet(context, e);
                          if (ok == true && mounted) setState(() => _rated = true);
                        }
                        : null,
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(LucideIcons.messageSquareWarning),
                title: Text(l.disputeRaise),
                trailing: const Icon(LucideIcons.chevronRight),
                onTap: () => context.push(Routes.workerDisputeNew, extra: DisputeFormArgs(employmentId: e.id)),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
