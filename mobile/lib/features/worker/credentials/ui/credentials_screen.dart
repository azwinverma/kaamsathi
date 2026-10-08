import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/flags.dart';
import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/eco.dart';
import '../credentials_data.dart';

String credentialKindLabel(AppLocalizations l, String kind) => switch (kind) {
  'nstb' => l.credKindNstb,
  'ctevt_training' => l.credKindCtevt,
  'training_course' => l.credKindCourse,
  'license' => l.credKindLicense,
  'safety' => l.credKindSafety,
  'language' => l.credKindLanguage,
  _ => l.credKindOther,
};

(String, Tone, IconData) credentialStatus(AppLocalizations l, String status) => switch (status) {
  'verified' => (l.credStatusVerified, Tone.success, LucideIcons.shieldCheck),
  'rejected' => (l.credStatusRejected, Tone.danger, LucideIcons.circleX),
  'expired' => (l.credStatusExpired, Tone.neutral, LucideIcons.calendarX),
  _ => (l.credStatusPending, Tone.warning, LucideIcons.clock),
};

/// NSTB level code → label (`level2` → "Level 2").
String nstbLabel(AppLocalizations l, String? level, String lang) {
  if (level == null || level.isEmpty || level == 'none') return '';
  if (level == 'elementary') return l.nstbElementary;
  final n = RegExp(r'\d+').firstMatch(level)?.group(0);
  return n == null ? level : l.nstbLevelN(localizeDigits(n, lang));
}

class CredentialsScreen extends ConsumerWidget {
  const CredentialsScreen({super.key});

  Future<void> _delete(BuildContext context, WidgetRef ref, Credential c) async {
    final l = context.l10n;
    if (!await confirmDialog(context, title: l.credDeleteConfirm, confirmLabel: l.ecoRemove, danger: true)) return;
    try {
      await ref.read(credentialsRepositoryProvider).deleteCredential(c.id);
      ref.invalidate(credentialsProvider);
      if (context.mounted) showSnack(context, l.credDeleted);
    } catch (e) {
      if (context.mounted) showSnack(context, errorText(context, e), error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final value = ref.watch(credentialsProvider);
    final resubmitOn = ref.watch(flagOnProvider(FlagKeys.credentialResubmit));
    return Scaffold(
      appBar: AppBar(title: Text(l.credTitle)),
      floatingActionButton:
          value.hasError
              ? null
              : FloatingActionButton.extended(
                onPressed:
                    () => Navigator.of(context).push(
                      MaterialPageRoute<void>(fullscreenDialog: true, builder: (_) => const AddCredentialScreen()),
                    ),
                icon: const Icon(LucideIcons.plus),
                label: Text(l.credAdd),
              ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(credentialsProvider);
          try {
            await ref.read(credentialsProvider.future);
          } catch (_) {}
        },
        child: FeatureAsyncBody<List<Credential>>(
          value: value,
          onRetry: () => ref.invalidate(credentialsProvider),
          data:
              (items) => ListView(
                padding: const EdgeInsets.fromLTRB(KsSpace.page, KsSpace.page, KsSpace.page, 96),
                children: [
                  if (items.isEmpty) EmptyState(icon: LucideIcons.award, message: l.credEmpty),
                  for (final c in items)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(KsSpace.s4),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Icon(LucideIcons.award),
                            const SizedBox(width: KsSpace.s3),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(c.title, style: t.titleSmall),
                                  Text(
                                    [
                                      credentialKindLabel(l, c.kind),
                                      if (c.issuer?.isNotEmpty ?? false) c.issuer!,
                                      if (c.kind == 'nstb')
                                        nstbLabel(l, c.level, lang)
                                      else if (c.level != null)
                                        c.level!,
                                    ].where((s) => s.isNotEmpty).join(' · '),
                                    style: t.bodySmall,
                                  ),
                                  if (c.expiresOn != null)
                                    Text(
                                      l.credExpires(formatBsOrAd(c.expiresOnBs, c.expiresOn, lang)),
                                      style: t.bodySmall,
                                    ),
                                  if (c.note?.isNotEmpty ?? false) Text(c.note!, style: t.bodySmall),
                                  if (c.resubmissionOf case final prev?) ...[
                                    const SizedBox(height: KsSpace.s1),
                                    Row(
                                      key: Key('resubmission_of_${c.id}'),
                                      children: [
                                        const Icon(LucideIcons.link, size: 14),
                                        const SizedBox(width: 4),
                                        Expanded(child: Text(l.credResubmissionOf, style: t.bodySmall)),
                                      ],
                                    ),
                                    if (prev.note?.isNotEmpty ?? false)
                                      Text(l.credEarlierNote(prev.note!), style: t.bodySmall),
                                  ],
                                  const SizedBox(height: KsSpace.s2),
                                  Builder(
                                    builder: (_) {
                                      final (label, tone, icon) = credentialStatus(l, c.status);
                                      return StatusBadge(
                                        label: (c.statusLabel?.isNotEmpty ?? false) ? c.statusLabel! : label,
                                        tone: tone,
                                        icon: icon,
                                      );
                                    },
                                  ),
                                  if (resubmitOn && c.canResubmit) ...[
                                    const SizedBox(height: KsSpace.s2),
                                    OutlinedButton.icon(
                                      key: Key('resubmit_${c.id}'),
                                      onPressed:
                                          () => Navigator.of(context).push(
                                            MaterialPageRoute<void>(
                                              fullscreenDialog: true,
                                              builder: (_) => AddCredentialScreen(resubmit: c),
                                            ),
                                          ),
                                      icon: const Icon(LucideIcons.rotateCcw, size: 18),
                                      label: Text(l.credResubmit),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            if (c.canDelete)
                              IconButton(
                                tooltip: l.ecoRemove,
                                onPressed: () => _delete(context, ref, c),
                                icon: const Icon(LucideIcons.trash2),
                              ),
                          ],
                        ),
                      ),
                    ),
                  if (items.isNotEmpty) ...[
                    const SizedBox(height: KsSpace.s2),
                    Text(l.credVerifyNote, style: t.bodySmall),
                  ],
                ],
              ),
        ),
      ),
    );
  }
}

class AddCredentialScreen extends ConsumerStatefulWidget {
  const AddCredentialScreen({super.key, this.resubmit});

  /// A rejected credential to resubmit (fields pre-filled, photo optional).
  final Credential? resubmit;

  @override
  ConsumerState<AddCredentialScreen> createState() => _AddCredentialScreenState();
}

class _AddCredentialScreenState extends ConsumerState<AddCredentialScreen> {
  late final Credential? _orig = widget.resubmit;
  late String _kind = CredentialKind.all.contains(_orig?.kind) ? _orig!.kind : 'nstb';
  late final _title = TextEditingController(text: _orig?.title);
  late final _issuer = TextEditingController(text: _orig?.issuer);
  late final _number = TextEditingController(text: _orig?.certificateNo);
  late final _level = TextEditingController(text: _orig?.level);
  late DateTime? _issued = parseIsoDate(_orig?.issuedOn);
  late DateTime? _expires = parseIsoDate(_orig?.expiresOn);
  String? _photo;
  final _form = GlobalKey<FormState>();
  bool _busy = false;

  @override
  void dispose() {
    _title.dispose();
    _issuer.dispose();
    _number.dispose();
    _level.dispose();
    super.dispose();
  }

  Future<void> _pick(ImageSource source) async {
    try {
      // Downscaled + compressed: documents stay legible, uploads stay small
      // on patchy mobile data.
      final f = await ImagePicker().pickImage(source: source, maxWidth: 1600, maxHeight: 1600, imageQuality: 70);
      if (f != null) setState(() => _photo = f.path);
    } catch (_) {
      if (mounted) showSnack(context, context.l10n.credPhotoError, error: true);
    }
  }

  Future<void> _date(bool expires) async {
    final today = nepalToday();
    final d = await showDatePicker(
      context: context,
      initialDate: (expires ? _expires : _issued) ?? today,
      firstDate: DateTime(1980),
      lastDate: expires ? DateTime(today.year + 30) : today,
    );
    if (d != null) setState(() => expires ? _expires = d : _issued = d);
  }

  Future<void> _save() async {
    final l = context.l10n;
    if (!(_form.currentState?.validate() ?? false)) return;
    final orig = _orig;
    if (_photo == null && orig == null) {
      showSnack(context, l.credPhotoNeeded, error: true);
      return;
    }
    setState(() => _busy = true);
    try {
      if (orig != null) {
        await ref
            .read(credentialsRepositoryProvider)
            .resubmit(
              orig.id,
              credentialFields(
                kind: _kind,
                title: _title.text,
                issuer: _issuer.text,
                certificateNo: _number.text,
                level: _level.text,
                issuedOn: _issued == null ? null : isoDate(_issued!),
                expiresOn: _expires == null ? null : isoDate(_expires!),
                original: orig,
              ),
              documentPath: _photo,
            );
        ref.invalidate(credentialsProvider);
        if (!mounted) return;
        showSnack(context, l.credResubmitted);
        Navigator.of(context).pop();
        return;
      }
      await ref
          .read(credentialsRepositoryProvider)
          .addCredential(
            kind: _kind,
            title: _title.text,
            issuer: _issuer.text,
            certificateNo: _number.text,
            level: _level.text,
            issuedOn: _issued == null ? null : isoDate(_issued!),
            expiresOn: _expires == null ? null : isoDate(_expires!),
            documentPath: _photo,
          );
      ref.invalidate(credentialsProvider);
      if (!mounted) return;
      showSnack(context, l.credSaved);
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
    String? req(String? v) => (v?.trim().isEmpty ?? true) ? l.ecoRequired : null;
    String dateLabel(String label, DateTime? d) =>
        d == null ? l.ecoOptional(label) : '$label: ${formatBsDate(BsDate.fromAd(d), lang)}';
    final orig = _orig;
    return Scaffold(
      appBar: AppBar(title: Text(orig == null ? l.credAdd : l.credResubmitTitle)),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.all(KsSpace.page),
          children: [
            if (orig != null) ...[
              InfoNote(
                key: const Key('resubmit_note'),
                text: [
                  l.credResubmitHint,
                  if (orig.note?.isNotEmpty ?? false) l.credEarlierNote(orig.note!),
                ].join('\n'),
                tone: Tone.warning,
              ),
              const SizedBox(height: KsSpace.s4),
            ],
            DropdownButtonFormField<String>(
              value: _kind,
              isExpanded: true,
              decoration: InputDecoration(labelText: l.credKind),
              items: [
                for (final k in CredentialKind.all) DropdownMenuItem(value: k, child: Text(credentialKindLabel(l, k))),
              ],
              onChanged: (v) => setState(() => _kind = v ?? _kind),
            ),
            const SizedBox(height: KsSpace.s3),
            TextFormField(controller: _title, decoration: InputDecoration(labelText: l.credName), validator: req),
            const SizedBox(height: KsSpace.s3),
            TextFormField(controller: _issuer, decoration: InputDecoration(labelText: l.credIssuer), validator: req),
            const SizedBox(height: KsSpace.s3),
            TextFormField(controller: _number, decoration: InputDecoration(labelText: l.ecoOptional(l.credNumber))),
            const SizedBox(height: KsSpace.s3),
            TextFormField(controller: _level, decoration: InputDecoration(labelText: l.ecoOptional(l.credLevel))),
            const SizedBox(height: KsSpace.s3),
            OutlinedButton.icon(
              onPressed: () => _date(false),
              icon: const Icon(LucideIcons.calendar),
              label: Text(dateLabel(l.credIssuedOn, _issued)),
            ),
            const SizedBox(height: KsSpace.s2),
            OutlinedButton.icon(
              onPressed: () => _date(true),
              icon: const Icon(LucideIcons.calendarClock),
              label: Text(dateLabel(l.credExpiresOn, _expires)),
            ),
            const SizedBox(height: KsSpace.s4),
            Text(
              orig == null ? l.credPhoto : l.ecoOptional(l.credPhoto),
              style: Theme.of(context).textTheme.titleSmall,
            ),
            const SizedBox(height: KsSpace.s2),
            if (_photo != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(KsRadius.lg),
                child: Image.file(File(_photo!), height: 180, fit: BoxFit.cover, cacheWidth: 600),
              ),
            const SizedBox(height: KsSpace.s2),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _pick(ImageSource.camera),
                    icon: const Icon(LucideIcons.camera),
                    label: Text(l.credTakePhoto),
                  ),
                ),
                const SizedBox(width: KsSpace.s2),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _pick(ImageSource.gallery),
                    icon: const Icon(LucideIcons.image),
                    label: Text(l.credChoosePhoto),
                  ),
                ),
              ],
            ),
            const SizedBox(height: KsSpace.s2),
            Text(l.credVerifyNote, style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: KsSpace.s6),
            FilledButton(
              key: const Key('credential_save'),
              onPressed: _busy ? null : _save,
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
