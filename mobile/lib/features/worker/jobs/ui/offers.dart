import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/eco.dart';
import '../jobs_data.dart';
import 'jobs_screen.dart' show showDeclineDialog;

String contractTypeLabel(AppLocalizations l, JobOffer o) {
  final t = o.contractType;
  final local = switch (t) {
    'permanent' || 'regular' => l.offerContractPermanent,
    'fixed_term' || 'contract' => l.offerContractFixedTerm,
    'daily' || 'daily_wage' => l.offerContractDaily,
    'part_time' => l.offerContractPartTime,
    'probation' => l.offerContractProbation,
    'seasonal' => l.offerContractSeasonal,
    _ => null,
  };
  return local ?? o.contractTypeLabel ?? t ?? '';
}

(String, Tone) offerStatus(AppLocalizations l, JobOffer o) {
  if (o.isExpired()) return (l.offerExpired, Tone.neutral);
  return switch (o.status) {
    'accepted' => (l.offerStatusAccepted, Tone.success),
    'declined' => (l.offerStatusDeclined, Tone.neutral),
    'withdrawn' => (l.offerStatusWithdrawn, Tone.neutral),
    _ => (l.offerStatusPending, Tone.warning),
  };
}

/// "Answer within 3 days" / "… 5 hours"; null when no deadline is known.
String? offerCountdown(AppLocalizations l, JobOffer o, String lang, [DateTime? now]) {
  final left = o.timeLeft(now);
  if (left == null) return null;
  if (left.inHours >= 48) return l.offerExpiresInDays(localizeDigits('${left.inDays}', lang));
  final h = left.inHours < 1 ? 1 : left.inHours;
  return l.offerExpiresInHours(localizeDigits('$h', lang));
}

/// Label/value pairs of an offer in [l]'s language (summary before accepting).
List<(String, String)> offerSummaryLines(AppLocalizations l, JobOffer o, String lang) {
  String m(String? v) => formatMoney(v ?? '0', lang: lang);
  return [
    (l.offerEmployer, o.organizationName),
    if ((o.designation ?? o.title)?.isNotEmpty ?? false) (l.empDesignation, (o.designation ?? o.title)!),
    if (o.siteName != null || o.district != null)
      (l.workSite, [if (o.siteName != null) o.siteName!, if (o.district != null) o.district!.name(lang)].join(', ')),
    if (o.isDaily)
      (l.termDailyWage, m(o.dailyWage))
    else ...[
      if (o.basicSalary != null) (l.termBasicSalary, m(o.basicSalary)),
      if (o.dearnessAllowance != null) (l.termDearnessAllowance, m(o.dearnessAllowance)),
      if (o.otherAllowance != null && (parsePaisa(o.otherAllowance) ?? 0) > 0) (l.termAllowance, m(o.otherAllowance)),
      if (o.monthlyGross != null) (l.termMonthlySalary, m(o.monthlyGross)),
    ],
    if (o.startDate != null) (l.offerStart, formatBsOrAd(o.startDateBs, o.startDate, lang)),
    if (o.contractType != null) (l.offerContractType, contractTypeLabel(l, o)),
    if (o.endsOn != null) (l.empEndDate, formatBsOrAd(o.endsOnBs, o.endsOn, lang)),
    if (o.expiresAt != null) (l.offerAnswerByLabel, formatBsDateTime(o.expiresAt, lang)),
  ];
}

class OffersTab extends ConsumerWidget {
  const OffersTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final value = ref.watch(jobOffersProvider);
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(jobOffersProvider);
        try {
          await ref.read(jobOffersProvider.future);
        } catch (_) {}
      },
      child: FeatureAsyncBody<List<JobOffer>>(
        value: value,
        onRetry: () => ref.invalidate(jobOffersProvider),
        data:
            (offers) => ListView(
              padding: const EdgeInsets.all(KsSpace.page),
              children: [
                if (offers.isEmpty) EmptyState(icon: LucideIcons.mailOpen, message: l.offersEmpty),
                for (final o in offers)
                  Card(
                    key: Key('offer_${o.id}'),
                    child: Padding(
                      padding: const EdgeInsets.all(KsSpace.s4),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(o.designation ?? o.title ?? '', style: t.titleSmall),
                          Text(o.organizationName, style: t.bodyMedium),
                          if (o.employerVerified) ...[
                            const SizedBox(height: KsSpace.s1),
                            const Align(alignment: Alignment.centerLeft, child: EmployerVerifiedBadge()),
                          ],
                          const SizedBox(height: KsSpace.s2),
                          for (final (k, v) in offerSummaryLines(l, o, lang).skip(1)) KeyValueRow(label: k, value: v),
                          const SizedBox(height: KsSpace.s2),
                          Wrap(
                            spacing: KsSpace.s2,
                            runSpacing: KsSpace.s1,
                            children: [
                              Builder(
                                builder: (_) {
                                  final (label, tone) = offerStatus(l, o);
                                  return StatusBadge(label: label, tone: tone);
                                },
                              ),
                              if (o.canAnswer() && offerCountdown(l, o, lang) != null)
                                StatusBadge(
                                  key: Key('offer_countdown_${o.id}'),
                                  label: offerCountdown(l, o, lang)!,
                                  tone: Tone.warning,
                                  icon: LucideIcons.timer,
                                ),
                            ],
                          ),
                          if (o.canAnswer()) ...[
                            const SizedBox(height: KsSpace.s3),
                            FilledButton(
                              key: Key('offer_review_${o.id}'),
                              onPressed:
                                  () => Navigator.of(
                                    context,
                                  ).push(MaterialPageRoute<void>(builder: (_) => OfferAcceptScreen(offer: o))),
                              child: Text(l.offerReview),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
              ],
            ),
      ),
    );
  }
}

/// Bilingual summary of an offer, a "no fees" reminder, an explicit
/// agreement tick, then accept — or decline with an optional reason.
class OfferAcceptScreen extends ConsumerStatefulWidget {
  const OfferAcceptScreen({super.key, required this.offer});
  final JobOffer offer;

  @override
  ConsumerState<OfferAcceptScreen> createState() => _OfferAcceptScreenState();
}

class _OfferAcceptScreenState extends ConsumerState<OfferAcceptScreen> {
  String? _lang;
  bool _agree = false;
  bool _busy = false;

  Future<void> _accept() async {
    final l = context.l10n;
    setState(() => _busy = true);
    try {
      await ref.read(offersRepositoryProvider).accept(widget.offer.id);
      ref.invalidate(jobOffersProvider);
      ref.invalidate(myApplicationsProvider);
      if (!mounted) return;
      showSnack(context, l.offerAccepted);
      Navigator.of(context).pop();
    } catch (e) {
      if (mounted) showSnack(context, errorText(context, e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _decline() async {
    final l = context.l10n;
    final reason = await showDeclineDialog(context, title: l.offerDeclineTitle, body: l.offerDeclineBody);
    if (reason == null || !mounted) return;
    setState(() => _busy = true);
    try {
      await ref.read(offersRepositoryProvider).decline(widget.offer.id, reason: reason);
      ref.invalidate(jobOffersProvider);
      if (!mounted) return;
      showSnack(context, l.appsDeclined);
      Navigator.of(context).pop();
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
    final lang = _lang ?? context.lang;
    final ll = lookupAppLocalizations(Locale(lang));
    final o = widget.offer;
    final countdown = offerCountdown(ll, o, lang);
    return Scaffold(
      appBar: AppBar(title: Text(l.offerSummaryTitle)),
      body: ListView(
        padding: const EdgeInsets.all(KsSpace.page),
        children: [
          Text(l.contractReadIn, style: t.bodyMedium),
          const SizedBox(height: KsSpace.s1),
          SegmentedButton<String>(
            key: const Key('offer_lang'),
            segments: [
              ButtonSegment(value: 'ne', label: Text(l.languageNepali)),
              ButtonSegment(value: 'en', label: Text(l.languageEnglish)),
            ],
            selected: {lang},
            onSelectionChanged: (s) => setState(() => _lang = s.first),
          ),
          const SizedBox(height: KsSpace.s3),
          SectionCard(
            title: ll.offerSummaryTitle,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(ll.offerSummaryIntro, style: t.bodyMedium),
                const SizedBox(height: KsSpace.s2),
                if (o.employerVerified) const Align(alignment: Alignment.centerLeft, child: EmployerVerifiedBadge()),
                for (final (k, v) in offerSummaryLines(ll, o, lang)) KeyValueRow(label: k, value: v),
                if (o.note?.isNotEmpty ?? false) ...[
                  const SizedBox(height: KsSpace.s2),
                  Text(o.note!, style: t.bodyMedium),
                ],
                if (countdown != null) ...[
                  const SizedBox(height: KsSpace.s2),
                  StatusBadge(label: countdown, tone: Tone.warning, icon: LucideIcons.timer),
                ],
              ],
            ),
          ),
          const SizedBox(height: KsSpace.s3),
          InfoNote(text: ll.offerNoFee, icon: LucideIcons.shieldCheck),
          const SizedBox(height: KsSpace.s3),
          CheckboxListTile(
            key: const Key('offer_agree'),
            contentPadding: EdgeInsets.zero,
            controlAffinity: ListTileControlAffinity.leading,
            value: _agree,
            onChanged: (v) => setState(() => _agree = v ?? false),
            title: Text(ll.offerAgree),
          ),
          const SizedBox(height: KsSpace.s3),
          FilledButton(
            key: const Key('offer_accept'),
            onPressed: _agree && !_busy && o.canAnswer() ? _accept : null,
            child: Text(l.offerAccept),
          ),
          const SizedBox(height: KsSpace.s2),
          OutlinedButton(
            key: const Key('offer_decline'),
            onPressed: _busy || !o.canAnswer() ? null : _decline,
            child: Text(l.offerDecline),
          ),
        ],
      ),
    );
  }
}
