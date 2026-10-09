import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/auth/session.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/router/router.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/language_toggle.dart';
import '../../../../core/widgets/signature/signature.dart';

/// First-run choice (Bolau on, no role yet): find work as a Sipalu, or book
/// a Sipalu as a Ghardhani. Employees added by an employer can re-check.
class WelcomeScreen extends ConsumerStatefulWidget {
  const WelcomeScreen({super.key});

  @override
  ConsumerState<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends ConsumerState<WelcomeScreen> {
  bool _busy = false;

  Future<void> _claim() async {
    setState(() => _busy = true);
    try {
      final me = await ref.read(sessionProvider.notifier).claimWorker();
      if (mounted && !me.hasAnyMode) showSnack(context, context.l10n.noAccessStill);
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
    return Scaffold(
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          MuralHeader(
            lettering: 'साथी',
            trailing: const LanguageToggle(),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l.appName, style: t.bodyMedium?.copyWith(color: KsMural.onGround)),
                const SizedBox(height: KsSpace.s1),
                Text(l.blWelcomeTitle, style: t.headlineSmall?.copyWith(color: KsMural.onGround)),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(KsSpace.page),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _ChoiceCard(
                  key: const Key('choose_sipalu'),
                  icon: LucideIcons.hammer,
                  title: l.blChooseSipalu,
                  body: l.blChooseSipaluBody,
                  onTap: () => context.push(Routes.sipaluJoin),
                ),
                const SizedBox(height: KsSpace.s3),
                _ChoiceCard(
                  key: const Key('choose_ghardhani'),
                  icon: LucideIcons.house,
                  title: l.blChooseGhardhani,
                  body: l.blChooseGhardhaniBody,
                  onTap: () => ref.read(sessionProvider.notifier).setMode(AppMode.ghardhani),
                ),
                const SizedBox(height: KsSpace.s6),
                Text(l.blEmployerAddedMe, style: t.titleSmall),
                const SizedBox(height: KsSpace.s1),
                Text(l.blEmployerAddedMeBody, style: t.bodyMedium),
                const SizedBox(height: KsSpace.s2),
                OutlinedButton.icon(
                  key: const Key('welcome_claim'),
                  onPressed: _busy ? null : _claim,
                  icon:
                      _busy
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(LucideIcons.refreshCw, size: 18),
                  label: Text(l.noAccessRetry),
                ),
                const SizedBox(height: KsSpace.s2),
                TextButton(onPressed: () => ref.read(sessionProvider.notifier).logout(), child: Text(l.logout)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ChoiceCard extends StatelessWidget {
  const _ChoiceCard({super.key, required this.icon, required this.title, required this.body, required this.onTap});
  final IconData icon;
  final String title;
  final String body;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final c = context.ks;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(width: 8, color: c.coral),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(KsSpace.s4),
                  child: Row(
                    children: [
                      Icon(icon, size: 32, color: c.textPrimary),
                      const SizedBox(width: KsSpace.s3),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(title, style: t.titleMedium),
                            const SizedBox(height: 2),
                            Text(body, style: t.bodyMedium?.copyWith(color: c.textSecondary)),
                          ],
                        ),
                      ),
                      const Icon(LucideIcons.chevronRight),
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
