import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/digit_formatter.dart';
import '../../../../core/widgets/eco.dart';
import '../../../../core/widgets/photo_picker.dart';
import '../../../../core/widgets/signature/signature.dart';
import '../../../common/ref_data.dart';
import '../experience_data.dart';

(String, Tone, IconData) workHistoryStatus(AppLocalizations l, WorkHistoryEntry e) {
  final (label, tone, icon) = switch (e.status) {
    'verified' => (l.termVerified, Tone.success, LucideIcons.shieldCheck),
    'reference_pending' => (l.workHistStatusRefPending, Tone.warning, LucideIcons.phoneCall),
    'unverifiable' => (l.workHistStatusUnverifiable, Tone.neutral, LucideIcons.circleHelp),
    'rejected' => (l.workHistStatusRejected, Tone.danger, LucideIcons.circleX),
    _ => (l.workHistStatusSelf, Tone.neutral, LucideIcons.user),
  };
  return ((e.statusLabel?.isNotEmpty ?? false) ? e.statusLabel! : label, tone, icon);
}

String? verifiedByLabel(AppLocalizations l, String? method) => switch (method) {
  'reference_call' => l.workHistByReference,
  'employer_confirmed' => l.workHistByEmployer,
  'document' => l.workHistByDocument,
  _ => null,
};

/// Past work outside KaamSathi, with references (EXTENSIONS §3).
class WorkHistoryScreen extends ConsumerWidget {
  const WorkHistoryScreen({super.key});

  Future<void> _openForm(BuildContext context, [WorkHistoryEntry? entry]) => Navigator.of(
    context,
  ).push(MaterialPageRoute<void>(fullscreenDialog: true, builder: (_) => WorkHistoryFormScreen(entry: entry)));

  Future<void> _delete(BuildContext context, WidgetRef ref, WorkHistoryEntry e) async {
    final l = context.l10n;
    if (!await confirmDialog(context, title: l.workHistDeleteConfirm, confirmLabel: l.ecoRemove, danger: true)) return;
    try {
      await ref.read(experienceRepositoryProvider).delete(e.id);
      ref.invalidate(workHistoryProvider);
      if (context.mounted) showSnack(context, l.workHistDeleted);
    } catch (err) {
      if (context.mounted) showSnack(context, errorText(context, err), error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final value = ref.watch(workHistoryProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.workHistTitle)),
      floatingActionButton:
          value.hasError
              ? null
              : FloatingActionButton.extended(
                key: const Key('work_history_add'),
                onPressed: () => _openForm(context),
                icon: const Icon(LucideIcons.plus),
                label: Text(l.workHistAdd),
              ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(workHistoryProvider);
          try {
            await ref.read(workHistoryProvider.future);
          } catch (_) {}
        },
        child: FeatureAsyncBody<List<WorkHistoryEntry>>(
          value: value,
          onRetry: () => ref.invalidate(workHistoryProvider),
          data:
              (items) => ListView(
                padding: const EdgeInsets.fromLTRB(KsSpace.page, KsSpace.page, KsSpace.page, 96),
                children: [
                  Text(l.workHistIntro, style: t.bodyMedium),
                  const SizedBox(height: KsSpace.s3),
                  if (items.isEmpty)
                    EmptyState(icon: LucideIcons.briefcase, message: l.workHistEmpty, art: KsArt.cookKitchen),
                  for (final e in items)
                    Card(
                      key: Key('work_history_${e.id}'),
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
                                  Text(e.employerName, style: t.titleSmall),
                                  Text(
                                    [
                                      e.roleTitle,
                                      if (e.trade != null) e.trade!.name(lang),
                                    ].where((s) => s.isNotEmpty).join(' · '),
                                    style: t.bodyMedium,
                                  ),
                                  Text(
                                    [
                                      '${formatBsOrAd(e.startDateBs, e.startDate, lang)} – '
                                          '${e.endDate == null ? l.commonNow : formatBsOrAd(e.endDateBs, e.endDate, lang)}',
                                      if (e.district != null) e.district!.name(lang),
                                    ].join(' · '),
                                    style: t.bodySmall,
                                  ),
                                  if (e.referenceName?.isNotEmpty ?? false)
                                    Text(
                                      '${l.workHistRefName}: ${e.referenceName}'
                                      '${(e.referencePhone?.isNotEmpty ?? false) ? ' · ${formatPhone(e.referencePhone, lang: lang)}' : ''}',
                                      style: t.bodySmall,
                                    ),
                                  if (e.note?.isNotEmpty ?? false) Text(e.note!, style: t.bodySmall),
                                  const SizedBox(height: KsSpace.s2),
                                  Wrap(
                                    spacing: KsSpace.s2,
                                    runSpacing: KsSpace.s1,
                                    children: [
                                      Builder(
                                        builder: (_) {
                                          final (label, tone, icon) = workHistoryStatus(l, e);
                                          return StatusBadge(label: label, tone: tone, icon: icon);
                                        },
                                      ),
                                      if (e.isVerified && verifiedByLabel(l, e.verificationMethod) != null)
                                        StatusBadge(label: verifiedByLabel(l, e.verificationMethod)!, tone: Tone.info),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                            if (e.canEdit)
                              PopupMenuButton<String>(
                                key: Key('work_history_menu_${e.id}'),
                                onSelected: (v) => v == 'edit' ? _openForm(context, e) : _delete(context, ref, e),
                                itemBuilder:
                                    (_) => [
                                      PopupMenuItem(value: 'edit', child: Text(l.workHistEdit)),
                                      PopupMenuItem(value: 'delete', child: Text(l.ecoRemove)),
                                    ],
                              ),
                          ],
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

class WorkHistoryFormScreen extends ConsumerStatefulWidget {
  const WorkHistoryFormScreen({super.key, this.entry});
  final WorkHistoryEntry? entry;

  @override
  ConsumerState<WorkHistoryFormScreen> createState() => _WorkHistoryFormScreenState();
}

class _WorkHistoryFormScreenState extends ConsumerState<WorkHistoryFormScreen> {
  late final _employer = TextEditingController(text: widget.entry?.employerName);
  late final _role = TextEditingController(text: widget.entry?.roleTitle);
  late final _desc = TextEditingController(text: widget.entry?.description);
  late final _refName = TextEditingController(text: widget.entry?.referenceName);
  late final _refPhone = TextEditingController(
    text: (widget.entry?.referencePhone ?? '').contains('X') ? '' : widget.entry?.referencePhone,
  );
  late String? _trade = widget.entry?.trade?.code;
  late String? _district = widget.entry?.district?.code;
  late DateTime? _start = parseIsoDate(widget.entry?.startDate);
  late DateTime? _end = parseIsoDate(widget.entry?.endDate);
  late bool _still = widget.entry != null && widget.entry!.endDate == null;
  String? _photo;
  String? _dateError;
  final _form = GlobalKey<FormState>();
  bool _busy = false;

  @override
  void dispose() {
    for (final c in [_employer, _role, _desc, _refName, _refPhone]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _pickDate(bool end) async {
    final today = nepalToday();
    final d = await showDatePicker(
      context: context,
      initialDate: (end ? _end : _start) ?? today,
      firstDate: DateTime(1970),
      lastDate: today,
    );
    if (d != null) setState(() => end ? _end = d : _start = d);
  }

  Future<void> _save() async {
    final l = context.l10n;
    final okForm = _form.currentState?.validate() ?? false;
    String? dateErr;
    if (_start == null) {
      dateErr = l.ecoRequired;
    } else if (!_still && _end != null && _end!.isBefore(_start!)) {
      dateErr = l.workHistEndBeforeStart;
    }
    setState(() => _dateError = dateErr);
    if (!okForm || dateErr != null) return;
    setState(() => _busy = true);
    final input = WorkHistoryInput(
      employerName: _employer.text,
      roleTitle: _role.text,
      tradeCode: _trade,
      districtCode: _district,
      startDate: isoDate(_start!),
      endDate: _still || _end == null ? null : isoDate(_end!),
      description: _desc.text,
      referenceName: _refName.text,
      referencePhone: _refPhone.text.trim().isEmpty ? null : normalizePhone(_refPhone.text),
      documentPath: _photo,
    );
    try {
      final repo = ref.read(experienceRepositoryProvider);
      if (widget.entry == null) {
        await repo.create(input);
      } else {
        await repo.update(widget.entry!.id, input);
      }
      ref.invalidate(workHistoryProvider);
      if (!mounted) return;
      showSnack(context, l.workHistSaved);
      Navigator.of(context).pop();
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
    final trades = ref.watch(tradesProvider).value ?? const <Trade>[];
    final districts = ref.watch(districtsProvider).value ?? const <District>[];
    String? req(String? v) => (v?.trim().isEmpty ?? true) ? l.ecoRequired : null;
    String? dateText(DateTime? d) => d == null ? null : formatBsDate(BsDate.fromAd(d), lang);
    return Scaffold(
      appBar: AppBar(title: Text(widget.entry == null ? l.workHistAdd : l.workHistEdit)),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.all(KsSpace.page),
          children: [
            TextFormField(
              key: const Key('wh_employer'),
              controller: _employer,
              decoration: InputDecoration(labelText: l.workHistEmployer),
              validator: req,
            ),
            const SizedBox(height: KsSpace.s3),
            TextFormField(
              key: const Key('wh_role'),
              controller: _role,
              decoration: InputDecoration(labelText: l.workHistRole),
              validator: req,
            ),
            const SizedBox(height: KsSpace.s3),
            if (trades.isNotEmpty) ...[
              DropdownButtonFormField<String?>(
                value: trades.any((x) => x.code == _trade) ? _trade : null,
                isExpanded: true,
                decoration: InputDecoration(labelText: l.ecoOptional(l.workHistTrade)),
                items: [
                  DropdownMenuItem(value: null, child: Text(l.ecoNone)),
                  for (final x in trades) DropdownMenuItem(value: x.code, child: Text(x.name(lang))),
                ],
                onChanged: (v) => setState(() => _trade = v),
              ),
              const SizedBox(height: KsSpace.s3),
            ],
            if (districts.isNotEmpty) ...[
              DropdownButtonFormField<String?>(
                value: districts.any((x) => x.code == _district) ? _district : null,
                isExpanded: true,
                decoration: InputDecoration(labelText: l.ecoOptional(l.termDistrict)),
                items: [
                  DropdownMenuItem(value: null, child: Text(l.ecoNone)),
                  for (final x in districts) DropdownMenuItem(value: x.code, child: Text(x.name(lang))),
                ],
                onChanged: (v) => setState(() => _district = v),
              ),
              const SizedBox(height: KsSpace.s3),
            ],
            DateField(
              key: const Key('wh_start'),
              label: l.workHistStart,
              text: dateText(_start),
              errorText: _dateError,
              onTap: () => _pickDate(false),
            ),
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              value: _still,
              onChanged: (v) => setState(() => _still = v ?? false),
              title: Text(l.workHistStillThere),
            ),
            if (!_still) ...[
              DateField(
                label: l.ecoOptional(l.workHistEnd),
                text: dateText(_end),
                icon: LucideIcons.calendarCheck,
                onTap: () => _pickDate(true),
              ),
              const SizedBox(height: KsSpace.s3),
            ],
            TextFormField(
              controller: _desc,
              minLines: 2,
              maxLines: 5,
              maxLength: 1000,
              decoration: InputDecoration(labelText: l.ecoOptional(l.workHistDescription), alignLabelWithHint: true),
            ),
            const SizedBox(height: KsSpace.s3),
            Text(l.workHistReference, style: t.titleSmall),
            const SizedBox(height: KsSpace.s1),
            Text(l.workHistRefHint, style: t.bodySmall),
            const SizedBox(height: KsSpace.s2),
            TextFormField(
              key: const Key('wh_ref_name'),
              controller: _refName,
              decoration: InputDecoration(labelText: l.ecoOptional(l.workHistRefName)),
              validator: (v) {
                final phone = _refPhone.text.trim().isNotEmpty;
                return phone && (v?.trim().isEmpty ?? true) ? l.workHistRefBoth : null;
              },
            ),
            const SizedBox(height: KsSpace.s3),
            TextFormField(
              key: const Key('wh_ref_phone'),
              controller: _refPhone,
              keyboardType: TextInputType.phone,
              inputFormatters: const [DigitsFormatter(10)],
              decoration: InputDecoration(labelText: l.ecoOptional(l.workHistRefPhone), prefixText: '+977 '),
              validator: (v) {
                final s = v?.trim() ?? '';
                if (s.isEmpty) return _refName.text.trim().isNotEmpty ? l.workHistRefBoth : null;
                return isValidNepaliMobile(s) ? null : l.loginPhoneInvalid;
              },
            ),
            const SizedBox(height: KsSpace.s4),
            DocumentPhotoPicker(
              label: l.ecoOptional(l.workHistDocument),
              path: _photo,
              onChanged: (p) => setState(() => _photo = p),
            ),
            const SizedBox(height: KsSpace.s6),
            FilledButton(
              key: const Key('wh_save'),
              onPressed: _busy ? null : _save,
              child:
                  _busy
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                      : Text(l.commonSave),
            ),
          ],
        ),
      ),
    );
  }
}
