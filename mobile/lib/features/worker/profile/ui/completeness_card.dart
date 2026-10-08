import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/router/router.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../data/worker_models.dart';
import '../../data/worker_repository.dart';

String completenessLabel(AppLocalizations l, String key) => switch (key) {
  'photo' => l.complPhoto,
  'identity' => l.complIdentity,
  'skills' => l.complSkills,
  'languages' => l.complLanguages,
  'availability' => l.complAvailability,
  'verified_credential' => l.complVerifiedCredential,
  'work_history' => l.complWorkHistory,
  'payment_details' => l.complPaymentDetails,
  _ => key,
};

/// Where each checklist item is fixed. Photo and ID are added by the
/// KaamSathi team / employer at registration, so they open Help; payment
/// details live on the Profile tab (edit sheet).
String completenessRoute(String key) => switch (key) {
  'languages' => Routes.workerLanguages,
  'availability' => Routes.workerAvailability,
  'verified_credential' => Routes.workerCredentials,
  'work_history' => Routes.workerWorkHistory,
  'skills' => Routes.workerPassport,
  'payment_details' => Routes.workerProfile,
  _ => Routes.help,
};

IconData _icon(String key) => switch (key) {
  'photo' => LucideIcons.camera,
  'identity' => LucideIcons.idCard,
  'skills' => LucideIcons.hammer,
  'languages' => LucideIcons.languages,
  'availability' => LucideIcons.mapPin,
  'verified_credential' => LucideIcons.award,
  'work_history' => LucideIcons.history,
  'payment_details' => LucideIcons.landmark,
  _ => LucideIcons.circle,
};

/// Profile-completeness card (`/me/worker.profile_completeness`). Hidden when
/// the server does not send it or the profile is complete.
class ProfileCompletenessCard extends ConsumerWidget {
  const ProfileCompletenessCard({super.key, this.onItem, this.maxItems = 3});

  /// Overrides navigation for an item (e.g. open the payment sheet in place).
  final bool Function(String key)? onItem;
  final int maxItems;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = ref.watch(workerProfileProvider).value?.completeness;
    if (c == null || c.isComplete) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: KsSpace.s4),
      child: CompletenessView(completeness: c, onItem: onItem, maxItems: maxItems),
    );
  }
}

class CompletenessView extends StatelessWidget {
  const CompletenessView({super.key, required this.completeness, this.onItem, this.maxItems = 3});
  final ProfileCompleteness completeness;
  final bool Function(String key)? onItem;
  final int maxItems;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final c = completeness;
    final todo = c.todo.take(maxItems).toList();
    return SectionCard(
      key: const Key('profile_completeness'),
      title: l.complTitle,
      trailing: Text(
        l.complPercent(formatPercent(c.percent / 100, lang)),
        style: t.labelLarge?.copyWith(color: Theme.of(context).colorScheme.primary),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: c.percent / 100,
              minHeight: 8,
              backgroundColor: context.statusColors.neutralBg,
            ),
          ),
          const SizedBox(height: KsSpace.s2),
          Text(l.complHint, style: t.bodySmall),
          for (final i in todo)
            ListTile(
              key: Key('compl_${i.key}'),
              contentPadding: EdgeInsets.zero,
              leading: Icon(_icon(i.key)),
              // Server label is already localised; ours is the fallback.
              title: Text((i.label?.isNotEmpty ?? false) ? i.label! : completenessLabel(l, i.key)),
              trailing: const Icon(LucideIcons.chevronRight),
              onTap: () {
                if (onItem?.call(i.key) ?? false) return;
                final route = completenessRoute(i.key);
                if (route == Routes.workerProfile) {
                  context.go(route);
                } else {
                  context.push(route);
                }
              },
            ),
        ],
      ),
    );
  }
}
