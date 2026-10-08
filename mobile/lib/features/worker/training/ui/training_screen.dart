import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/eco.dart';
import '../../../../core/widgets/signature/signature.dart';
import '../../credentials/ui/credentials_screen.dart';
import '../training_data.dart';

String courseModeLabel(AppLocalizations l, String? m) => switch (m) {
  'on_site' => l.trainModeOnSite,
  'online' => l.trainModeOnline,
  'classroom' => l.trainModeClassroom,
  _ => '',
};

String courseLevelLabel(AppLocalizations l, String? level, String lang) => switch (level) {
  'basic' => l.trainLevelBasic,
  'refresher' => l.trainLevelRefresher,
  null => '',
  _ => nstbLabel(l, level, lang),
};

(String, Tone) enrollmentStatus(AppLocalizations l, String s) => switch (s) {
  'enrolled' => (l.trainStatusEnrolled, Tone.info),
  'completed' => (l.trainStatusCompleted, Tone.success),
  'dropped' => (l.trainStatusDropped, Tone.neutral),
  'rejected' => (l.trainStatusRejected, Tone.danger),
  _ => (l.trainStatusApplied, Tone.warning),
};

class TrainingScreen extends ConsumerWidget {
  const TrainingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    Future<void> refresh() async {
      ref.invalidate(coursesProvider);
      ref.invalidate(enrollmentsProvider);
      try {
        await ref.read(coursesProvider.future);
      } catch (_) {}
    }

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: Text(l.trainTitle),
          bottom: TabBar(tabs: [Tab(text: l.trainCourses), Tab(text: l.trainMine)]),
        ),
        body: MilestoneWatch(
          milestone: Milestone.trainingCompleted,
          reached: switch (ref.watch(enrollmentsProvider)) {
            AsyncData(:final value) => value.any((e) => e.status == 'completed'),
            _ => null,
          },
          child: TabBarView(
            children: [
              RefreshIndicator(onRefresh: refresh, child: const _Courses()),
              RefreshIndicator(onRefresh: refresh, child: const _Mine()),
            ],
          ),
        ),
      ),
    );
  }
}

class _Courses extends ConsumerWidget {
  const _Courses();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final applied = {
      for (final e in ref.watch(enrollmentsProvider).value ?? const <Enrollment>[])
        if (e.status != 'dropped' && e.status != 'rejected') e.courseId,
    };
    return FeatureAsyncBody<List<Course>>(
      value: ref.watch(coursesProvider),
      onRetry: () => ref.invalidate(coursesProvider),
      data: (courses) {
        final rec = courses.where((c) => c.recommended).toList();
        final other = courses.where((c) => !c.recommended).toList();
        return ListView(
          padding: const EdgeInsets.all(KsSpace.page),
          children: [
            if (courses.isEmpty) EmptyState(icon: LucideIcons.graduationCap, message: l.trainEmpty),
            if (rec.isNotEmpty) GroupLabel(l.trainRecommended),
            for (final c in rec) _CourseCard(course: c, applied: applied.contains(c.id)),
            if (rec.isNotEmpty && other.isNotEmpty) GroupLabel(l.trainCourses),
            for (final c in other) _CourseCard(course: c, applied: applied.contains(c.id)),
            if (courses.isNotEmpty) ...[
              const SizedBox(height: KsSpace.s2),
              Text(l.trainFeeNote, style: Theme.of(context).textTheme.bodySmall),
            ],
          ],
        );
      },
    );
  }
}

class _CourseCard extends ConsumerStatefulWidget {
  const _CourseCard({required this.course, required this.applied});
  final Course course;
  final bool applied;

  @override
  ConsumerState<_CourseCard> createState() => _CourseCardState();
}

class _CourseCardState extends ConsumerState<_CourseCard> {
  bool _busy = false;

  Future<void> _apply() async {
    final l = context.l10n;
    final c = widget.course;
    if (!await confirmDialog(
      context,
      title: l.trainApplyConfirm(c.displayTitle(context.lang)),
      confirmLabel: l.trainApply,
    )) {
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(trainingRepositoryProvider).apply(c.id);
      ref.invalidate(enrollmentsProvider);
      if (mounted) showSnack(context, l.trainApplied);
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
    final c = widget.course;
    final free = (parsePaisa(c.fee) ?? 0) == 0;
    final meta = [
      if (c.trade != null) c.trade!.name(lang),
      courseLevelLabel(l, c.level, lang),
      if (c.durationDays != null) l.ecoDays(localizeDigits('${c.durationDays}', lang)),
      courseModeLabel(l, c.mode),
      if (c.district != null) c.district!,
    ].where((s) => s.isNotEmpty).join(' · ');
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(KsSpace.s4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(c.displayTitle(lang), style: t.titleSmall),
            if (c.provider(lang) != null) Text(c.provider(lang)!, style: t.bodyMedium),
            if (meta.isNotEmpty) Text(meta, style: t.bodySmall),
            const SizedBox(height: KsSpace.s2),
            Wrap(
              spacing: KsSpace.s2,
              runSpacing: KsSpace.s1,
              children: [
                StatusBadge(
                  label: free ? l.trainFree : l.trainFee(formatMoney(c.fee, lang: lang)),
                  tone: free ? Tone.success : Tone.neutral,
                ),
                if (c.startsOn != null) StatusBadge(label: l.trainStarts(formatBsOrAd(c.startsOnBs, c.startsOn, lang))),
                if (c.seats != null) StatusBadge(label: l.trainSeats(localizeDigits('${c.seats}', lang))),
                if (c.leadsToNstb) StatusBadge(label: l.trainLeadsNstb, tone: Tone.info, icon: LucideIcons.award),
              ],
            ),
            if (c.sponsorNote?.isNotEmpty ?? false) ...[
              const SizedBox(height: KsSpace.s2),
              Text(c.sponsorNote!, style: t.bodySmall),
            ],
            if (c.description?.isNotEmpty ?? false) ...[
              const SizedBox(height: KsSpace.s2),
              Text(c.description!, style: t.bodyMedium, maxLines: 4, overflow: TextOverflow.ellipsis),
            ],
            const SizedBox(height: KsSpace.s3),
            if (widget.applied)
              Align(
                alignment: Alignment.centerLeft,
                child: StatusBadge(label: l.trainAlreadyApplied, tone: Tone.success, icon: LucideIcons.check),
              )
            else
              FilledButton(onPressed: _busy || c.status != 'open' ? null : _apply, child: Text(l.trainApply)),
          ],
        ),
      ),
    );
  }
}

class _Mine extends ConsumerWidget {
  const _Mine();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    return FeatureAsyncBody<List<Enrollment>>(
      value: ref.watch(enrollmentsProvider),
      onRetry: () => ref.invalidate(enrollmentsProvider),
      data:
          (items) => ListView(
            padding: const EdgeInsets.all(KsSpace.page),
            children: [
              if (items.isEmpty) EmptyState(icon: LucideIcons.graduationCap, message: l.trainMineEmpty),
              for (final e in items)
                Card(
                  child: ListTile(
                    leading: const Icon(LucideIcons.graduationCap),
                    title: Text(e.course?.displayTitle(lang) ?? ''),
                    subtitle: Text(
                      [
                        if (e.course?.provider(lang) != null) e.course!.provider(lang)!,
                        if (e.status == 'completed' && e.completedOn != null)
                          l.trainCompletedOn(formatBsOrAd(e.completedOnBs, e.completedOn, lang))
                        else if (e.course?.startsOn != null)
                          l.trainStarts(formatBsOrAd(e.course!.startsOnBs, e.course!.startsOn, lang)),
                      ].join('\n'),
                      style: t.bodySmall,
                    ),
                    trailing: Builder(
                      builder: (_) {
                        final (label, tone) = enrollmentStatus(l, e.status);
                        return StatusBadge(label: label, tone: tone);
                      },
                    ),
                  ),
                ),
            ],
          ),
    );
  }
}
