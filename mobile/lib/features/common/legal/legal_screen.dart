import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/auth/me.dart';
import '../../../core/auth/session.dart';
import '../../../core/format.dart';
import '../../../core/l10n/l10n.dart';
import '../../../core/providers.dart';
import '../../../core/theme/tokens.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/eco.dart';
import '../../../core/widgets/language_toggle.dart';
import '../account_actions.dart';

String legalKindLabel(AppLocalizations l, PendingLegal d) {
  if (d.title?.isNotEmpty ?? false) return d.title!;
  final k = d.kind.toLowerCase();
  if (k.contains('privacy')) return l.legalKindPrivacy;
  if (k.contains('term')) return l.legalKindTerms;
  return l.legalKindOther;
}

/// `POST /auth/legal/accept {document_ids}`.
Future<void> acceptLegal(WidgetRef ref, List<String> ids) =>
    ref.read(apiClientProvider).postNoContent('/auth/legal/accept', data: {'document_ids': ids});

/// Blocking screen shown while `Me.pending_legal` is non-empty. The app has
/// no URL-launcher plugin, so each document's link is shown with a copy button.
class LegalScreen extends ConsumerStatefulWidget {
  const LegalScreen({super.key, this.onAccept});

  /// Test seam; defaults to [acceptLegal] + refreshing `Me`.
  final Future<void> Function(List<String> ids)? onAccept;

  @override
  ConsumerState<LegalScreen> createState() => _LegalScreenState();
}

class _LegalScreenState extends ConsumerState<LegalScreen> {
  bool _agree = false;
  bool _busy = false;

  Future<void> _accept(List<PendingLegal> docs) async {
    setState(() => _busy = true);
    try {
      final ids = docs.map((d) => d.id).toList();
      if (widget.onAccept != null) {
        await widget.onAccept!(ids);
      } else {
        await acceptLegal(ref, ids);
        // The router leaves this screen once `pending_legal` is empty.
        await ref.read(sessionProvider.notifier).refreshMe();
      }
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
    final docs = ref.watch(sessionProvider.select((s) => s.me?.pendingLegal)) ?? const <PendingLegal>[];
    return PopScope(
      canPop: false,
      child: Scaffold(
        appBar: AppBar(title: Text(l.legalTitle), automaticallyImplyLeading: false),
        body: ListView(
          padding: const EdgeInsets.all(KsSpace.page),
          children: [
            const LanguageSelector(),
            const SizedBox(height: KsSpace.s4),
            Text(l.legalIntro, style: t.bodyLarge),
            const SizedBox(height: KsSpace.s4),
            for (final d in docs)
              Card(
                key: Key('legal_${d.id}'),
                child: Padding(
                  padding: const EdgeInsets.all(KsSpace.s4),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          const Icon(LucideIcons.fileText),
                          const SizedBox(width: KsSpace.s3),
                          Expanded(child: Text(legalKindLabel(l, d), style: t.titleSmall)),
                          if (d.version?.isNotEmpty ?? false)
                            StatusBadge(label: l.legalVersion(localizeDigits(d.version!, lang))),
                        ],
                      ),
                      if (d.url?.isNotEmpty ?? false) ...[
                        const SizedBox(height: KsSpace.s2),
                        Text(l.legalOpenHint, style: t.bodySmall),
                        SelectableText(d.url!, style: t.bodyMedium),
                        Align(
                          alignment: Alignment.centerLeft,
                          child: TextButton.icon(
                            onPressed: () => copyText(context, d.url!),
                            icon: const Icon(LucideIcons.copy, size: 18),
                            label: Text(l.ecoCopyLink),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            const SizedBox(height: KsSpace.s2),
            CheckboxListTile(
              key: const Key('legal_agree'),
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              value: _agree,
              onChanged: (v) => setState(() => _agree = v ?? false),
              title: Text(l.legalAgree),
            ),
            const SizedBox(height: KsSpace.s3),
            FilledButton(
              key: const Key('legal_accept'),
              onPressed: _agree && !_busy && docs.isNotEmpty ? () => _accept(docs) : null,
              child:
                  _busy
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                      : Text(l.legalAccept),
            ),
            const SizedBox(height: KsSpace.s4),
            TextButton.icon(
              onPressed: () => confirmLogout(context, ref),
              icon: const Icon(LucideIcons.logOut, size: 18),
              label: Text(l.logout),
            ),
          ],
        ),
      ),
    );
  }
}
