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
import '../money_data.dart';
import 'money_labels.dart';

/// Money hub: verified earnings, partner offers, applications, data sharing.
class MoneyScreen extends ConsumerWidget {
  const MoneyScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    Future<void> refresh() async {
      ref.invalidate(financialProfileProvider);
      ref.invalidate(offersProvider);
      ref.invalidate(partnersProvider);
      ref.invalidate(financeReferralsProvider);
      ref.invalidate(grantsProvider);
      ref.invalidate(partnerAccessProvider);
      try {
        await ref.read(financialProfileProvider.future);
      } catch (_) {}
    }

    Widget tab(Widget child) => RefreshIndicator(onRefresh: refresh, child: child);
    return DefaultTabController(
      length: 4,
      child: Scaffold(
        appBar: AppBar(
          title: Text(l.moneyTitle),
          bottom: TabBar(
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            tabs: [
              Tab(text: l.moneyTabEarnings),
              Tab(text: l.moneyTabOffers),
              Tab(text: l.moneyTabApplications),
              Tab(text: l.moneyTabSharing),
            ],
          ),
        ),
        body: TabBarView(
          children: [tab(const _Earnings()), tab(const _Offers()), tab(const _Applications()), tab(const _Sharing())],
        ),
      ),
    );
  }
}

class _NoLendBanner extends StatelessWidget {
  const _NoLendBanner();

  @override
  Widget build(BuildContext context) {
    final c = context.ks;
    return Container(
      margin: const EdgeInsets.only(bottom: KsSpace.s3),
      padding: const EdgeInsets.all(KsSpace.s3),
      decoration: BoxDecoration(color: c.infoSoft, borderRadius: BorderRadius.circular(KsRadius.dense)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(LucideIcons.info, color: c.infoText, size: 18),
          const SizedBox(width: KsSpace.s2),
          Expanded(
            child: Text(
              context.l10n.moneyNoLend,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: c.infoText),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------- earnings

class _Earnings extends ConsumerWidget {
  const _Earnings();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    return FeatureAsyncBody<Cached<FinancialProfile>>(
      value: ref.watch(financialProfileProvider),
      onRetry: () => ref.invalidate(financialProfileProvider),
      data: (cached) {
        final f = cached.data;
        Widget stat(String label, String value, {String? sub}) => Expanded(
          child: Padding(
            padding: const EdgeInsets.all(KsSpace.s3),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: t.bodySmall?.copyWith(color: context.ks.textMuted)),
                Text(value, style: t.titleLarge?.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
                if (sub != null) Text(sub, style: t.bodySmall),
              ],
            ),
          ),
        );
        return ListView(
          padding: const EdgeInsets.all(KsSpace.page),
          children: [
            if (cached.fromCache) const CachedNotice(),
            const _NoLendBanner(),
            if (f.isEmpty)
              EmptyState(icon: LucideIcons.wallet, message: l.finEmpty)
            else ...[
              Card(
                child: Column(
                  children: [
                    Row(
                      children: [
                        stat(l.finVerifiedMonths, formatNumber(f.verifiedMonths, lang: lang)),
                        stat(l.finAvgNet, formatMoney(f.avgMonthlyNet ?? '0', lang: lang)),
                      ],
                    ),
                    const Divider(height: 1),
                    Row(
                      children: [
                        stat(
                          l.finStability,
                          f.incomeStability == null ? '–' : formatPercent(f.incomeStability!, lang),
                          sub: f.incomeStability == null ? null : stabilityLabel(l, f.incomeStability!),
                        ),
                        stat(l.finEmployers, formatNumber(f.employersCount, lang: lang)),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: KsSpace.s3),
              if (f.minMonthlyNet != null && f.maxMonthlyNet != null)
                Text(
                  l.finRange(formatMoney(f.minMonthlyNet, lang: lang), formatMoney(f.maxMonthlyNet, lang: lang)),
                  style: t.bodyMedium,
                ),
              if (f.ssfMonths > 0) KeyValueRow(label: l.finSsfMonths, value: formatNumber(f.ssfMonths, lang: lang)),
              const SizedBox(height: KsSpace.s3),
              if (f.monthly.isNotEmpty) SectionCard(title: l.finMonthly, child: MonthlyBars(months: f.monthly)),
            ],
            const SizedBox(height: KsSpace.s3),
            Text(l.finHint, style: t.bodySmall),
          ],
        );
      },
    );
  }
}

/// Compact bar chart of net pay per BS month (last 12), paid vs pending.
class MonthlyBars extends StatelessWidget {
  const MonthlyBars({super.key, required this.months});
  final List<EarningMonth> months;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final c = context.ks;
    final t = Theme.of(context).textTheme;
    final shown = months.length > 12 ? months.sublist(months.length - 12) : months;
    final values = [for (final m in shown) (parsePaisa(m.net) ?? 0) / 100];
    final max = values.fold<double>(0, (a, b) => b > a ? b : a);
    const h = 120.0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          height: h + 36,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              for (var i = 0; i < shown.length; i++)
                Expanded(
                  child: Tooltip(
                    message:
                        '${formatBsMonthYear(shown[i].bsYear, shown[i].bsMonth, lang)}: ${formatMoney(shown[i].net, lang: lang)}',
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Container(
                          height: max <= 0 ? 2 : (values[i] / max * h).clamp(2, h),
                          margin: const EdgeInsets.symmetric(horizontal: 3),
                          decoration: BoxDecoration(
                            color: shown[i].paid ? c.successText : c.neutralText.withValues(alpha: 0.4),
                            borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          bsMonthName(shown[i].bsMonth, lang).characters.take(3).toString(),
                          style: t.labelSmall?.copyWith(fontSize: 10),
                          maxLines: 1,
                          overflow: TextOverflow.clip,
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: KsSpace.s2),
        Wrap(
          spacing: KsSpace.s4,
          children: [
            _Legend(color: c.successText, label: l.finPaid),
            if (shown.any((m) => !m.paid)) _Legend(color: c.neutralText.withValues(alpha: 0.4), label: l.finUnpaid),
          ],
        ),
      ],
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend({required this.color, required this.label});
  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(width: 10, height: 10, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(2))),
      const SizedBox(width: 4),
      Text(label, style: Theme.of(context).textTheme.bodySmall),
    ],
  );
}

// ------------------------------------------------------------------ offers

class _Offers extends ConsumerWidget {
  const _Offers();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final partners = ref.watch(partnersProvider).value ?? const <PartnerRef>[];
    return FeatureAsyncBody<List<Offer>>(
      value: ref.watch(offersProvider),
      onRetry: () => ref.invalidate(offersProvider),
      data:
          (offers) => ListView(
            padding: const EdgeInsets.all(KsSpace.page),
            children: [
              const _NoLendBanner(),
              if (offers.isEmpty) EmptyState(icon: LucideIcons.handCoins, message: l.offersEmpty),
              for (final o in offers)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(KsSpace.s4),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          children: [
                            Expanded(child: Text(o.displayTitle(lang), style: t.titleSmall)),
                            StatusBadge(
                              label: o.eligible ? l.offerEligible : l.offerNotEligible,
                              tone: o.eligible ? Tone.success : Tone.neutral,
                              icon: o.eligible ? LucideIcons.circleCheck : null,
                            ),
                          ],
                        ),
                        Text(offerKindLabel(l, o.kind), style: t.bodySmall),
                        const SizedBox(height: KsSpace.s1),
                        Text(offeredBy(l, o.partner), style: t.bodyMedium),
                        if (o.displayDescription(lang)?.isNotEmpty ?? false) ...[
                          const SizedBox(height: KsSpace.s2),
                          Text(o.displayDescription(lang)!, style: t.bodyMedium),
                        ],
                        if (o.maxAmount != null)
                          Text(l.offerUpTo(formatMoney(o.maxAmount, lang: lang)), style: t.bodySmall),
                        if (o.interestNote?.isNotEmpty ?? false)
                          Text(l.offerTerms(o.interestNote!), style: t.bodySmall),
                        if (!o.eligible) ...[
                          const SizedBox(height: KsSpace.s2),
                          for (final r in o.reasons) Text('• $r', style: t.bodySmall),
                          if (o.reasons.isEmpty && o.minVerifiedMonths > 0)
                            Text(l.offerMinMonths(localizeDigits('${o.minVerifiedMonths}', lang)), style: t.bodySmall),
                          if (o.reasons.isEmpty && o.minAvgNet != null)
                            Text(l.offerMinAvg(formatMoney(o.minAvgNet, lang: lang)), style: t.bodySmall),
                        ],
                        const SizedBox(height: KsSpace.s3),
                        if (o.alreadyApplied)
                          Align(
                            alignment: Alignment.centerLeft,
                            child: StatusBadge(
                              label: l.trainAlreadyApplied,
                              tone: Tone.success,
                              icon: LucideIcons.check,
                            ),
                          )
                        else
                          FilledButton(
                            onPressed: o.eligible ? () => context.push(Routes.workerOfferApply(o.id)) : null,
                            child: Text(l.offerApply),
                          ),
                      ],
                    ),
                  ),
                ),
              if (partners.isNotEmpty) ...[
                GroupLabel(l.partnersTitle),
                Card(
                  child: Column(
                    children: [
                      for (final p in partners)
                        ListTile(
                          leading: const Icon(LucideIcons.landmark),
                          title: Text(p.name),
                          subtitle: Text(
                            [partnerKindLabel(l, p.kind), regulatorLabel(l, p)].where((s) => s.isNotEmpty).join(' · '),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ],
          ),
    );
  }
}

// ------------------------------------------------------------ applications

class _Applications extends ConsumerWidget {
  const _Applications();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    return FeatureAsyncBody<List<FinanceReferral>>(
      value: ref.watch(financeReferralsProvider),
      onRetry: () => ref.invalidate(financeReferralsProvider),
      data:
          (items) => ListView(
            padding: const EdgeInsets.all(KsSpace.page),
            children: [
              if (items.isEmpty) EmptyState(icon: LucideIcons.fileText, message: l.refsEmpty),
              for (final r in items)
                Card(
                  child: ListTile(
                    title: Text(r.offerTitle ?? r.partner.name),
                    subtitle: Text(
                      [
                        offeredBy(l, r.partner),
                        if (r.amountRequested != null) l.refAmountRequested(formatMoney(r.amountRequested, lang: lang)),
                        if (r.amountApproved != null) l.refAmountApproved(formatMoney(r.amountApproved, lang: lang)),
                        if (r.createdAt != null) formatBsDateTime(r.createdAt, lang),
                      ].join('\n'),
                      style: t.bodySmall,
                    ),
                    isThreeLine: true,
                    trailing: Builder(
                      builder: (_) {
                        final (label, tone) = financeReferralStatus(l, r.status);
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

// ----------------------------------------------------------------- sharing

class _Sharing extends ConsumerWidget {
  const _Sharing();

  Future<void> _revoke(BuildContext context, WidgetRef ref, ConsentGrant g) async {
    final l = context.l10n;
    final ok = await confirmDialog(
      context,
      title: l.grantRevokeConfirm(g.partner.name),
      confirmLabel: l.ecoRevoke,
      danger: true,
    );
    if (!ok) return;
    try {
      await ref.read(moneyRepositoryProvider).revokeGrant(g.id);
      ref.invalidate(grantsProvider);
      if (context.mounted) showSnack(context, l.grantRevokedMsg);
    } catch (e) {
      if (context.mounted) showSnack(context, errorText(context, e), error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final access = ref.watch(partnerAccessProvider);
    return FeatureAsyncBody<List<ConsentGrant>>(
      value: ref.watch(grantsProvider),
      onRetry: () => ref.invalidate(grantsProvider),
      data:
          (grants) => ListView(
            padding: const EdgeInsets.all(KsSpace.page),
            children: [
              GroupLabel(l.grantsTitle),
              if (grants.isEmpty) Text(l.grantsEmpty, style: t.bodyMedium),
              for (final g in grants)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(KsSpace.s4),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          children: [
                            Expanded(child: Text(g.partner.name, style: t.titleSmall)),
                            StatusBadge(
                              label:
                                  g.isRevoked
                                      ? l.grantRevoked
                                      : g.isExpired()
                                      ? l.grantExpired
                                      : l.grantActive,
                              tone: g.isActive() ? Tone.success : Tone.neutral,
                            ),
                          ],
                        ),
                        Text(grantPurposeLabel(l, g.purpose), style: t.bodyMedium),
                        if (g.scopes.isNotEmpty)
                          Text(g.scopes.map((s) => scopeShortLabel(l, s)).join(' · '), style: t.bodySmall),
                        if (g.isActive() && g.expiresAt != null)
                          Text(l.ecoUntil(formatBsDateTime(g.expiresAt, lang)), style: t.bodySmall),
                        if (g.isActive())
                          Align(
                            alignment: Alignment.centerRight,
                            child: TextButton.icon(
                              style: destructiveTextStyle(context),
                              onPressed: () => _revoke(context, ref, g),
                              icon: const Icon(LucideIcons.ban, size: 18),
                              label: Text(l.ecoRevoke),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              GroupLabel(l.accessLog),
              switch (access) {
                AsyncData(:final value) when value.isEmpty => Text(l.accessEmpty, style: t.bodyMedium),
                AsyncData(:final value) => Card(
                  child: Column(
                    children: [
                      for (final a in value)
                        ListTile(
                          dense: true,
                          leading: const Icon(LucideIcons.eye, size: 20),
                          title: Text(a.partner.name),
                          subtitle: Text(scopeShortLabel(l, a.scope)),
                          trailing: Text(
                            a.createdAt == null
                                ? ''
                                : '${formatBsDateTime(a.createdAt, lang)}\n${formatTime(a.createdAt!, lang)}',
                            textAlign: TextAlign.right,
                            style: t.bodySmall,
                          ),
                        ),
                    ],
                  ),
                ),
                AsyncError(:final error) =>
                  isFeatureUnavailable(error)
                      ? Text(l.accessEmpty, style: t.bodyMedium)
                      : Text(errorText(context, error)),
                _ => const LinearProgressIndicator(),
              },
            ],
          ),
    );
  }
}
