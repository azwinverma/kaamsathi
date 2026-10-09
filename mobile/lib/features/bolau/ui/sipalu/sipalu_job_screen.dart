import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/api/api_exception.dart';
import '../../../../core/api/json.dart';
import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/eco.dart';
import '../../../worker/jobs/ui/jobs_screen.dart' show showDeclineDialog;
import '../../bolau_logic.dart';
import '../../bolau_models.dart';
import '../../bolau_repository.dart';
import '../bolau_widgets.dart';
import 'bolau_tab.dart' show SipaluBookingSummary;

/// A booking from the Sipalu's side: accept → on the way → arrival code →
/// (quote) → start → complete → paid → rate.
class SipaluJobScreen extends ConsumerStatefulWidget {
  const SipaluJobScreen({super.key, required this.id});
  final String id;

  @override
  ConsumerState<SipaluJobScreen> createState() => _SipaluJobScreenState();
}

class _SipaluJobScreenState extends ConsumerState<SipaluJobScreen> {
  bool _busy = false;
  String? _codeError;

  Future<void> _run(Future<void> Function() fn, {String? done}) async {
    setState(() => _busy = true);
    try {
      await fn();
      ref.invalidate(bookingProvider(widget.id));
      ref.invalidate(sipaluJobsProvider);
      if (mounted && done != null) showSnack(context, done);
    } catch (e) {
      if (mounted) showSnack(context, errorText(context, e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _act(String action, [Json body = const {}, String? done]) =>
      _run(() => ref.read(bolauRepositoryProvider).sipaluAction(widget.id, action, body), done: done);

  Future<void> _arrive(String code) async {
    final l = context.l10n;
    setState(() {
      _busy = true;
      _codeError = null;
    });
    try {
      await ref.read(bolauRepositoryProvider).sipaluAction(widget.id, 'arrive', {'code': code});
      ref.invalidate(bookingProvider(widget.id));
      ref.invalidate(sipaluJobsProvider);
      if (mounted) showSnack(context, l.blArrivedSaved);
    } on ApiException catch (e) {
      if (!mounted) return;
      final left = intOf(e.fields['attempts_left']?.firstOrNull ?? e.fields['remaining']?.firstOrNull);
      setState(
        () =>
            _codeError =
                e.code == 'arrival_code_locked' || left == 0
                    ? l.blCodeLocked
                    : (e.code.contains('code') || e.statusCode == 400)
                    ? (left == null ? l.blCodeWrong : l.blCodeWrongLeft(localizeDigits('$left', context.lang)))
                    : errorText(context, e),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _handle(BookingAction a, Booking b) async {
    final l = context.l10n;
    switch (a) {
      case BookingAction.accept:
        await _act('accept', const {}, l.blAccepted);
      case BookingAction.decline:
        final reason = await showDeclineDialog(context, title: l.blDeclineTitle, body: l.blDeclineBody);
        if (reason != null) await _act('decline', {if (reason.isNotEmpty) 'reason': reason}, l.blDeclined);
      case BookingAction.onTheWay:
        await _act('on-the-way', const {}, l.blOnTheWaySaved);
      case BookingAction.sendQuote:
        final price = await showPriceSheet(context, title: l.blSendQuote, hint: l.blSendQuoteHint);
        if (price != null) await _act('quote', {'amount': price}, l.blQuoteSent);
      case BookingAction.start:
        await _act('start', const {}, l.blStartedSaved);
      case BookingAction.complete:
        final price = await showPriceSheet(
          context,
          title: l.blFinalPrice,
          hint: l.blFinalPriceHint,
          initial: b.amount,
          max: b.isVisitThenQuote || b.priceType == PriceType.hourly ? null : b.quotedPrice,
        );
        if (price != null) await _act('complete', {'final_price': price}, l.blCompletedSaved);
      case BookingAction.markPaid:
        final method = await showPaidSheet(context);
        if (method != null) {
          await _run(
            () => ref.read(bolauRepositoryProvider).bookingAction(widget.id, 'paid', {'method': method}),
            done: l.blPaidSaved,
          );
        }
      case BookingAction.rate:
        final ok = await showBolauRateSheet(context, booking: b, side: BookingSide.sipalu);
        if (ok == true) ref.invalidate(bookingProvider(widget.id));
      case BookingAction.cancel:
        final reason = await showDeclineDialog(context, title: l.blCancelJobTitle, body: l.blCancelJobBody);
        if (reason != null) await _act('cancel', {'reason': reason}, l.blCancelled);
      default:
        break;
    }
  }

  String _label(AppLocalizations l, BookingAction a) => switch (a) {
    BookingAction.accept => l.blAccept,
    BookingAction.decline => l.appsDecline,
    BookingAction.onTheWay => l.blImOnTheWay,
    BookingAction.sendQuote => l.blSendQuote,
    BookingAction.start => l.blStartWork,
    BookingAction.complete => l.blWorkDone,
    BookingAction.markPaid => l.blMarkPaid,
    BookingAction.rate => l.blRateGhardhani,
    BookingAction.cancel => l.blCancelJob,
    _ => '',
  };

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final value = ref.watch(bookingProvider(widget.id));
    return Scaffold(
      appBar: AppBar(title: Text(value.value?.code ?? l.blBooking)),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(bookingProvider(widget.id));
          try {
            await ref.read(bookingProvider(widget.id).future);
          } catch (_) {}
        },
        child: FeatureAsyncBody<Booking>(
          value: value,
          onRetry: () => ref.invalidate(bookingProvider(widget.id)),
          data: _body,
        ),
      ),
    );
  }

  Widget _body(Booking b) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final actions = bookingActions(b, BookingSide.sipalu);
    final buttons = actions.where((a) => a != BookingAction.callOther && a != BookingAction.reportProblem).toList();
    final g = b.ghardhani;
    return ListView(
      padding: const EdgeInsets.all(KsSpace.page),
      children: [
        SipaluBookingSummary(booking: b),
        if (b.status == BookingStatus.requested) ...[
          const SizedBox(height: KsSpace.s2),
          CountdownText(deadline: b.answerBy),
        ],
        if (g != null && g.name.isNotEmpty) ...[
          const SizedBox(height: KsSpace.s2),
          Row(
            children: [
              const Icon(LucideIcons.house, size: 18),
              const SizedBox(width: KsSpace.s2),
              Expanded(child: Text(l.blForGhardhani(g.name), style: t.bodyLarge)),
            ],
          ),
        ],
        const SizedBox(height: KsSpace.s4),
        SectionCard(title: l.blProgress, child: BookingTimeline(booking: b)),
        const SizedBox(height: KsSpace.s3),
        SectionCard(title: l.blContact, child: ContactReveal(booking: b, side: BookingSide.sipalu)),
        const SizedBox(height: KsSpace.s3),
        if (b.awaitingQuoteApproval) ...[
          InfoNote(
            key: const Key('quote_waiting'),
            icon: LucideIcons.hourglass,
            text: l.blQuoteWaiting(formatMoney(b.quoteAmount, lang: lang)),
          ),
          const SizedBox(height: KsSpace.s3),
        ],
        if (b.isVisitThenQuote && b.quoteStatus == 'rejected' && b.status == BookingStatus.arrived) ...[
          InfoNote(
            key: const Key('quote_rejected'),
            tone: Tone.warning,
            icon: LucideIcons.circleAlert,
            text: l.blQuoteWasRejected,
          ),
          const SizedBox(height: KsSpace.s3),
        ],
        if (actions.contains(BookingAction.enterArrivalCode)) ...[
          SectionCard(child: ArrivalCodeEntry(onSubmit: _arrive, busy: _busy, error: _codeError)),
          const SizedBox(height: KsSpace.s3),
        ],
        for (final (i, a) in buttons.indexed) ...[
          if (i == 0 && a != BookingAction.decline)
            FilledButton(
              key: Key('action_${a.name}'),
              onPressed: _busy ? null : () => _handle(a, b),
              child: Text(_label(l, a)),
            )
          else
            OutlinedButton(
              key: Key('action_${a.name}'),
              onPressed: _busy ? null : () => _handle(a, b),
              child: Text(_label(l, a)),
            ),
          const SizedBox(height: KsSpace.s2),
        ],
        if (b.isPaid)
          InfoNote(
            tone: Tone.success,
            icon: LucideIcons.circleCheck,
            text: l.blPaidVia(paymentMethodLabel(l, b.paymentMethod)),
          ),
        if (b.description.isNotEmpty) ...[
          const SizedBox(height: KsSpace.s3),
          SectionCard(title: l.blWhatsNeeded, child: Text(b.description, style: t.bodyLarge)),
        ],
        const SizedBox(height: KsSpace.s4),
        BolauSafetyCard(booking: b),
      ],
    );
  }
}
