import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/l10n/l10n.dart';
import '../../../core/router/router.dart';
import '../../../core/theme/tokens.dart';
import '../../../core/widgets/signature/signature.dart';
import '../../common/inbox/inbox_screen.dart';
import '../career/career_data.dart';
import '../career/ui/career_screen.dart';

/// Learn tab: training, certificates and the next step in the worker's
/// trade. Components: [CutPaperFrame] + [ImageSlot] (learn workshop photo
/// slot), accent-strip tiles, [CareerCard].
class LearnScreen extends ConsumerWidget {
  const LearnScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final c = context.ks;
    return Scaffold(
      appBar: AppBar(title: Text(l.learnTitle), actions: const [InboxBell()]),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(careerProvider);
          try {
            await ref.read(careerProvider.future);
          } catch (_) {}
        },
        child: ListView(
          padding: const EdgeInsets.all(KsSpace.page),
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(l.learnHeadline, style: t.headlineSmall),
                      const SizedBox(height: KsSpace.s1),
                      Text(l.learnIntro, style: t.bodyMedium),
                    ],
                  ),
                ),
                const SizedBox(width: KsSpace.s3),
                CutPaperFrame(
                  width: 92,
                  aspectRatio: 4 / 5,
                  angle: 0.07,
                  tapeColor: c.teal,
                  child: ImageSlot(
                    slot: PhotoSlot.learnWorkshop,
                    photoAlt: l.slotLearnWorkshopAlt,
                    illustrationAlt: l.slotLearnWorkshopIllustrationAlt,
                  ),
                ),
              ],
            ),
            const SizedBox(height: KsSpace.s4),
            _LearnTile(
              key: const Key('learn_training'),
              accent: c.teal,
              icon: LucideIcons.graduationCap,
              title: l.trainTitle,
              subtitle: l.trainMenuSubtitle,
              onTap: () => context.push(Routes.workerTraining),
            ),
            const SizedBox(height: KsSpace.s3),
            _LearnTile(
              key: const Key('learn_credentials'),
              accent: c.actionPrimary,
              icon: LucideIcons.award,
              title: l.credTitle,
              subtitle: l.credMenuSubtitle,
              onTap: () => context.push(Routes.workerCredentials),
            ),
            const SizedBox(height: KsSpace.s3),
            _LearnTile(
              key: const Key('learn_career'),
              accent: c.yellow,
              icon: LucideIcons.trendingUp,
              title: l.careerTitle,
              subtitle: l.careerMenuSubtitle,
              onTap: () => context.push(Routes.workerCareer),
            ),
            const SizedBox(height: KsSpace.s4),
            const CareerCard(),
          ],
        ),
      ),
    );
  }
}

/// White tile with a coloured accent strip on the left (brand v2 §19 cards:
/// "thin accent strip"), the same treatment as job cards.
class _LearnTile extends StatelessWidget {
  const _LearnTile({
    super.key,
    required this.accent,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final Color accent;
  final IconData icon;
  final String title;
  final String subtitle;
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
              Container(width: 8, color: accent),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(KsSpace.s4, KsSpace.s3, KsSpace.s2, KsSpace.s3),
                  child: Row(
                    children: [
                      Icon(icon, color: c.textPrimary),
                      const SizedBox(width: KsSpace.s3),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(title, style: t.titleSmall),
                            Text(subtitle, style: t.bodyMedium?.copyWith(color: c.textMuted)),
                          ],
                        ),
                      ),
                      Icon(LucideIcons.chevronRight, color: c.textMuted),
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
