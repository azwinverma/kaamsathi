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
import '../../data/worker_models.dart';
import '../../data/worker_repository.dart';
import '../../employment/employment_data.dart';
import '../trust_data.dart';

String disputeKindLabel(AppLocalizations l, String kind) => switch (kind) {
  'attendance' => l.disputeKindAttendance,
  'wage' => l.disputeKindWage,
  'employment_dates' => l.disputeKindEmploymentDates,
  'rating' => l.disputeKindRating,
  'identity' => l.disputeKindIdentity,
  _ => l.disputeKindOther,
};

(String, Tone) disputeStatus(AppLocalizations l, Dispute d) {
  final (label, tone) = switch (d.status) {
    'employer_responded' => (l.disputeStatusResponded, Tone.info),
    'resolved' => (l.disputeStatusResolved, Tone.success),
    'rejected' => (l.disputeStatusRejected, Tone.danger),
    'appealed' => (l.disputeStatusAppealed, Tone.warning),
    'appeal_resolved' => (l.disputeStatusAppealResolved, Tone.success),
    _ => (l.disputeStatusOpen, Tone.warning),
  };
  return ((d.statusLabel?.isNotEmpty ?? false) ? d.statusLabel! : label, tone);
}

/// Pre-fill for the complaint form (e.g. from a payslip or a job).
class DisputeFormArgs {
  const DisputeFormArgs({this.kind, this.employmentId, this.payslipId});
  final String? kind;
  final String? employmentId;
  final String? payslipId;
}

class DisputesScreen extends ConsumerWidget {
  const DisputesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final value = ref.watch(disputesProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.disputesTitle)),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push(Routes.workerDisputeNew),
        icon: const Icon(LucideIcons.messageSquarePlus),
        label: Text(l.disputeRaise),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(disputesProvider);
          try {
            await ref.read(disputesProvider.future);
          } catch (_) {}
        },
        child: FeatureAsyncBody<List<Dispute>>(
          value: value,
          onRetry: () => ref.invalidate(disputesProvider),
          data:
              (items) => ListView(
                padding: const EdgeInsets.fromLTRB(KsSpace.page, KsSpace.page, KsSpace.page, 96),
                children: [
                  Text(l.disputesHint, style: t.bodyMedium),
                  const SizedBox(height: KsSpace.s3),
                  if (items.isEmpty) EmptyState(icon: LucideIcons.messageSquare, message: l.disputesEmpty),
                  for (final d in items)
                    Card(
                      key: Key('dispute_${d.id}'),
                      clipBehavior: Clip.antiAlias,
                      child: InkWell(
                        onTap: () => context.push(Routes.workerDispute(d.id)),
                        child: Padding(
                          padding: const EdgeInsets.all(KsSpace.s4),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      (d.kindLabel?.isNotEmpty ?? false) ? d.kindLabel! : disputeKindLabel(l, d.kind),
                                      style: t.titleSmall,
                                    ),
                                  ),
                                  Builder(
                                    builder: (_) {
                                      final (label, tone) = disputeStatus(l, d);
                                      return StatusBadge(label: label, tone: tone);
                                    },
                                  ),
                                ],
                              ),
                              if (d.organization != null) Text(d.organization!.name, style: t.bodySmall),
                              if (d.attendanceDate != null)
                                Text(formatBsOrAd(d.attendanceDateBs, d.attendanceDate, lang), style: t.bodySmall),
                              const SizedBox(height: KsSpace.s2),
                              Text(d.description, style: t.bodyMedium),
                              if (d.employerNote?.isNotEmpty ?? false) ...[
                                const SizedBox(height: KsSpace.s2),
                                Text(l.disputeEmployerNote, style: t.labelMedium),
                                Text(d.employerNote!, style: t.bodyMedium),
                              ],
                              if (d.resolutionNote?.isNotEmpty ?? false) ...[
                                const SizedBox(height: KsSpace.s2),
                                Text(l.disputeResolution, style: t.labelMedium),
                                Text(d.resolutionNote!, style: t.bodyMedium),
                              ],
                              if (d.raisedAt != null) ...[
                                const SizedBox(height: KsSpace.s2),
                                Text(l.disputeRaisedOn(formatBsDateTime(d.raisedAt, lang)), style: t.bodySmall),
                              ],
                              if (d.evidenceCount > 0 || d.canAppeal) ...[
                                const SizedBox(height: KsSpace.s2),
                                Wrap(
                                  spacing: KsSpace.s2,
                                  runSpacing: KsSpace.s1,
                                  children: [
                                    if (d.evidenceCount > 0)
                                      StatusBadge(
                                        label: l.evidenceCount(localizeDigits('${d.evidenceCount}', lang)),
                                        tone: Tone.neutral,
                                        icon: LucideIcons.paperclip,
                                      ),
                                    if (d.canAppeal)
                                      StatusBadge(label: l.appealSection, tone: Tone.info, icon: LucideIcons.scale),
                                  ],
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                    ),
                ],
              ),
        ),
      ),
    );
  }
}

class DisputeFormScreen extends ConsumerStatefulWidget {
  const DisputeFormScreen({super.key, this.args = const DisputeFormArgs()});
  final DisputeFormArgs args;

  @override
  ConsumerState<DisputeFormScreen> createState() => _DisputeFormScreenState();
}

class _DisputeFormScreenState extends ConsumerState<DisputeFormScreen> {
  late String _kind = widget.args.kind ?? 'attendance';
  late String? _employmentId = widget.args.employmentId;
  late String? _payslipId = widget.args.payslipId;
  DateTime? _date;
  final _desc = TextEditingController();
  final _form = GlobalKey<FormState>();
  bool _busy = false;

  @override
  void dispose() {
    _desc.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final today = nepalToday();
    final d = await showDatePicker(
      context: context,
      initialDate: _date ?? today,
      firstDate: today.subtract(const Duration(days: 730)),
      lastDate: today,
    );
    if (d != null) setState(() => _date = d);
  }

  Future<void> _submit() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    setState(() => _busy = true);
    final l = context.l10n;
    try {
      await ref
          .read(trustRepositoryProvider)
          .raiseDispute(
            disputeBody(
              kind: _kind,
              description: _desc.text,
              employmentId: _employmentId,
              payslipId: _kind == 'wage' ? _payslipId : null,
              attendanceDate: _kind == 'attendance' && _date != null ? isoDate(_date!) : null,
            ),
          );
      ref.invalidate(disputesProvider);
      if (!mounted) return;
      showSnack(context, l.disputeSent);
      context.pop();
    } catch (e) {
      if (mounted) showSnack(context, errorText(context, e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final jobs = ref.watch(myEmploymentsProvider).value ?? const <MyEmployment>[];
    final slips = _kind == 'wage' ? (ref.watch(payslipsProvider).value ?? const <Payslip>[]) : const <Payslip>[];
    return Scaffold(
      appBar: AppBar(title: Text(l.disputeRaise)),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.all(KsSpace.page),
          children: [
            Text(l.disputeKindLabel, style: t.titleSmall),
            const SizedBox(height: KsSpace.s2),
            Wrap(
              spacing: KsSpace.s2,
              runSpacing: KsSpace.s2,
              children: [
                for (final k in DisputeKind.all)
                  ChoiceChip(
                    key: Key('dispute_kind_$k'),
                    label: Text(disputeKindLabel(l, k)),
                    selected: _kind == k,
                    onSelected: (_) => setState(() => _kind = k),
                  ),
              ],
            ),
            const SizedBox(height: KsSpace.s4),
            if (jobs.isNotEmpty && _kind != 'identity') ...[
              DropdownButtonFormField<String?>(
                value: jobs.any((j) => j.id == _employmentId) ? _employmentId : null,
                isExpanded: true,
                decoration: InputDecoration(labelText: l.ecoOptional(l.disputeEmployment)),
                items: [
                  DropdownMenuItem(value: null, child: Text(l.ecoNone)),
                  for (final j in jobs)
                    DropdownMenuItem(
                      value: j.id,
                      child: Text(
                        '${j.orgName(lang)} · ${formatBsOrAd(j.startDateBs, j.startDate, lang)}',
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                ],
                onChanged: (v) => setState(() => _employmentId = v),
              ),
              const SizedBox(height: KsSpace.s3),
            ],
            if (_kind == 'wage' && slips.isNotEmpty) ...[
              DropdownButtonFormField<String?>(
                value: slips.any((s) => s.id == _payslipId) ? _payslipId : null,
                isExpanded: true,
                decoration: InputDecoration(labelText: l.ecoOptional(l.disputePayslip)),
                items: [
                  DropdownMenuItem(value: null, child: Text(l.ecoNone)),
                  for (final s in slips)
                    DropdownMenuItem(
                      value: s.id,
                      child: Text(
                        '${s.monthLabel(lang)} · ${formatMoney(s.netPay, lang: lang)}',
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                ],
                onChanged: (v) => setState(() => _payslipId = v),
              ),
              const SizedBox(height: KsSpace.s3),
            ],
            if (_kind == 'attendance') ...[
              OutlinedButton.icon(
                onPressed: _pickDate,
                icon: const Icon(LucideIcons.calendar),
                label: Text(
                  _date == null
                      ? l.ecoOptional(l.disputeDate)
                      : '${formatBsDate(BsDate.fromAd(_date!), lang)} (${formatAdDate(_date!, lang)})',
                ),
              ),
              const SizedBox(height: KsSpace.s3),
            ],
            TextFormField(
              key: const Key('dispute_description'),
              controller: _desc,
              minLines: 4,
              maxLines: 8,
              maxLength: 1000,
              decoration: InputDecoration(
                labelText: l.disputeDescription,
                hintText: l.disputeDescriptionHint,
                alignLabelWithHint: true,
              ),
              validator: (v) {
                final s = v?.trim() ?? '';
                if (s.isEmpty) return l.ecoRequired;
                if (s.length < 10) return l.disputeDescriptionShort;
                return null;
              },
            ),
            const SizedBox(height: KsSpace.s2),
            Text(l.disputeReviewNote, style: t.bodySmall),
            const SizedBox(height: KsSpace.s6),
            FilledButton(
              onPressed: _busy ? null : _submit,
              child:
                  _busy
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                      : Text(l.ecoSubmit),
            ),
          ],
        ),
      ),
    );
  }
}
