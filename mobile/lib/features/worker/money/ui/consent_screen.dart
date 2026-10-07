import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/api/api_exception.dart';
import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/digit_formatter.dart';
import '../money_data.dart';
import 'money_labels.dart';

/// Values the worker enters on the consent screen.
typedef ApplyRequest = ({String? amount, String? note, int days});

/// Route wrapper: loads the offer, then shows the explicit consent screen.
class OfferApplyScreen extends ConsumerWidget {
  const OfferApplyScreen({super.key, required this.offerId});
  final String offerId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final value = ref.watch(offerProvider(offerId));
    return Scaffold(
      appBar: AppBar(title: Text(l.consentTitle)),
      body: AsyncBody<Offer?>(
        value: value,
        onRetry: () => ref.invalidate(offersProvider),
        data:
            (offer) =>
                offer == null
                    ? EmptyState(icon: LucideIcons.searchX, message: l.commonNotFound)
                    : ConsentView(
                      offer: offer,
                      onSubmit: (r) async {
                        await ref
                            .read(moneyRepositoryProvider)
                            .apply(offer.id, amountRequested: r.amount, purposeNote: r.note, days: r.days);
                        ref.invalidate(financeReferralsProvider);
                        ref.invalidate(grantsProvider);
                        if (!context.mounted) return;
                        showSnack(context, l.offerApplied(offer.partner.name));
                        context.pop();
                      },
                    ),
      ),
    );
  }
}

/// The explicit consent screen: partner + regulator, purpose, exact scopes in
/// plain language, duration, revoke-anytime and "KaamSathi does not lend".
/// Apply stays disabled until the worker ticks the agreement.
class ConsentView extends StatefulWidget {
  const ConsentView({super.key, required this.offer, required this.onSubmit, this.today});

  final Offer offer;
  final Future<void> Function(ApplyRequest request) onSubmit;

  /// For tests (expiry date shown).
  final DateTime? today;

  @override
  State<ConsentView> createState() => _ConsentViewState();
}

class _ConsentViewState extends State<ConsentView> {
  static const _dayChoices = [30, 90];
  int _days = 30;
  bool _agree = false;
  bool _busy = false;
  final _amount = TextEditingController();
  final _note = TextEditingController();

  @override
  void dispose() {
    _amount.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _busy = true);
    try {
      await widget.onSubmit((
        amount: _amount.text.trim().isEmpty ? null : _amount.text.trim(),
        note: _note.text,
        days: _days,
      ));
    } on ApiException catch (e) {
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
    final c = context.statusColors;
    final o = widget.offer;
    final p = o.partner;
    final reg = regulatorLabel(l, p);
    final until = (widget.today ?? nepalToday()).add(Duration(days: _days));

    Widget section(IconData icon, String title, Widget body) => Padding(
      padding: const EdgeInsets.only(bottom: KsSpace.s4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: Theme.of(context).colorScheme.primary),
          const SizedBox(width: KsSpace.s3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: t.labelLarge?.copyWith(color: c.textSecondary)),
                const SizedBox(height: 2),
                body,
              ],
            ),
          ),
        ],
      ),
    );

    return ListView(
      padding: const EdgeInsets.all(KsSpace.page),
      children: [
        Text(o.displayTitle(lang), style: t.titleLarge),
        Text(offerKindLabel(l, o.kind), style: t.bodyMedium),
        const SizedBox(height: KsSpace.s3),
        Text(l.consentIntro(p.name), style: t.bodyLarge),
        const SizedBox(height: KsSpace.s4),
        Card(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(KsSpace.s4, KsSpace.s4, KsSpace.s4, 0),
            child: Column(
              children: [
                section(
                  LucideIcons.landmark,
                  l.consentPartner,
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(p.name, style: t.titleSmall),
                      Text(offeredBy(l, p), style: t.bodySmall),
                      if (reg.isEmpty && p.kind != null) Text(partnerKindLabel(l, p.kind), style: t.bodySmall),
                    ],
                  ),
                ),
                section(
                  LucideIcons.target,
                  l.consentPurpose,
                  Text(grantPurposeLabel(l, o.grantPurpose), style: t.bodyMedium),
                ),
                section(
                  LucideIcons.eye,
                  l.consentScopes,
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (final s in Offer.applyScopes)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 2),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Icon(LucideIcons.check, size: 16, color: c.successFg),
                              const SizedBox(width: 6),
                              Expanded(child: Text(scopeLabel(l, s), style: t.bodyMedium)),
                            ],
                          ),
                        ),
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 2),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(LucideIcons.x, size: 16, color: c.dangerFg),
                            const SizedBox(width: 6),
                            Expanded(child: Text(l.consentNotShared, style: t.bodyMedium)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                section(
                  LucideIcons.calendarClock,
                  l.consentDuration,
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        spacing: KsSpace.s2,
                        children: [
                          for (final d in _dayChoices)
                            ChoiceChip(
                              label: Text(l.ecoDays(localizeDigits('$d', lang))),
                              selected: _days == d,
                              onSelected: (_) => setState(() => _days = d),
                            ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        l.consentDurationUntil(
                          localizeDigits('$_days', lang),
                          formatBsDate(BsDate.fromAd(until), lang),
                        ),
                        style: t.bodySmall,
                      ),
                    ],
                  ),
                ),
                section(LucideIcons.undo2, l.ecoRevoke, Text(l.consentRevoke, style: t.bodyMedium)),
              ],
            ),
          ),
        ),
        const SizedBox(height: KsSpace.s3),
        Container(
          key: const Key('consent_no_lend'),
          padding: const EdgeInsets.all(KsSpace.s3),
          decoration: BoxDecoration(color: c.infoBg, borderRadius: BorderRadius.circular(KsRadius.md)),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(LucideIcons.info, color: c.infoFg, size: 20),
              const SizedBox(width: KsSpace.s2),
              Expanded(child: Text(l.consentNoLend(p.name), style: t.bodyMedium?.copyWith(color: c.infoFg))),
            ],
          ),
        ),
        if (o.interestNote?.isNotEmpty ?? false) ...[
          const SizedBox(height: KsSpace.s3),
          Text(l.offerTerms(o.interestNote!), style: t.bodySmall),
        ],
        const SizedBox(height: KsSpace.s4),
        if (o.kind != 'insurance')
          TextField(
            controller: _amount,
            keyboardType: TextInputType.number,
            inputFormatters: const [DigitsFormatter(9)],
            decoration: InputDecoration(
              labelText: l.ecoOptional(l.consentAmount),
              prefixText: lang == 'ne' ? 'रु. ' : 'Rs. ',
              helperText: o.maxAmount == null ? null : l.offerUpTo(formatMoney(o.maxAmount, lang: lang)),
            ),
          ),
        const SizedBox(height: KsSpace.s3),
        TextField(
          controller: _note,
          maxLength: 200,
          decoration: InputDecoration(labelText: l.ecoOptional(l.consentNote)),
        ),
        CheckboxListTile(
          key: const Key('consent_agree'),
          contentPadding: EdgeInsets.zero,
          controlAffinity: ListTileControlAffinity.leading,
          value: _agree,
          onChanged: (v) => setState(() => _agree = v ?? false),
          title: Text(l.consentAgree(p.name)),
        ),
        const SizedBox(height: KsSpace.s3),
        FilledButton(
          key: const Key('consent_apply'),
          onPressed: _agree && !_busy ? _submit : null,
          child:
              _busy
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : Text(l.consentApply),
        ),
        const SizedBox(height: KsSpace.s6),
      ],
    );
  }
}
