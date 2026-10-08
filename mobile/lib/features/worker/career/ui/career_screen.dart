import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/api/cached.dart';
import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/router/router.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/eco.dart';
import '../../../../core/widgets/signature/signature.dart';
import '../career_data.dart';

String careerKindLabel(AppLocalizations l, String kind) => switch (kind) {
  'credential' => l.careerKindCredential,
  'course' => l.careerKindCourse,
  'skill' => l.careerKindSkill,
  _ => l.careerKindProfile,
};

IconData careerKindIcon(String kind) => switch (kind) {
  'credential' => LucideIcons.award,
  'course' => LucideIcons.graduationCap,
  'skill' => LucideIcons.hammer,
  _ => LucideIcons.userRoundCheck,
};

/// Where a recommendation leads inside the app.
String careerRoute(CareerRecommendation r) {
  final link = r.link ?? '';
  if (link.startsWith('/w/')) return link;
  // Server deep links: ks://profile, ks://credentials, ks://work-history, ks://courses[/id].
  if (link.startsWith('ks://')) {
    final target = link.substring(5).split('/').first;
    switch (target) {
      case 'profile':
        return Routes.workerProfile;
      case 'credentials':
        return Routes.workerCredentials;
      case 'work-history':
        return Routes.workerWorkHistory;
      case 'courses':
      case 'training':
        return Routes.workerTraining;
      case 'availability':
      case 'preferences':
        return Routes.workerAvailability;
      case 'jobs':
        return Routes.workerJobs;
    }
  }
  final t = '${r.title} $link'.toLowerCase();
  return switch (r.kind) {
    'course' || 'skill' => Routes.workerTraining,
    'credential' => Routes.workerCredentials,
    _ when t.contains('history') || t.contains('experience') => Routes.workerWorkHistory,
    _ when t.contains('area') || t.contains('district') || t.contains('availab') => Routes.workerAvailability,
    _ => Routes.workerProfile,
  };
}

class _RecTile extends StatelessWidget {
  const _RecTile({required this.rec});
  final CareerRecommendation rec;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final reason = rec.reasonFor(lang);
    final uplift = rec.expectedUpliftPct;
    return InkWell(
      borderRadius: BorderRadius.circular(KsRadius.control),
      // Tab roots are switched to, sub-pages are pushed.
      onTap: () => openRoute(context, careerRoute(rec)),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: KsSpace.s2),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(careerKindIcon(rec.kind), color: Theme.of(context).colorScheme.primary),
            const SizedBox(width: KsSpace.s3),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(rec.titleFor(lang), style: t.titleSmall),
                  if (reason.isNotEmpty) Text(reason, style: t.bodySmall),
                  const SizedBox(height: KsSpace.s1),
                  Wrap(
                    spacing: KsSpace.s2,
                    runSpacing: KsSpace.s1,
                    children: [
                      StatusBadge(label: careerKindLabel(l, rec.kind)),
                      if (uplift != null && uplift > 0)
                        StatusBadge(
                          label: l.careerUplift(localizeDigits('${uplift.round()}', lang)),
                          tone: Tone.success,
                          icon: LucideIcons.trendingUp,
                        ),
                    ],
                  ),
                ],
              ),
            ),
            const Icon(LucideIcons.chevronRight),
          ],
        ),
      ),
    );
  }
}

/// Home card: top two recommendations. Hidden while the endpoint is off or
/// when there is nothing to suggest.
class CareerCard extends ConsumerWidget {
  const CareerCard({super.key, this.showArt = false});

  /// Adds the small cut-paper "career step" photo slot (Home only, so the
  /// Learn tab keeps a single framed image).
  final bool showArt;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final value = ref.watch(careerProvider).value;
    final recs = value?.data.recommendations ?? const <CareerRecommendation>[];
    if (recs.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: KsSpace.s4),
      child: SectionCard(
        key: const Key('career_card'),
        title: l.careerTitle,
        trailing: TextButton(onPressed: () => context.push(Routes.workerCareer), child: Text(l.careerSeeAll)),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [for (final r in recs.take(2)) _RecTile(rec: r)],
              ),
            ),
            if (showArt) ...[
              const SizedBox(width: KsSpace.s2),
              CutPaperFrame(
                width: 64,
                aspectRatio: 1,
                angle: 0.08,
                tapeColor: context.ks.coral,
                child: ImageSlot(slot: PhotoSlot.careerStep, semanticLabel: l.slotCareerStepAlt),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class CareerScreen extends ConsumerWidget {
  const CareerScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final value = ref.watch(careerProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.careerTitle)),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(careerProvider);
          try {
            await ref.read(careerProvider.future);
          } catch (_) {}
        },
        child: FeatureAsyncBody<Cached<CareerSummary>>(
          value: value,
          onRetry: () => ref.invalidate(careerProvider),
          data: (cached) {
            final s = cached.data;
            return ListView(
              padding: const EdgeInsets.all(KsSpace.page),
              children: [
                if (cached.fromCache) const CachedNotice(),
                if (s.trades.isNotEmpty) ...[
                  Text(l.careerYourTrades, style: t.labelLarge),
                  const SizedBox(height: KsSpace.s2),
                  Wrap(
                    spacing: KsSpace.s2,
                    runSpacing: KsSpace.s1,
                    children: [
                      for (final tr in s.trades)
                        StatusBadge(label: tr.name(lang), icon: LucideIcons.hardHat, tone: Tone.info),
                    ],
                  ),
                  const SizedBox(height: KsSpace.s4),
                ],
                if (s.recommendations.isEmpty)
                  EmptyState(icon: LucideIcons.sprout, message: l.careerEmpty)
                else
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: KsSpace.s4, vertical: KsSpace.s2),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          for (var i = 0; i < s.recommendations.length; i++) ...[
                            if (i > 0) const Divider(height: 1),
                            _RecTile(rec: s.recommendations[i]),
                          ],
                        ],
                      ),
                    ),
                  ),
                if (s.recommendations.any((r) => r.expectedUpliftPct != null)) ...[
                  const SizedBox(height: KsSpace.s3),
                  Text(l.careerEstimateNote, style: t.bodySmall),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}
