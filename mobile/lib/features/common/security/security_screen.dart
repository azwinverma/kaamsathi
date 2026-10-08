import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/format.dart';
import '../../../core/l10n/l10n.dart';
import '../../../core/theme/tokens.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/eco.dart';
import 'security_data.dart';

String platformLabel(AppLocalizations l, String platform) => switch (platform) {
  'android' => l.securityPlatformAndroid,
  'ios' => l.securityPlatformIos,
  'web' => l.securityPlatformWeb,
  _ => l.securityPlatformOther,
};

IconData _platformIcon(String platform) => switch (platform) {
  'android' || 'ios' => LucideIcons.smartphone,
  'web' => LucideIcons.monitor,
  _ => LucideIcons.laptop,
};

/// Login & security: devices logged in to this account; log one out, or all
/// others at once.
class SecurityScreen extends ConsumerWidget {
  const SecurityScreen({super.key});

  Future<void> _revoke(BuildContext context, WidgetRef ref, SessionDevice s) async {
    final l = context.l10n;
    if (!await confirmDialog(context, title: l.securityRevokeConfirm, confirmLabel: l.securityRevoke, danger: true)) {
      return;
    }
    try {
      await ref.read(securityRepositoryProvider).revoke(s.id);
      ref.invalidate(sessionsProvider);
      if (context.mounted) showSnack(context, l.securityRevoked);
    } catch (e) {
      if (context.mounted) showSnack(context, errorText(context, e), error: true);
    }
  }

  Future<void> _revokeOthers(BuildContext context, WidgetRef ref) async {
    final l = context.l10n;
    if (!await confirmDialog(
      context,
      title: l.securityRevokeOthersConfirm,
      confirmLabel: l.securityRevoke,
      danger: true,
    )) {
      return;
    }
    try {
      await ref.read(securityRepositoryProvider).revokeOthers();
      ref.invalidate(sessionsProvider);
      if (context.mounted) showSnack(context, l.securityRevokedOthers);
    } catch (e) {
      if (context.mounted) showSnack(context, errorText(context, e), error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final value = ref.watch(sessionsProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.securityTitle)),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(sessionsProvider);
          try {
            await ref.read(sessionsProvider.future);
          } catch (_) {}
        },
        child: FeatureAsyncBody<List<SessionDevice>>(
          value: value,
          onRetry: () => ref.invalidate(sessionsProvider),
          data: (items) {
            final others = items.where((s) => !s.current).length;
            return ListView(
              padding: const EdgeInsets.all(KsSpace.page),
              children: [
                Text(l.securityIntro, style: t.bodyMedium),
                const SizedBox(height: KsSpace.s3),
                for (final s in items)
                  Card(
                    key: Key('session_${s.id}'),
                    child: ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: KsSpace.s4, vertical: KsSpace.s2),
                      leading: Icon(_platformIcon(s.platform)),
                      title: Text(
                        [platformLabel(l, s.platform), if (s.clientLabel != null) s.clientLabel!].join(' · '),
                      ),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (s.current)
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 4),
                              child: StatusBadge(
                                label: l.securityThisDevice,
                                tone: Tone.success,
                                icon: LucideIcons.circleCheck,
                              ),
                            ),
                          if (s.lastSeenAt != null)
                            Text(l.securityLastSeen(formatBsDateTime(s.lastSeenAt, lang)))
                          else if (s.createdAt != null)
                            Text(l.securitySignedIn(formatBsDateTime(s.createdAt, lang))),
                          if (s.ip?.isNotEmpty ?? false) Text(s.ip!, style: t.bodySmall),
                        ],
                      ),
                      trailing:
                          s.current
                              ? null
                              : TextButton(
                                key: Key('revoke_${s.id}'),
                                onPressed: () => _revoke(context, ref, s),
                                child: Text(l.securityRevoke),
                              ),
                    ),
                  ),
                if (others > 0) ...[
                  const SizedBox(height: KsSpace.s4),
                  OutlinedButton.icon(
                    key: const Key('revoke_others'),
                    onPressed: () => _revokeOthers(context, ref),
                    icon: const Icon(LucideIcons.logOut, size: 20),
                    label: Text(l.securityRevokeOthers),
                  ),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}
