import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/router/router.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/motion.dart';
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
    final ks = context.ks;
    // Tinted tile (worker surface): teal = growth (brand v2 §4).
    return Container(
      key: const Key('profile_completeness'),
      padding: const EdgeInsets.fromLTRB(KsSpace.s4, KsSpace.s4, KsSpace.s4, KsSpace.s2),
      decoration: BoxDecoration(color: ks.tealSubtle, borderRadius: BorderRadius.circular(KsRadius.card)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: Text(l.complTitle, style: t.titleSmall)),
              Text(
                l.complPercent(formatPercent(c.percent / 100, lang)),
                style: t.labelLarge?.copyWith(color: ks.tealText, fontWeight: FontWeight.w700),
              ),
            ],
          ),
          const SizedBox(height: KsSpace.s3),
          ClipRRect(
            borderRadius: BorderRadius.circular(KsRadius.pill),
            child: KsAnimatedFraction(
              value: c.percent / 100,
              builder:
                  (context, v) => LinearProgressIndicator(
                    value: v,
                    minHeight: 8,
                    color: ks.tealText,
                    backgroundColor: ks.verifiedSoft,
                  ),
            ),
          ),
          const SizedBox(height: KsSpace.s2),
          Text(l.complHint, style: t.bodyMedium?.copyWith(color: ks.textSecondary)),
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
                openRoute(context, completenessRoute(i.key));
              },
            ),
        ],
      ),
    );
  }
}
