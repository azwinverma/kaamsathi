import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/api/cached.dart';
import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/eco.dart';
import '../employment_data.dart';

/// Plain-language contract summary lines in [lang] (Labour Act 2074 essentials
/// from ECOSYSTEM §5 plus this job's own terms).
List<String> contractSummaryLines(MyEmployment e, String lang) {
  final l = lookupAppLocalizations(Locale(lang));
  String m(String? v) => formatMoney(v ?? '0', lang: lang);
  final basic = parsePaisa(e.basicSalary) ?? 0;
  final da = parsePaisa(e.dearnessAllowance) ?? 0;
  return [
    l.csEmployer(e.orgName(lang)),
    if (e.designation?.isNotEmpty ?? false) l.csPosition(e.designation!),
    if (e.siteName?.isNotEmpty ?? false) l.csSite(e.siteName!),
    l.csStart(formatBsOrAd(e.startDateBs, e.startDate, lang)),
    if (e.wageType == 'daily')
      l.csWageDaily(m(e.dailyWage))
    else
      l.csWageMonthly(m(e.basicSalary), m(e.dearnessAllowance), formatMoney((basic + da) / 100, lang: lang)),
    if ((parsePaisa(e.otherAllowance) ?? 0) > 0) l.csAllowance(m(e.otherAllowance)),
    l.csHours,
    l.csOvertime,
    l.csLeave,
    l.csFestival,
    if (e.ssfEnrolled) l.csSsfYes else l.csSsfNo,
    l.csGrievance,
  ];
}

class ContractAcceptScreen extends ConsumerWidget {
  const ContractAcceptScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = ref.watch(myEmploymentProvider(id));
    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.contractAcceptTitle)),
      body: AsyncBody<MyEmployment>(
        value: value,
        onRetry: () => ref.invalidate(myEmploymentsProvider),
        data: (e) => _AcceptBody(job: e),
      ),
    );
  }
}

class _AcceptBody extends ConsumerStatefulWidget {
  const _AcceptBody({required this.job});
  final MyEmployment job;

  @override
  ConsumerState<_AcceptBody> createState() => _AcceptBodyState();
}

class _AcceptBodyState extends ConsumerState<_AcceptBody> {
  String? _lang;
  bool _agree = false;
  bool _busy = false;
  bool _pdfBusy = false;

  Future<void> _accept() async {
    final l = context.l10n;
    setState(() => _busy = true);
    try {
      await ref.read(employmentRepositoryProvider).acceptContract(widget.job.id);
      ref.invalidate(myEmploymentsProvider);
      ref.invalidate(myContractProvider(widget.job.id));
      if (!mounted) return;
      showSnack(context, l.contractAcceptedMsg);
      context.pop();
    } catch (e) {
      if (!mounted) return;
      showSnack(context, isFeatureUnavailable(e) ? l.contractNone : errorText(context, e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final lang = _lang ?? context.lang;
    final lines = contractSummaryLines(widget.job, lang);
    final ll = lookupAppLocalizations(Locale(lang));
    return ListView(
      padding: const EdgeInsets.all(KsSpace.page),
      children: [
        Row(
          children: [
            Text(l.contractReadIn, style: t.bodyMedium),
            const SizedBox(width: KsSpace.s2),
            Expanded(
              child: SegmentedButton<String>(
                segments: [
                  ButtonSegment(value: 'ne', label: Text(l.languageNepali)),
                  ButtonSegment(value: 'en', label: Text(l.languageEnglish)),
                ],
                selected: {lang},
                onSelectionChanged: (s) => setState(() => _lang = s.first),
              ),
            ),
          ],
        ),
        const SizedBox(height: KsSpace.s4),
        Text(ll.contractSummaryIntro, style: t.bodyLarge),
        const SizedBox(height: KsSpace.s3),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(KsSpace.s4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final line in lines)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 5),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(LucideIcons.check, size: 18, color: context.statusColors.successFg),
                        const SizedBox(width: KsSpace.s2),
                        Expanded(child: Text(line, style: t.bodyMedium)),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: KsSpace.s3),
        Text(ll.csPdfNote, style: t.bodySmall),
        const SizedBox(height: KsSpace.s2),
        OutlinedButton.icon(
          onPressed:
              _pdfBusy
                  ? null
                  : () async {
                    setState(() => _pdfBusy = true);
                    await downloadAndOpen(
                      context,
                      ref,
                      apiPath: EmploymentRepository.contractPdfPath(widget.job.id),
                      fileName: 'contract-${widget.job.id}.pdf',
                    );
                    if (mounted) setState(() => _pdfBusy = false);
                  },
          icon: const Icon(LucideIcons.fileText),
          label: Text(l.contractOpenPdf),
        ),
        const SizedBox(height: KsSpace.s3),
        CheckboxListTile(
          key: const Key('contract_agree'),
          contentPadding: EdgeInsets.zero,
          controlAffinity: ListTileControlAffinity.leading,
          value: _agree,
          onChanged: (v) => setState(() => _agree = v ?? false),
          title: Text(l.contractAgree),
        ),
        const SizedBox(height: KsSpace.s3),
        FilledButton(
          key: const Key('contract_accept'),
          onPressed: _agree && !_busy ? _accept : null,
          child:
              _busy
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : Text(l.contractAccept),
        ),
        const SizedBox(height: KsSpace.s6),
      ],
    );
  }
}
