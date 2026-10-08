import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:open_filex/open_filex.dart';

import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/eco.dart';
import '../privacy_data.dart';

String privacyKindLabel(AppLocalizations l, String kind) => switch (kind) {
  'export' => l.privacyKindExport,
  'correction' => l.privacyKindCorrection,
  'deletion' => l.privacyKindDeletion,
  _ => kind,
};

(String, Tone) privacyStatus(AppLocalizations l, String s) => switch (s) {
  'in_progress' => (l.privacyStatusInProgress, Tone.info),
  'completed' => (l.privacyStatusCompleted, Tone.success),
  'rejected' => (l.privacyStatusRejected, Tone.danger),
  _ => (l.privacyStatusReceived, Tone.warning),
};

/// "My data": export, correction, deletion requests (Privacy Act 2075).
class MyDataScreen extends ConsumerStatefulWidget {
  const MyDataScreen({super.key});

  @override
  ConsumerState<MyDataScreen> createState() => _MyDataScreenState();
}

class _MyDataScreenState extends ConsumerState<MyDataScreen> {
  bool _busy = false;
  String? _downloading;

  Future<void> _send(String kind, {String? details}) async {
    final l = context.l10n;
    setState(() => _busy = true);
    try {
      await ref.read(privacyRepositoryProvider).create(kind, details: details);
      ref.invalidate(privacyRequestsProvider);
      if (mounted) showSnack(context, l.privacySent);
    } catch (e) {
      if (mounted) showSnack(context, errorText(context, e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _export() async {
    final l = context.l10n;
    if (await confirmDialog(context, title: l.privacyExport, body: l.privacyExportHint, confirmLabel: l.ecoSubmit)) {
      await _send(PrivacyKind.export);
    }
  }

  Future<void> _correction() async {
    final details = await _askText(context.l10n.privacyCorrection, context.l10n.privacyCorrectionField, required: true);
    if (details != null) await _send(PrivacyKind.correction, details: details);
  }

  Future<void> _deletion() async {
    final reason = await showDialog<String>(context: context, builder: (_) => const _DeletionDialog());
    if (reason != null) await _send(PrivacyKind.deletion, details: reason);
  }

  Future<String?> _askText(String title, String label, {bool required = false}) => showDialog<String>(
    context: context,
    builder: (_) => _TextPromptDialog(title: title, label: label, required: required),
  );

  Future<void> _download(PrivacyRequest r) async {
    final l = context.l10n;
    setState(() => _downloading = r.id);
    try {
      final path = await ref.read(privacyRepositoryProvider).download(r.id);
      final res = await OpenFilex.open(path);
      if (res.type != ResultType.done && mounted) showSnack(context, l.privacyOpenError);
    } catch (e) {
      if (mounted) showSnack(context, errorText(context, e), error: true);
    } finally {
      if (mounted) setState(() => _downloading = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final value = ref.watch(privacyRequestsProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.privacyTitle)),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(privacyRequestsProvider);
          try {
            await ref.read(privacyRequestsProvider.future);
          } catch (_) {}
        },
        child: FeatureAsyncBody<List<PrivacyRequest>>(
          value: value,
          onRetry: () => ref.invalidate(privacyRequestsProvider),
          data:
              (items) => ListView(
                padding: const EdgeInsets.all(KsSpace.page),
                children: [
                  Text(l.privacyIntro, style: t.bodyMedium),
                  const SizedBox(height: KsSpace.s3),
                  Card(
                    child: Column(
                      children: [
                        ListTile(
                          enabled: !_busy,
                          leading: const Icon(LucideIcons.download),
                          title: Text(l.privacyExport),
                          subtitle: Text(l.privacyExportHint),
                          onTap: _export,
                        ),
                        const Divider(height: 1),
                        ListTile(
                          enabled: !_busy,
                          leading: const Icon(LucideIcons.pencil),
                          title: Text(l.privacyCorrection),
                          subtitle: Text(l.privacyCorrectionHint),
                          onTap: _correction,
                        ),
                        const Divider(height: 1),
                        ListTile(
                          key: const Key('privacy_delete'),
                          enabled: !_busy,
                          leading: Icon(LucideIcons.trash2, color: Theme.of(context).colorScheme.error),
                          title: Text(l.privacyDeletion, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                          subtitle: Text(l.privacyDeletionHint),
                          onTap: _deletion,
                        ),
                      ],
                    ),
                  ),
                  GroupLabel(l.privacyRequests),
                  if (items.isEmpty) Text(l.privacyRequestsEmpty, style: t.bodyMedium),
                  for (final r in items)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(KsSpace.s4),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Row(
                              children: [
                                Expanded(child: Text(privacyKindLabel(l, r.kind), style: t.titleSmall)),
                                Builder(
                                  builder: (_) {
                                    final (label, tone) = privacyStatus(l, r.status);
                                    return StatusBadge(label: label, tone: tone);
                                  },
                                ),
                              ],
                            ),
                            if (r.createdAt != null) Text(formatBsDateTime(r.createdAt, lang), style: t.bodySmall),
                            if (r.details?.isNotEmpty ?? false) Text(r.details!, style: t.bodyMedium),
                            if (r.responseNote?.isNotEmpty ?? false) ...[
                              const SizedBox(height: KsSpace.s1),
                              Text(r.responseNote!, style: t.bodyMedium),
                            ],
                            if (r.canDownload()) ...[
                              const SizedBox(height: KsSpace.s2),
                              FilledButton.icon(
                                onPressed: _downloading == null ? () => _download(r) : null,
                                icon:
                                    _downloading == r.id
                                        ? const SizedBox(
                                          width: 18,
                                          height: 18,
                                          child: CircularProgressIndicator(strokeWidth: 2),
                                        )
                                        : const Icon(LucideIcons.download),
                                label: Text(l.privacyDownload),
                              ),
                              if (r.fileExpiresAt != null)
                                Text(l.ecoUntil(formatBsDateTime(r.fileExpiresAt, lang)), style: t.bodySmall),
                            ] else if (r.downloadExpired())
                              Text(l.privacyDownloadExpired, style: t.bodySmall),
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

/// Deletion warning: what goes, what payroll records stay. Returns the
/// (possibly empty) reason when confirmed, null when cancelled.
class _DeletionDialog extends StatefulWidget {
  const _DeletionDialog();

  @override
  State<_DeletionDialog> createState() => _DeletionDialogState();
}

class _DeletionDialogState extends State<_DeletionDialog> {
  bool _understood = false;
  final _reason = TextEditingController();

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final c = context.ks;
    return AlertDialog(
      icon: Icon(LucideIcons.triangleAlert, color: c.errorText),
      title: Text(l.privacyDeletion),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(KsSpace.s3),
              decoration: BoxDecoration(color: c.errorSoft, borderRadius: BorderRadius.circular(KsRadius.dense)),
              child: Text(l.privacyDeletionWarning, style: TextStyle(color: c.errorText)),
            ),
            const SizedBox(height: KsSpace.s3),
            TextField(controller: _reason, decoration: InputDecoration(labelText: l.ecoOptional(l.privacyReason))),
            CheckboxListTile(
              key: const Key('privacy_delete_understood'),
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              value: _understood,
              onChanged: (v) => setState(() => _understood = v ?? false),
              title: Text(l.privacyDeletionConfirm),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: Text(l.commonCancel)),
        FilledButton(
          style: destructiveFilledStyle(context),
          onPressed: _understood ? () => Navigator.pop(context, _reason.text.trim()) : null,
          child: Text(l.privacyDeletion),
        ),
      ],
    );
  }
}

/// Small dialog that asks for free text and owns its controller.
class _TextPromptDialog extends StatefulWidget {
  const _TextPromptDialog({required this.title, required this.label, this.required = false});
  final String title;
  final String label;
  final bool required;

  @override
  State<_TextPromptDialog> createState() => _TextPromptDialogState();
}

class _TextPromptDialogState extends State<_TextPromptDialog> {
  final _ctrl = TextEditingController();

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return AlertDialog(
      title: Text(widget.title),
      content: TextField(
        controller: _ctrl,
        autofocus: true,
        minLines: 3,
        maxLines: 6,
        decoration: InputDecoration(labelText: widget.label),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: Text(l.commonCancel)),
        FilledButton(
          onPressed: () {
            if (widget.required && _ctrl.text.trim().isEmpty) return;
            Navigator.pop(context, _ctrl.text.trim());
          },
          child: Text(l.ecoSubmit),
        ),
      ],
    );
  }
}
