import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/api/cached.dart';
import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/router/router.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/eco.dart';
import '../../../../core/widgets/signature/skill_ladder.dart';
import '../trust_data.dart';

/// Local label for verification level 0–5 (used when the server sends none).
String trustLevelLabel(AppLocalizations l, int level) => switch (level) {
  1 => l.trustLevel1,
  2 => l.trustLevel2,
  3 => l.trustLevel3,
  4 => l.trustLevel4,
  5 => l.trustLevel5,
  _ => l.trustLevel0,
};

String trustComponentLabel(AppLocalizations l, String key) => switch (key) {
  'employer_feedback' => l.trustCompEmployerFeedback,
  'attendance' => l.trustCompAttendance,
  'completion' => l.trustCompCompletion,
  'skills' => l.trustCompSkills,
  'repeat_hiring' => l.trustCompRepeatHiring,
  'stability' => l.trustCompStability,
  _ => key,
};

/// "My reliability" card on the worker home screen (GET /me/trust).
/// Hidden entirely while the trust service is not enabled on the server.
class TrustCard extends ConsumerWidget {
  const TrustCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = ref.watch(trustProvider);
    return switch (value) {
      AsyncData(:final value) => TrustCardView(
        summary: value.data,
        fromCache: value.fromCache,
        onViews: () => context.push(Routes.workerProfileViews),
      ),
      AsyncError(:final error) =>
        isFeatureUnavailable(error)
            ? const SizedBox.shrink()
            : Card(
              child: ListTile(
                leading: const Icon(LucideIcons.shieldCheck),
                title: Text(context.l10n.trustTitle),
                subtitle: Text(errorText(context, error)),
                trailing: IconButton(
                  tooltip: context.l10n.commonRetry,
                  icon: const Icon(LucideIcons.refreshCw),
                  onPressed: () => ref.invalidate(trustProvider),
                ),
              ),
            ),
      _ => Card(
        child: Padding(
          padding: const EdgeInsets.all(KsSpace.s4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(context.l10n.trustTitle, style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: KsSpace.s3),
              const LinearProgressIndicator(),
            ],
          ),
        ),
      ),
    };
  }
}

/// Pure presentation of [TrustSummary] (widget-tested).
class TrustCardView extends StatelessWidget {
  const TrustCardView({super.key, required this.summary, this.fromCache = false, this.onViews});

  final TrustSummary summary;
  final bool fromCache;
  final VoidCallback? onViews;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final c = context.ks;
    final s = summary;
    final level = s.verificationLevel;
    final levelLabel =
        (s.verificationLevelLabel?.isNotEmpty ?? false) ? s.verificationLevelLabel! : trustLevelLabel(l, level);
    return Card(
      key: const Key('trust_card'),
      child: Padding(
        padding: const EdgeInsets.all(KsSpace.s4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (fromCache) const CachedNotice(),
            Text(l.trustTitle, style: t.titleSmall),
            const SizedBox(height: KsSpace.s3),
            Row(
              children: [
                Semantics(label: l.trustScoreLabel, child: ScoreRing(score: s.reliabilityScore)),
                const SizedBox(width: KsSpace.s4),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(l.trustScoreLabel, style: t.bodySmall?.copyWith(color: c.textMuted)),
                      Text(
                        s.reliabilityScore == null
                            ? l.trustScoreNone
                            : l.trustScoreOutOf(localizeDigits('${s.reliabilityScore}', lang)),
                        style: t.bodyMedium,
                      ),
                      const SizedBox(height: KsSpace.s3),
                      _LevelBadge(level: level, label: levelLabel),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: KsSpace.s4),
            Text(l.ladderTitle, style: t.labelLarge),
            const SizedBox(height: KsSpace.s2),
            SkillLadder(earned: ladderRungsForLevel(level), height: 64),
            if (s.breakdown.isNotEmpty) ...[
              const SizedBox(height: KsSpace.s2),
              Theme(
                data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                child: ExpansionTile(
                  key: const Key('trust_breakdown'),
                  tilePadding: EdgeInsets.zero,
                  childrenPadding: EdgeInsets.zero,
                  title: Text(l.trustBreakdown, style: t.bodyMedium),
                  children: [
                    for (final k in [
                      ...trustComponents.where(s.breakdown.containsKey),
                      ...s.breakdown.keys.where((k) => !trustComponents.contains(k)),
                    ])
                      FractionBar(label: trustComponentLabel(l, k), value: s.breakdown[k]!),
                    const SizedBox(height: KsSpace.s2),
                  ],
                ),
              ),
            ],
            if (s.nextSteps.isNotEmpty) ...[
              const SizedBox(height: KsSpace.s2),
              Text(l.trustNextSteps, style: t.labelLarge),
              const SizedBox(height: KsSpace.s1),
              for (final step in s.nextSteps)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(LucideIcons.circleArrowRight, size: 18, color: Theme.of(context).colorScheme.primary),
                      const SizedBox(width: KsSpace.s2),
                      Expanded(child: Text(step, style: t.bodyMedium)),
                    ],
                  ),
                ),
            ],
            const SizedBox(height: KsSpace.s2),
            Text(l.trustNotCredit, style: t.bodySmall?.copyWith(color: c.textMuted)),
            if (onViews != null)
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: onViews,
                  icon: const Icon(LucideIcons.eye, size: 18),
                  label: Text(l.profileViewsTitle),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _LevelBadge extends StatelessWidget {
  const _LevelBadge({required this.level, required this.label});
  final int level;
  final String label;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final c = context.ks;
    final t = Theme.of(context).textTheme;
    final strong = level >= 2;
    return Semantics(
      label: '${l.trustLevelN(localizeDigits('$level', context.lang))}, $label',
      excludeSemantics: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(LucideIcons.shieldCheck, size: 18, color: strong ? c.successText : c.infoText),
              const SizedBox(width: 4),
              Flexible(
                child: Text(
                  '${l.trustLevelN(localizeDigits('$level', context.lang))} · $label',
                  style: t.labelMedium?.copyWith(color: strong ? c.successText : c.infoText),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
