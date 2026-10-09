import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/api/cached.dart';
import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/router/router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/eco.dart';
import '../../../../core/widgets/signature/signature.dart';
import '../../../bolau/bolau_repository.dart';
import '../../../bolau/ui/sipalu/bolau_tab.dart';
import '../jobs_data.dart';
import 'offers.dart';

String stageLabel(AppLocalizations l, String stage) => switch (stage) {
  'shortlisted' => l.stageShortlisted,
  'interview' => l.stageInterview,
  'selected' => l.stageSelected,
  'joined' => l.stageJoined,
  'rejected' => l.stageRejected,
  'dropped' => l.stageDropped,
  _ => l.stageSourced,
};

Tone stageTone(String stage) => switch (stage) {
  'selected' || 'joined' => Tone.success,
  'interview' || 'shortlisted' => Tone.info,
  'rejected' || 'dropped' => Tone.neutral,
  _ => Tone.warning,
};

String jobWageText(AppLocalizations l, JobSummary j, String lang) {
  if (j.wage == null) return '';
  final m = formatMoney(j.wage, lang: lang);
  return j.wageType == 'daily' ? l.empWageDaily(m) : l.empWageMonthly(m);
}

/// Why this job was suggested: the server's reasons when sent, otherwise
/// what every recommended job matches by definition (trade + area).
String jobMatchReason(AppLocalizations l, JobSummary j, String lang) {
  if (j.matchReasons.isNotEmpty) return j.matchReasons.join(' · ');
  final trade = j.trade?.name(lang);
  return trade == null || trade.isEmpty ? l.jobsMatchSkillArea : l.jobsMatchTradeArea(trade);
}

/// Job card frame: white card with a coral accent strip on the left, as in
/// the approved worker home (brand v2 §19 "thin accent strip").
class JobCardFrame extends StatelessWidget {
  const JobCardFrame({super.key, required this.child, this.onTap});
  final Widget child;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(width: 8, color: context.ks.coral),
              Expanded(child: Padding(padding: const EdgeInsets.fromLTRB(14, 12, 14, 14), child: child)),
            ],
          ),
        ),
      ),
    );
  }
}

/// Jobs for you · Offers · My applications (`?tab=offers|applications`),
/// plus Bolau (`?tab=bolau`) while the `bolau` flag is on.
class JobsScreen extends ConsumerWidget {
  const JobsScreen({super.key, this.initialTab = 0});
  final int initialTab;

  /// Tab index of Bolau when shown.
  static const bolauTab = 3;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final bolau = ref.watch(bolauEnabledProvider);
    final count = bolau ? 4 : 3;
    return DefaultTabController(
      key: ValueKey(count),
      length: count,
      initialIndex: initialTab.clamp(0, count - 1),
      child: Scaffold(
        appBar: AppBar(
          title: Text(l.jobsTitle),
          actions: [
            IconButton(
              key: const Key('jobs_alerts'),
              tooltip: l.alertsTitle,
              onPressed: () => context.push(Routes.workerJobAlerts),
              icon: const Icon(LucideIcons.bellPlus),
            ),
          ],
          bottom: TabBar(
            isScrollable: bolau,
            tabAlignment: bolau ? TabAlignment.start : null,
            tabs: [
              Tab(text: l.jobsTabForYou),
              Tab(text: l.offersTab),
              Tab(text: l.jobsTabApplications),
              if (bolau) Tab(key: const Key('tab_bolau'), text: l.blTab),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            const RecommendedJobsTab(),
            const OffersTab(),
            const MyApplicationsTab(),
            if (bolau) const SipaluBolauTab(),
          ],
        ),
      ),
    );
  }
}

/// Facts row shared by job and application cards.
class JobFacts extends StatelessWidget {
  const JobFacts({super.key, required this.job, this.showMatchReason = false});
  final JobSummary job;

  /// Recommended jobs explain why they were suggested.
  final bool showMatchReason;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final wage = jobWageText(l, job, lang);
    final where = [
      if (job.organizationName.isNotEmpty) job.organizationName,
      if (job.district != null) job.district!.name(lang),
    ].join(' · ');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(job.title, style: t.titleSmall),
        if (where.isNotEmpty) Text(where, style: t.bodyMedium?.copyWith(color: context.ks.textMuted)),
        if (job.employerVerified) ...[const SizedBox(height: KsSpace.s1), const EmployerVerifiedBadge()],
        if (wage.isNotEmpty) ...[
          const SizedBox(height: KsSpace.s1),
          Text(
            wage,
            style: t.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
              color: context.ks.textPrimary,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
        if (showMatchReason) ...[
          const SizedBox(height: KsSpace.s1),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(LucideIcons.circleCheck, size: 16, color: context.ks.tealText),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  jobMatchReason(l, job, lang),
                  key: Key('match_reason_${job.id}'),
                  style: t.bodyMedium?.copyWith(color: context.ks.textSecondary),
                ),
              ),
            ],
          ),
        ],
        const SizedBox(height: KsSpace.s1),
        Wrap(
          spacing: KsSpace.s2,
          runSpacing: KsSpace.s1,
          children: [
            if (job.trade != null) StatusBadge(label: job.trade!.name(lang), icon: LucideIcons.hardHat),
            if (job.foodProvided) StatusBadge(label: l.jobsFood, icon: LucideIcons.utensils),
            if (job.accommodationProvided) StatusBadge(label: l.jobsStay, icon: LucideIcons.bedDouble),
            if (job.startDate != null)
              StatusBadge(
                label: l.jobsStarts(formatBsOrAd(job.startDateBs, job.startDate, lang)),
                icon: LucideIcons.calendar,
              ),
          ],
        ),
      ],
    );
  }
}

class RecommendedJobsTab extends ConsumerStatefulWidget {
  const RecommendedJobsTab({super.key});

  @override
  ConsumerState<RecommendedJobsTab> createState() => _RecommendedJobsTabState();
}

class _RecommendedJobsTabState extends ConsumerState<RecommendedJobsTab> {
  final Set<String> _sent = {};
  String? _busy;

  Future<void> _interest(JobSummary job) async {
    final l = context.l10n;
    final ok = await confirmDialog(
      context,
      title: l.jobsInterestConfirmTitle,
      body: '${job.title}\n\n${l.jobsReviewNote}',
      confirmLabel: l.jobsInterested,
    );
    if (!ok || !mounted) return;
    setState(() => _busy = job.id);
    try {
      await ref.read(jobsRepositoryProvider).interest(job.id);
      if (!mounted) return;
      setState(() => _sent.add(job.id));
      ref.invalidate(myApplicationsProvider);
      showSnack(context, l.jobsInterestSent);
    } catch (e) {
      if (mounted) showSnack(context, errorText(context, e), error: true);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final value = ref.watch(recommendedJobsProvider);
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(recommendedJobsProvider);
        try {
          await ref.read(recommendedJobsProvider.future);
        } catch (_) {}
      },
      child: FeatureAsyncBody<List<JobSummary>>(
        value: value,
        onRetry: () => ref.invalidate(recommendedJobsProvider),
        data:
            (jobs) => ListView(
              padding: const EdgeInsets.all(KsSpace.page),
              children: [
                InfoNote(key: const Key('jobs_review_note'), text: l.jobsReviewNote, icon: LucideIcons.shieldCheck),
                const SizedBox(height: KsSpace.s3),
                if (jobs.isEmpty)
                  EmptyState(
                    icon: LucideIcons.briefcase,
                    message: l.jobsEmpty,
                    art: KsArt.electricianBoard,
                    action: OutlinedButton.icon(
                      onPressed: () => context.push(Routes.workerAvailability),
                      icon: const Icon(LucideIcons.mapPin, size: 18),
                      label: Text(l.jobsUpdatePrefs),
                    ),
                  ),
                for (final j in jobs) ...[
                  JobCardFrame(
                    key: Key('job_${j.id}'),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        JobFacts(job: j, showMatchReason: true),
                        const SizedBox(height: KsSpace.s3),
                        if (_sent.contains(j.id))
                          Align(
                            alignment: Alignment.centerLeft,
                            child: StatusBadge(
                              key: Key('interest_sent_${j.id}'),
                              label: l.jobsInterestSentBadge,
                              tone: Tone.success,
                              icon: LucideIcons.check,
                            ),
                          )
                        else
                          FilledButton.icon(
                            key: Key('interest_${j.id}'),
                            onPressed: _busy == null ? () => _interest(j) : null,
                            icon:
                                _busy == j.id
                                    ? const SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(strokeWidth: 2),
                                    )
                                    : const Icon(LucideIcons.thumbsUp),
                            label: Text(l.jobsInterested),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: KsSpace.s3),
                ],
              ],
            ),
      ),
    );
  }
}

class MyApplicationsTab extends ConsumerStatefulWidget {
  const MyApplicationsTab({super.key});

  @override
  ConsumerState<MyApplicationsTab> createState() => _MyApplicationsTabState();
}

class _MyApplicationsTabState extends ConsumerState<MyApplicationsTab> {
  /// Answers given in this session (shown before the list reloads).
  final Map<String, String> _answered = {};
  String? _busy;

  Future<void> _respond(MyApplication a, {required bool interested}) async {
    final l = context.l10n;
    String? note;
    if (!interested) {
      note = await showDeclineDialog(context);
      if (note == null) return;
    }
    if (!mounted) return;
    setState(() => _busy = a.id);
    try {
      await ref.read(jobsRepositoryProvider).respond(a.id, interested: interested, note: note);
      if (!mounted) return;
      setState(() => _answered[a.id] = interested ? 'interested' : 'declined');
      showSnack(context, interested ? l.appsConfirmed : l.appsDeclined);
      ref.invalidate(myApplicationsProvider);
    } catch (e) {
      if (mounted) showSnack(context, errorText(context, e), error: true);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final value = ref.watch(myApplicationsProvider);
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(myApplicationsProvider);
        try {
          await ref.read(myApplicationsProvider.future);
        } catch (_) {}
      },
      child: MilestoneWatch(
        milestone: Milestone.firstPlacement,
        reached: switch (value) {
          AsyncData(:final value) when !value.fromCache => value.data.any((a) => a.stage == 'joined'),
          _ => null,
        },
        child: FeatureAsyncBody<Cached<List<MyApplication>>>(
          value: value,
          onRetry: () => ref.invalidate(myApplicationsProvider),
          data: (cached) {
            final apps = cached.data;
            return ListView(
              padding: const EdgeInsets.all(KsSpace.page),
              children: [
                if (cached.fromCache) const CachedNotice(),
                if (apps.isEmpty) EmptyState(icon: LucideIcons.fileText, message: l.appsEmpty, art: KsArt.solarRoof),
                for (final a in apps)
                  Builder(
                    builder: (_) {
                      final answered = _answered[a.id];
                      final response = answered ?? a.workerResponse;
                      final ask = answered == null && a.needsResponse;
                      return Card(
                        key: Key('application_${a.id}'),
                        child: Padding(
                          padding: const EdgeInsets.all(KsSpace.s4),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              JobFacts(job: a.job),
                              const SizedBox(height: KsSpace.s2),
                              Wrap(
                                spacing: KsSpace.s2,
                                runSpacing: KsSpace.s1,
                                children: [
                                  if (a.isEmployerInvite)
                                    StatusBadge(
                                      key: Key('invited_${a.id}'),
                                      label: l.appsInvited,
                                      tone: Tone.info,
                                      icon: LucideIcons.mailOpen,
                                    ),
                                  if (a.underReview)
                                    StatusBadge(
                                      label: l.appsUnderReview,
                                      tone: Tone.warning,
                                      icon: LucideIcons.hourglass,
                                    )
                                  else
                                    StatusBadge(label: stageLabel(l, a.stage), tone: stageTone(a.stage)),
                                  if (response == 'interested')
                                    StatusBadge(
                                      label: l.appsResponseInterested,
                                      tone: Tone.success,
                                      icon: LucideIcons.check,
                                    ),
                                  if (response == 'declined')
                                    StatusBadge(label: l.appsResponseDeclined, tone: Tone.neutral, icon: LucideIcons.x),
                                ],
                              ),
                              if (a.isEmployerInvite) ...[
                                const SizedBox(height: KsSpace.s2),
                                InfoNote(text: l.appsInvitedHint, icon: LucideIcons.mailOpen),
                              ],
                              if (a.interviews.isNotEmpty) ...[
                                const SizedBox(height: KsSpace.s3),
                                Text(l.ivTitle, style: t.titleSmall),
                                for (final iv in a.interviews) InterviewTile(interview: iv),
                              ] else if (a.interviewAt != null) ...[
                                const SizedBox(height: KsSpace.s2),
                                Text(
                                  l.appsInterview(
                                    '${formatBsDateTime(a.interviewAt, lang)} · ${formatTime(a.interviewAt!.toLocal(), lang)}',
                                  ),
                                  style: t.bodyMedium,
                                ),
                              ],
                              if (ask) ...[
                                const SizedBox(height: KsSpace.s3),
                                Text(l.appsConfirmPrompt, style: t.titleSmall),
                                const SizedBox(height: KsSpace.s2),
                                Row(
                                  children: [
                                    Expanded(
                                      child: OutlinedButton(
                                        key: Key('decline_${a.id}'),
                                        onPressed: _busy == null ? () => _respond(a, interested: false) : null,
                                        child: Text(l.appsDecline, textAlign: TextAlign.center),
                                      ),
                                    ),
                                    const SizedBox(width: KsSpace.s2),
                                    Expanded(
                                      child: FilledButton(
                                        key: Key('confirm_${a.id}'),
                                        onPressed: _busy == null ? () => _respond(a, interested: true) : null,
                                        child: Text(l.appsConfirm, textAlign: TextAlign.center),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ],
                          ),
                        ),
                      );
                    },
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}

String interviewModeLabel(AppLocalizations l, String mode) => switch (mode) {
  'phone' => l.ivModePhone,
  'video' => l.ivModeVideo,
  'trade_test' => l.ivModeTradeTest,
  _ => l.ivModeInPerson,
};

(String, Tone) interviewOutcome(AppLocalizations l, String outcome) => switch (outcome) {
  'passed' => (l.ivOutcomePassed, Tone.success),
  'failed' => (l.ivOutcomeFailed, Tone.neutral),
  'no_show' => (l.ivOutcomeNoShow, Tone.danger),
  _ => (l.ivOutcomePending, Tone.info),
};

/// One interview round: when, how, where, with whom, result.
class InterviewTile extends StatelessWidget {
  const InterviewTile({super.key, required this.interview});
  final Interview interview;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final iv = interview;
    final at = iv.scheduledAt?.toLocal();
    final when =
        at == null
            ? formatBsOrAd(iv.scheduledAtBs, null, lang)
            : '${formatBsDateTime(at, lang)} · ${formatTime(at, lang)}';
    final (outcome, tone) = interviewOutcome(l, iv.outcome);
    final icon = switch (iv.mode) {
      'phone' => LucideIcons.phone,
      'video' => LucideIcons.video,
      'trade_test' => LucideIcons.hammer,
      _ => LucideIcons.users,
    };
    return Padding(
      key: Key('interview_${iv.id}'),
      padding: const EdgeInsets.only(top: KsSpace.s2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20),
          const SizedBox(width: KsSpace.s2),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(when, style: t.bodyMedium),
                Text(interviewModeLabel(l, iv.mode), style: t.bodySmall),
                if (iv.location?.isNotEmpty ?? false) Text(l.ivPlace(iv.location!), style: t.bodySmall),
                if (iv.interviewerName?.isNotEmpty ?? false) Text(l.ivWith(iv.interviewerName!), style: t.bodySmall),
              ],
            ),
          ),
          const SizedBox(width: KsSpace.s2),
          StatusBadge(label: outcome, tone: tone),
        ],
      ),
    );
  }
}

/// Confirms a decline; returns the optional reason ('' when none), or null
/// when the worker backs out.
Future<String?> showDeclineDialog(BuildContext context, {String? title, String? body}) =>
    showDialog<String>(context: context, builder: (_) => _DeclineDialog(title: title, body: body));

class _DeclineDialog extends StatefulWidget {
  const _DeclineDialog({this.title, this.body});
  final String? title;
  final String? body;

  @override
  State<_DeclineDialog> createState() => _DeclineDialogState();
}

class _DeclineDialogState extends State<_DeclineDialog> {
  final _reason = TextEditingController();

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return AlertDialog(
      title: Text(widget.title ?? l.appsDeclineConfirmTitle),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(widget.body ?? l.appsDeclineConfirmBody),
            const SizedBox(height: KsSpace.s3),
            TextField(
              key: const Key('decline_reason'),
              controller: _reason,
              maxLength: 300,
              decoration: InputDecoration(labelText: l.ecoOptional(l.appsDeclineReason)),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: Text(l.commonCancel)),
        FilledButton(
          key: const Key('decline_confirm'),
          style: destructiveFilledStyle(context),
          onPressed: () => Navigator.pop(context, _reason.text.trim()),
          child: Text(l.appsDecline),
        ),
      ],
    );
  }
}
