import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/auth/session.dart';
import '../../../core/format.dart';
import '../../../core/l10n/l10n.dart';
import '../../../core/theme/tokens.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/language_toggle.dart';

/// Signed in, but neither a supervisor nor a linked worker yet.
class NoAccessScreen extends ConsumerStatefulWidget {
  const NoAccessScreen({super.key});

  @override
  ConsumerState<NoAccessScreen> createState() => _NoAccessScreenState();
}

class _NoAccessScreenState extends ConsumerState<NoAccessScreen> {
  bool _busy = false;

  Future<void> _retry() async {
    setState(() => _busy = true);
    try {
      final me = await ref.read(sessionProvider.notifier).claimWorker();
      if (mounted && !me.hasAnyMode) {
        showSnack(context, context.l10n.noAccessStill);
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
    final t = Theme.of(context).textTheme;
    final phone = ref.watch(sessionProvider).me?.phone ?? '';
    return Scaffold(
      appBar: AppBar(title: Text(l.appName), actions: const [LanguageToggle()]),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(KsSpace.s6),
          children: [
            const SizedBox(height: KsSpace.s6),
            Center(
              child: CircleAvatar(
                radius: 40,
                backgroundColor: Theme.of(context).colorScheme.primaryContainer,
                child: Icon(LucideIcons.handshake, size: 36, color: Theme.of(context).colorScheme.primary),
              ),
            ),
            const SizedBox(height: KsSpace.s6),
            Text(l.noAccessTitle, style: t.headlineMedium, textAlign: TextAlign.center),
            const SizedBox(height: KsSpace.s3),
            Text(
              l.noAccessBody(formatPhone(phone, lang: context.lang)),
              style: t.bodyLarge,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: KsSpace.s8),
            FilledButton.icon(
              onPressed: _busy ? null : _retry,
              icon:
                  _busy
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(LucideIcons.refreshCw, size: 20),
              label: Text(l.noAccessRetry),
            ),
            const SizedBox(height: KsSpace.s3),
            OutlinedButton(onPressed: () => ref.read(sessionProvider.notifier).logout(), child: Text(l.logout)),
          ],
        ),
      ),
    );
  }
}
