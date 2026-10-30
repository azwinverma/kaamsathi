import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/api/api_exception.dart';
import '../../../../core/api/cached.dart';
import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/router/router.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/eco.dart';
import '../../../../core/widgets/signature/signature.dart';
import '../../../worker/jobs/ui/jobs_screen.dart' show JobCardFrame, showDeclineDialog;
import '../../bolau_logic.dart';
import '../../bolau_models.dart';
import '../../bolau_repository.dart';
import '../bolau_widgets.dart';
import 'portfolio_screen.dart' show PortfolioPreviewCard;

/// Jobs → Bolau: the Sipalu's bookings, nearby Kaam requests, offers and
/// earnings, with the "take bookings" switches on top.
class SipaluBolauTab extends ConsumerStatefulWidget {
  const SipaluBolauTab({super.key});

  @override
  ConsumerState<SipaluBolauTab> createState() => _SipaluBolauTabState();
}

enum _Segment { bookings, nearby, offers }

class _SipaluBolauTabState extends ConsumerState<SipaluBolauTab> {
  _Segment _segment = _Segment.bookings;

  Future<void> _refresh() async {
    ref.invalidate(mySipaluProvider);
    ref.invalidate(sipaluJobsProvider);
    ref.invalidate(nearbyRequestsProvider);
    ref.invalidate(myOffersProvider);
    try {
      await ref.read(mySipaluProvider.future);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final value = ref.watch(mySipaluProvider);
    return RefreshIndicator(
      onRefresh: _refresh,
      child: switch (value) {
        AsyncData(:final value) => _body(value),
        AsyncError(:final error) when error is ApiException && !error.isNetwork && !isFeatureUnavailable(error) =>
        // No Sipalu profile yet (403/400): invite to join.
        ListView(padding: const EdgeInsets.all(KsSpace.page), children: const [JoinBolauCard()]),
        AsyncError(:final error) => ListView(
          children: [
            isFeatureUnavailable(error)
                ? EmptyState(icon: LucideIcons.hourglass, message: l.ecoComingSoon)
                : ErrorView(error: error, onRetry: () => ref.invalidate(mySipaluProvider)),
          ],
        ),
        _ => const SkeletonDetail(),
      },
    );
  }

  Widget _body(MySipalu p) {
    final l = context.l10n;
    // A brand-new (lazily created) profile: invite to join. A worker added by
    // an employer already has a name, so look for any Bolau-specific step.
    const bolauSteps = {'services', 'availability', 'headline', 'consent', 'service_area'};
    if (!p.onboarding.completedSteps.any(bolauSteps.contains) && p.services.isEmpty) {
      return ListView(padding: const EdgeInsets.all(KsSpace.page), children: const [JoinBolauCard()]);
    }
    return MilestoneWatch(
      milestone: Milestone.sipaluBookable,
      reached: p.isBookable,
      child: ListView(
        padding: const EdgeInsets.all(KsSpace.page),
        children: [
          _StatusCard(profile: p),
          const SizedBox(height: KsSpace.s3),
          PortfolioPreviewCard(items: p.portfolio),
          const SizedBox(height: KsSpace.s3),
          const _EarningsCard(),
          const SizedBox(height: KsSpace.s3),
          SegmentedButton<_Segment>(
            key: const Key('bolau_segments'),
            showSelectedIcon: false,
            segments: [
              ButtonSegment(value: _Segment.bookings, label: Text(l.blSegBookings, overflow: TextOverflow.ellipsis)),
              ButtonSegment(value: _Segment.nearby, label: Text(l.blSegNearby, overflow: TextOverflow.ellipsis)),
              ButtonSegment(value: _Segment.offers, label: Text(l.blSegOffers, overflow: TextOverflow.ellipsis)),
            ],
            selected: {_segment},
            onSelectionChanged: (s) => setState(() => _segment = s.first),
          ),
          const SizedBox(height: KsSpace.s3),
          switch (_segment) {
            _Segment.bookings => const _BookingsSection(),
            _Segment.nearby => const _NearbySection(),
            _Segment.offers => const _OffersSection(),
          },
        ],
      ),
    );
  }
}

String bookableProblemLabel(AppLocalizations l, String key) => switch (key) {
  'verified' => l.blStatusIdCheck,
  'bolau_enabled' => l.blStatusPaused,
  'services' => l.blStepServices,
  'availability' => l.blStepAvailability,
  'suspended' => l.blSuspended,
  _ => key,
};

/// "Get booked by households" invitation for a worker without a Sipalu
/// profile.
class JoinBolauCard extends StatelessWidget {
  const JoinBolauCard({super.key});

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    return Column(
      key: const Key('join_bolau'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Center(child: EmptyStateArt(art: KsArt.electricianBoard)),
        const SizedBox(height: KsSpace.s4),
        Text(l.blJoinTitle, style: t.titleLarge, textAlign: TextAlign.center),
        const SizedBox(height: KsSpace.s2),
        Text(l.blJoinBody, style: t.bodyLarge, textAlign: TextAlign.center),
        const SizedBox(height: KsSpace.s4),
        FilledButton.icon(
          key: const Key('join_bolau_start'),
          onPressed: () => context.push(Routes.sipaluJoin),
          icon: const Icon(LucideIcons.userPlus),
          label: Text(l.blBecomeSipalu),
        ),
      ],
    );
  }
}

class _StatusCard extends ConsumerStatefulWidget {
  const _StatusCard({required this.profile});
  final MySipalu profile;

  @override
  ConsumerState<_StatusCard> createState() => _StatusCardState();
}

class _StatusCardState extends ConsumerState<_StatusCard> {
  bool? _enabled;
  bool? _instant;

  Future<void> _patch(String field, bool v) async {
    setState(() => field == 'bolau_enabled' ? _enabled = v : _instant = v);
    try {
      await ref.read(bolauRepositoryProvider).updateSipalu({field: v});
      ref.invalidate(mySipaluProvider);
    } catch (e) {
      if (!mounted) return;
      setState(() => field == 'bolau_enabled' ? _enabled = !v : _instant = !v);
      showSnack(context, errorText(context, e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final p = widget.profile;
    final enabled = _enabled ?? p.bolauEnabled;
    final unfinished = p.onboarding.nextStep != null;
    final (String text, Tone tone, IconData icon) = switch (p) {
      _ when p.suspended => (l.blSuspended, Tone.danger, LucideIcons.circleAlert),
      // A bookable Sipalu with optional gaps (e.g. no photo) still sees
      // "bookable" first; the meter below shows what is left.
      _ when unfinished && !p.isBookable => (
        l.blStatusFinishProfile(formatPercent(p.completeness / 100, lang)),
        Tone.warning,
        LucideIcons.listChecks,
      ),
      _ when !p.isVerified => (l.blStatusIdCheck, Tone.info, LucideIcons.hourglass),
      _ when !enabled => (l.blStatusPaused, Tone.neutral, LucideIcons.pause),
      _ when !p.isBookable => (
        l.blNotBookableWhy(p.bookableProblems.map((k) => bookableProblemLabel(l, k)).join(', ')),
        Tone.warning,
        LucideIcons.listChecks,
      ),
      _ => (l.blStatusBookable, Tone.success, LucideIcons.badgeCheck),
    };
    return SectionCard(
      key: const Key('bolau_status'),
      title: p.handle == null ? l.blYourBolau : 'kaamsathi.com/sipalu/${p.handle}',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Align(alignment: Alignment.centerLeft, child: StatusBadge(label: text, tone: tone, icon: icon)),
          if (unfinished) ...[
            const SizedBox(height: KsSpace.s2),
            FractionBar(label: l.blProfileComplete, value: p.completeness / 100),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                key: const Key('bolau_continue_profile'),
                onPressed: () => context.push(Routes.sipaluJoin),
                child: Text(l.blContinueProfile),
              ),
            ),
          ],
          SwitchListTile(
            key: const Key('bolau_enabled'),
            contentPadding: EdgeInsets.zero,
            value: enabled,
            onChanged: (v) => _patch('bolau_enabled', v),
            title: Text(l.blTakeBookings),
            subtitle: Text(p.isVerified ? l.blTakeBookingsHint : l.blTakeBookingsAfterId),
          ),
          SwitchListTile(
            key: const Key('bolau_instant'),
            contentPadding: EdgeInsets.zero,
            value: _instant ?? p.instantBooking,
            onChanged: (v) => _patch('instant_booking', v),
            title: Text(l.blInstant),
            subtitle: Text(l.blInstantHint),
          ),
          if (p.ratingCount > 0 || p.jobsCompleted > 0)
            Padding(
              padding: const EdgeInsets.only(bottom: KsSpace.s2),
              child: RatingLine(avg: p.ratingAvg, count: p.ratingCount, jobs: p.jobsCompleted),
            ),
          OutlinedButton.icon(
            key: const Key('bolau_edit_services'),
            onPressed: () => context.push(Routes.sipaluServices),
            icon: const Icon(LucideIcons.slidersHorizontal),
            label: Text(l.blServicesAndHours),
          ),
        ],
      ),
    );
  }
}

class _EarningsCard extends ConsumerWidget {
  const _EarningsCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final jobs = ref.watch(sipaluJobsProvider).value;
    if (jobs == null) return const SizedBox.shrink();
    final e = earningsFrom(jobs);
    return SectionCard(
      key: const Key('bolau_earnings'),
      title: l.blEarnings,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: _Fact(label: l.blThisMonth, value: formatMoney(e.thisMonthPaisa / 100, lang: lang))),
              Expanded(child: _Fact(label: l.blAllTime, value: formatMoney(e.totalPaisa / 100, lang: lang))),
              Expanded(child: _Fact(label: l.blPaidJobs, value: localizeDigits('${e.jobs}', lang))),
            ],
          ),
          const SizedBox(height: KsSpace.s2),
          Text(l.blEarningsNote, style: t.bodySmall?.copyWith(color: context.ks.textMuted)),
        ],
      ),
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          value,
          style: t.titleMedium?.copyWith(
            fontWeight: FontWeight.w700,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
        Text(label, style: t.bodySmall),
      ],
    );
  }
}

class _BookingsSection extends ConsumerStatefulWidget {
  const _BookingsSection();

  @override
  ConsumerState<_BookingsSection> createState() => _BookingsSectionState();
}

class _BookingsSectionState extends ConsumerState<_BookingsSection> {
  String? _busy;

  Future<void> _answer(Booking b, {required bool accept}) async {
    final l = context.l10n;
    String? reason;
    if (!accept) {
      reason = await showDeclineDialog(context, title: l.blDeclineTitle, body: l.blDeclineBody);
      if (reason == null) return;
    }
    if (!mounted) return;
    setState(() => _busy = b.id);
    try {
      await ref.read(bolauRepositoryProvider).sipaluAction(b.id, accept ? 'accept' : 'decline', {
        if (reason != null && reason.isNotEmpty) 'reason': reason,
      });
      ref.invalidate(sipaluJobsProvider);
      if (mounted) showSnack(context, accept ? l.blAccepted : l.blDeclined);
    } catch (e) {
      if (mounted) showSnack(context, errorText(context, e), error: true);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    return FeatureAsyncSection<List<Booking>>(
      value: ref.watch(sipaluJobsProvider),
      onRetry: () => ref.invalidate(sipaluJobsProvider),
      data: (jobs) {
        final incoming = jobs.where((b) => b.status == BookingStatus.requested).toList();
        final upcoming =
            jobs.where((b) => BookingStatus.active.contains(b.status)).toList()
              ..sort((a, b) => (a.scheduledStart ?? DateTime(3000)).compareTo(b.scheduledStart ?? DateTime(3000)));
        final past =
            jobs
                .where((b) => b.status != BookingStatus.requested && !BookingStatus.active.contains(b.status))
                .take(20)
                .toList();
        if (jobs.isEmpty) {
          return EmptyState(icon: LucideIcons.calendarClock, message: l.blNoBookingsYet, art: KsArt.plumberWrench);
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (incoming.isNotEmpty) ...[
              Text(l.blIncoming, style: t.titleMedium),
              const SizedBox(height: KsSpace.s2),
              for (final b in incoming) ...[
                JobCardFrame(
                  key: Key('incoming_${b.id}'),
                  onTap: () => context.push(Routes.sipaluJob(b.id)),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      SipaluBookingSummary(booking: b),
                      const SizedBox(height: KsSpace.s2),
                      CountdownText(deadline: b.answerWithin(ref.watch(bolauConfigValueProvider).acceptTimeoutMinutes)),
                      const SizedBox(height: KsSpace.s2),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton(
                              key: Key('decline_${b.id}'),
                              onPressed: _busy == null ? () => _answer(b, accept: false) : null,
                              child: Text(l.appsDecline),
                            ),
                          ),
                          const SizedBox(width: KsSpace.s2),
                          Expanded(
                            child: FilledButton(
                              key: Key('accept_${b.id}'),
                              onPressed: _busy == null ? () => _answer(b, accept: true) : null,
                              child: Text(l.blAccept),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: KsSpace.s3),
              ],
            ],
            if (upcoming.isNotEmpty) ...[
              Text(l.blUpcoming, style: t.titleMedium),
              const SizedBox(height: KsSpace.s2),
              for (final b in upcoming) _BookingRow(booking: b),
            ],
            if (past.isNotEmpty) ...[
              const SizedBox(height: KsSpace.s2),
              Text(l.blPast, style: t.titleMedium),
              const SizedBox(height: KsSpace.s2),
              for (final b in past) _BookingRow(booking: b),
            ],
          ],
        );
      },
    );
  }
}

/// What, when, where and for how much — the Sipalu's view of a booking
/// (area only until it is accepted).
class SipaluBookingSummary extends StatelessWidget {
  const SipaluBookingSummary({super.key, required this.booking});
  final Booking booking;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final b = booking;
    final title = b.serviceTitle ?? b.trade?.name(lang) ?? b.code;
    final area = b.area(lang);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [Expanded(child: Text(title, style: t.titleSmall)), BookingStatusBadge(status: b.status)]),
        if (b.scheduledStart != null)
          Text(whenText(b.scheduledStart, lang), style: t.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
        if (area != null) Text(area, style: t.bodyMedium?.copyWith(color: context.ks.textMuted)),
        const SizedBox(height: 2),
        Text(
          b.amount != null && !b.needsQuote
              ? formatMoney(b.amount, lang: lang)
              : priceText(l, lang, priceType: b.priceType, price: b.quotedPrice, visitFee: b.visitFee),
          style: t.titleMedium?.copyWith(
            fontWeight: FontWeight.w700,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
        if (b.description.isNotEmpty) ...[
          const SizedBox(height: 2),
          Text(b.description, maxLines: 2, overflow: TextOverflow.ellipsis, style: t.bodyMedium),
        ],
      ],
    );
  }
}

class _BookingRow extends StatelessWidget {
  const _BookingRow({required this.booking});
  final Booking booking;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: KsSpace.s3),
    child: Card(
      key: Key('job_${booking.id}'),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push(Routes.sipaluJob(booking.id)),
        child: Padding(padding: const EdgeInsets.all(KsSpace.s3), child: SipaluBookingSummary(booking: booking)),
      ),
    ),
  );
}

class _NearbySection extends ConsumerWidget {
  const _NearbySection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    return FeatureAsyncSection<List<KaamRequest>>(
      value: ref.watch(nearbyRequestsProvider),
      onRetry: () => ref.invalidate(nearbyRequestsProvider),
      data:
          (list) =>
              list.isEmpty
                  ? EmptyState(icon: LucideIcons.mapPinned, message: l.blNoNearby, art: KsArt.solarRoof)
                  : Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(l.blNearbyHint, style: t.bodyMedium),
                      const SizedBox(height: KsSpace.s2),
                      for (final r in list) ...[
                        JobCardFrame(
                          key: Key('nearby_${r.id}'),
                          onTap: () => context.push(Routes.sipaluRequest(r.id)),
                          child: KaamRequestSummary(request: r),
                        ),
                        const SizedBox(height: KsSpace.s3),
                      ],
                    ],
                  ),
    );
  }
}

/// Title, trade, area (ward/municipality only), window, budget, offers.
class KaamRequestSummary extends StatelessWidget {
  const KaamRequestSummary({super.key, required this.request});
  final KaamRequest request;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final r = request;
    final area = r.area(lang);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(r.title, style: t.titleSmall),
        if (area != null) Text(area, style: t.bodyMedium?.copyWith(color: context.ks.textMuted)),
        if (r.windowStart != null) Text(l.blPreferred(whenText(r.windowStart, lang)), style: t.bodyMedium),
        if (r.budgetMax != null)
          Text(
            l.blBudgetUpTo(formatMoney(r.budgetMax, lang: lang)),
            style: t.titleSmall?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
          ),
        const SizedBox(height: KsSpace.s1),
        Wrap(
          spacing: KsSpace.s2,
          runSpacing: KsSpace.s1,
          children: [
            if (r.trade != null) StatusBadge(label: r.trade!.name(lang), icon: LucideIcons.hardHat),
            StatusBadge(
              label: l.blOffersCount(
                localizeDigits('${r.offerCount}', lang),
                localizeDigits('$maxOffersPerRequest', lang),
              ),
              tone: r.isFull ? Tone.warning : Tone.neutral,
              icon: LucideIcons.messageSquareQuote,
            ),
            if (r.myOffer != null) StatusBadge(label: l.blYouOffered, tone: Tone.success, icon: LucideIcons.check),
          ],
        ),
      ],
    );
  }
}

String offerStatusLabel(AppLocalizations l, String s) => switch (s) {
  'accepted' => l.blOfferAccepted,
  'rejected' => l.blOfferNotChosen,
  'withdrawn' => l.blOfferWithdrawn,
  'expired' => l.blStatusExpired,
  _ => l.blOfferPending,
};

Tone offerStatusTone(String s) => switch (s) {
  'accepted' => Tone.success,
  'pending' => Tone.info,
  _ => Tone.neutral,
};

class _OffersSection extends ConsumerStatefulWidget {
  const _OffersSection();

  @override
  ConsumerState<_OffersSection> createState() => _OffersSectionState();
}

class _OffersSectionState extends ConsumerState<_OffersSection> {
  Future<void> _withdraw(BolauOffer o) async {
    final l = context.l10n;
    if (!await confirmDialog(context, title: l.blWithdrawOffer, confirmLabel: l.blWithdraw, danger: true)) return;
    try {
      await ref.read(bolauRepositoryProvider).withdrawOffer(o.id);
      ref.invalidate(myOffersProvider);
    } catch (e) {
      if (mounted) showSnack(context, errorText(context, e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    return FeatureAsyncSection<List<BolauOffer>>(
      value: ref.watch(myOffersProvider),
      onRetry: () => ref.invalidate(myOffersProvider),
      data:
          (list) =>
              list.isEmpty
                  ? EmptyState(icon: LucideIcons.messageSquareQuote, message: l.blNoOffersSent)
                  : Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      for (final o in list)
                        Card(
                          key: Key('my_offer_${o.id}'),
                          child: Padding(
                            padding: const EdgeInsets.all(KsSpace.s3),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(child: Text(o.requestTitle ?? l.blKaamRequest, style: t.titleSmall)),
                                    StatusBadge(label: offerStatusLabel(l, o.status), tone: offerStatusTone(o.status)),
                                  ],
                                ),
                                Text(
                                  priceText(l, lang, priceType: o.priceType, price: o.price, visitFee: o.visitFee),
                                  style: t.bodyLarge,
                                ),
                                if (o.proposedStart != null) Text(whenText(o.proposedStart, lang), style: t.bodyMedium),
                                if (o.status == 'pending')
                                  Align(
                                    alignment: Alignment.centerRight,
                                    child: TextButton(onPressed: () => _withdraw(o), child: Text(l.blWithdraw)),
                                  ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
    );
  }
}
