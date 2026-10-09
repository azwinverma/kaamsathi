import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/api/api_exception.dart';
import '../../../../core/api/cached.dart' show isFeatureUnavailable;
import '../../../../core/api/json.dart';
import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/router/router.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/eco.dart';
import '../../../../core/widgets/signature/signature.dart';
import '../../../common/inbox/inbox_screen.dart';
import '../../../worker/jobs/ui/jobs_screen.dart' show showDeclineDialog;
import '../../bolau_logic.dart';
import '../../bolau_models.dart';
import '../../bolau_repository.dart';
import '../bolau_widgets.dart';
import 'ghar_home_screen.dart' show GharBookingCard;

/// Ghardhani → Bookings tab: active first, then earlier ones.
class GharBookingsScreen extends ConsumerWidget {
  const GharBookingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final value = ref.watch(ghardhaniBookingsProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.blMyBookings), actions: const [InboxBell()]),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(ghardhaniBookingsProvider);
          try {
            await ref.read(ghardhaniBookingsProvider.future);
          } catch (_) {}
        },
        child: FeatureAsyncBody<List<Booking>>(
          value: value,
          onRetry: () => ref.invalidate(ghardhaniBookingsProvider),
          data: (list) {
            if (list.isEmpty) {
              return ListView(
                children: [
                  EmptyState(
                    icon: LucideIcons.calendarCheck,
                    message: l.blNoBookingsGhar,
                    art: KsArt.electricianBoard,
                    action: FilledButton.icon(
                      onPressed: () => context.go(Routes.gharHome),
                      icon: const Icon(LucideIcons.search, size: 18),
                      label: Text(l.blFindSipalu),
                    ),
                  ),
                ],
              );
            }
            final active =
                list
                    .where((b) => b.status == BookingStatus.requested || BookingStatus.active.contains(b.status))
                    .toList();
            final rest = list.where((b) => !active.contains(b)).toList();
            return ListView(
              padding: const EdgeInsets.all(KsSpace.page),
              children: [
                if (active.isNotEmpty) ...[
                  Text(l.blActive, style: t.titleMedium),
                  const SizedBox(height: KsSpace.s2),
                  for (final b in active)
                    Padding(padding: const EdgeInsets.only(bottom: KsSpace.s2), child: GharBookingCard(booking: b)),
                ],
                if (rest.isNotEmpty) ...[
                  const SizedBox(height: KsSpace.s2),
                  Text(l.blPast, style: t.titleMedium),
                  const SizedBox(height: KsSpace.s2),
                  for (final b in rest)
                    Padding(padding: const EdgeInsets.only(bottom: KsSpace.s2), child: GharBookingCard(booking: b)),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

/// Booking tracking for the Ghardhani: status timeline, big arrival code,
/// cancel (free window), approve quote, confirm, paid, rate, report.
class GharBookingScreen extends ConsumerStatefulWidget {
  const GharBookingScreen({super.key, required this.id});
  final String id;

  @override
  ConsumerState<GharBookingScreen> createState() => _GharBookingScreenState();
}

class _GharBookingScreenState extends ConsumerState<GharBookingScreen> {
  bool _busy = false;

  Future<void> _act(String action, {Map<String, dynamic> body = const {}, String? done}) async {
    setState(() => _busy = true);
    try {
      await ref.read(bolauRepositoryProvider).bookingAction(widget.id, action, body);
      ref.invalidate(bookingProvider(widget.id));
      ref.invalidate(ghardhaniBookingsProvider);
      if (mounted && done != null) showSnack(context, done);
    } catch (e) {
      if (mounted) showSnack(context, errorText(context, e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _handle(BookingAction a, Booking b) async {
    final l = context.l10n;
    final lang = context.lang;
    switch (a) {
      case BookingAction.cancel:
        final hours = ref.read(bolauConfigValueProvider).freeCancelHours;
        final free = isFreeCancellation(b, freeHours: hours);
        final reason = await showDeclineDialog(
          context,
          title: l.blCancelBookingTitle,
          body: free ? l.blCancelFree : l.blCancelLateHours(localizeDigits('$hours', lang)),
        );
        if (reason != null) await _act('cancel', body: {'reason': reason}, done: l.blCancelled);
      case BookingAction.approveQuote:
        final ok = await confirmDialog(
          context,
          title: l.blApproveQuoteTitle(formatMoney(b.quoteAmount, lang: lang)),
          body: l.blApproveQuoteBody,
          confirmLabel: l.blApprove,
        );
        if (ok) await _act('approve-quote', done: l.blQuoteApproved);
      case BookingAction.rejectQuote:
        final ok = await confirmDialog(
          context,
          title: l.blRejectQuoteTitle,
          body: l.blRejectQuoteBody,
          confirmLabel: l.blRejectQuote,
          danger: true,
        );
        if (ok) await _act('reject-quote', done: l.blQuoteRejected);
      case BookingAction.confirm:
        final ok = await confirmDialog(
          context,
          title: l.blConfirmDoneTitle,
          body: l.blConfirmDoneBody,
          confirmLabel: l.blConfirmDone,
        );
        if (ok) await _act('confirm', done: l.blThanksConfirm);
      case BookingAction.markPaid:
        final method = await showPaidSheet(context);
        if (method != null) await _act('paid', body: {'method': method}, done: l.blPaidSaved);
      case BookingAction.rate:
        final ok = await showBolauRateSheet(context, booking: b, side: BookingSide.ghardhani);
        if (ok == true) ref.invalidate(bookingProvider(widget.id));
      case BookingAction.reportNoShow:
        final ok = await confirmDialog(
          context,
          title: l.blNoShowTitle,
          body: l.blNoShowBody,
          confirmLabel: l.blReportNoShow,
          danger: true,
        );
        if (ok) await _act('report-no-show', done: l.blNoShowSaved);
      default:
        break;
    }
  }

  String _label(AppLocalizations l, BookingAction a) => switch (a) {
    BookingAction.cancel => l.blCancelBooking,
    BookingAction.approveQuote => l.blApproveQuote,
    BookingAction.rejectQuote => l.blRejectQuote,
    BookingAction.confirm => l.blConfirmDone,
    BookingAction.markPaid => l.blMarkPaid,
    BookingAction.rate => l.blRateSipalu,
    BookingAction.reportNoShow => l.blReportNoShow,
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
    final actions = bookingActions(b, BookingSide.ghardhani);
    final buttons =
        actions
            .where(
              (a) =>
                  a != BookingAction.callOther &&
                  a != BookingAction.reportProblem &&
                  a != BookingAction.showArrivalCode,
            )
            .toList();
    final s = b.sipalu;
    final cfg = ref.watch(bolauConfigValueProvider);
    final hours = localizeDigits('${cfg.freeCancelHours}', lang);
    return ListView(
      padding: const EdgeInsets.all(KsSpace.page),
      children: [
        Row(
          children: [
            WorkerAvatar(name: s?.name ?? '', photo: s?.photoUrl, size: 52),
            const SizedBox(width: KsSpace.s3),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(s?.name ?? '', style: t.titleMedium),
                  Text(b.serviceTitle ?? b.trade?.name(lang) ?? '', style: t.bodyMedium),
                  if (b.scheduledStart != null)
                    Text(whenText(b.scheduledStart, lang), style: t.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                ],
              ),
            ),
            BookingStatusBadge(status: b.status),
          ],
        ),
        if (s?.handle != null)
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(
              onPressed: () => context.push(Routes.gharSipalu(s!.handle!)),
              child: Text(l.blSeeProfile),
            ),
          ),
        const SizedBox(height: KsSpace.s3),
        if (actions.contains(BookingAction.showArrivalCode)) ...[
          ArrivalCodeDisplay(code: b.arrivalCode),
          const SizedBox(height: KsSpace.s3),
        ],
        if (b.status == BookingStatus.requested) ...[
          InfoNote(
            icon: LucideIcons.hourglass,
            text: l.blWaitingSipaluMin(localizeDigits('${cfg.acceptTimeoutMinutes}', lang)),
          ),
          const SizedBox(height: KsSpace.s3),
        ],
        if (b.awaitingQuoteApproval) ...[
          InfoNote(
            key: const Key('quote_to_approve'),
            tone: Tone.warning,
            icon: LucideIcons.receipt,
            text: l.blQuoteToApprove(formatMoney(b.quoteAmount, lang: lang)),
          ),
          const SizedBox(height: KsSpace.s3),
        ],
        for (final (i, a) in buttons.indexed) ...[
          if (i == 0 && a != BookingAction.cancel && a != BookingAction.reportNoShow && a != BookingAction.rejectQuote)
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
        if (actions.contains(BookingAction.cancel))
          Text(
            isFreeCancellation(b, freeHours: cfg.freeCancelHours)
                ? l.blFreeCancelHours(hours)
                : l.blCancelLateShortHours(hours),
            style: t.bodySmall?.copyWith(color: context.ks.textMuted),
          ),
        const SizedBox(height: KsSpace.s3),
        SectionCard(title: l.blProgress, child: BookingTimeline(booking: b)),
        const SizedBox(height: KsSpace.s3),
        SectionCard(
          key: const Key('booking_money'),
          title: l.blPrice,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              KeyValueRow(
                label: l.blToSipalu,
                value:
                    b.finalPrice != null
                        ? formatMoney(b.finalPrice, lang: lang)
                        : priceText(l, lang, priceType: b.priceType, price: b.quotedPrice, visitFee: b.visitFee),
              ),
              BookingFeeLine(booking: b),
              if (b.isPaid)
                KeyValueRow(
                  label: l.blPaid,
                  value: paymentMethodLabel(l, b.paymentMethod),
                  valueColor: context.ks.successText,
                ),
              const SizedBox(height: KsSpace.s1),
              Text(l.blPayDirectShort, style: t.bodySmall),
            ],
          ),
        ),
        const SizedBox(height: KsSpace.s3),
        SectionCard(title: l.blContact, child: ContactReveal(booking: b, side: BookingSide.ghardhani)),
        if (b.description.isNotEmpty) ...[
          const SizedBox(height: KsSpace.s3),
          SectionCard(title: l.blWhatsNeeded, child: Text(b.description, style: t.bodyLarge)),
        ],
        const SizedBox(height: KsSpace.s4),
        if (canDisputeBooking(b)) ...[
          RaiseDisputeButton(booking: b, side: BookingSide.ghardhani),
          const SizedBox(height: KsSpace.s2),
        ],
        BolauSafetyCard(booking: b),
      ],
    );
  }
}

/// The booking-fee line on a Ghardhani booking: waived / due (with "Pay
/// booking fee" while fees are on) / paid (with the receipt) / refunded.
/// The fee is KaamSathi's; the Sipalu is always paid directly.
class BookingFeeLine extends ConsumerStatefulWidget {
  const BookingFeeLine({super.key, required this.booking});
  final Booking booking;

  @override
  ConsumerState<BookingFeeLine> createState() => _BookingFeeLineState();
}

class _BookingFeeLineState extends ConsumerState<BookingFeeLine> {
  bool _busy = false;

  /// Set once the gateway answered `provider_not_configured`.
  bool _notConfigured = false;

  Future<void> _pay() async {
    final l = context.l10n;
    final b = widget.booking;
    final provider = await showModalBottomSheet<String>(
      context: context,
      builder:
          (ctx) => SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(KsSpace.page),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(l.blPayFeeTitle, style: Theme.of(ctx).textTheme.titleLarge),
                  const SizedBox(height: KsSpace.s1),
                  Text(l.blPayFeeBody(formatMoney(b.bookingFee, lang: ctx.lang))),
                  const SizedBox(height: KsSpace.s3),
                  for (final p in feeProviders) ...[
                    OutlinedButton(
                      key: Key('fee_provider_$p'),
                      onPressed: () => Navigator.pop(ctx, p),
                      child: Text(paymentMethodLabel(l, p)),
                    ),
                    const SizedBox(height: KsSpace.s2),
                  ],
                ],
              ),
            ),
          ),
    );
    if (provider == null || !mounted) return;
    setState(() => _busy = true);
    try {
      final r = await ref.read(bolauRepositoryProvider).payFee(b.id, provider);
      ref.invalidate(bookingProvider(b.id));
      final url = str(r['redirect_url']);
      if (url != null && url.isNotEmpty && mounted) {
        await showDialog<void>(
          context: context,
          builder:
              (ctx) => AlertDialog(
                title: Text(l.blPayFeeTitle),
                content: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [Text(l.blFeePayLink(paymentMethodLabel(l, provider))), SelectableText(url)],
                ),
                actions: [
                  TextButton(onPressed: () => copyText(ctx, url), child: Text(l.ecoCopyLink)),
                  FilledButton(onPressed: () => Navigator.pop(ctx), child: Text(l.commonClose)),
                ],
              ),
        );
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.code == 'provider_not_configured' || isFeatureUnavailable(e)) {
        setState(() => _notConfigured = true);
        showSnack(context, l.blFeeNotConfigured);
      } else {
        showSnack(context, errorText(context, e), error: true);
      }
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
    final b = widget.booking;
    final state = feeState(b, feeEnabled: ref.watch(bookingFeeEnabledProvider));
    final amount = formatMoney(b.bookingFee, lang: lang);
    final (String value, Color? color) = switch (state) {
      FeeState.waived => (l.blFeeWaived, null),
      FeeState.payable => ('$amount · ${l.blFeeDue}', context.ks.warningText),
      FeeState.pending => ('$amount · ${l.blFeeNotCollected}', null),
      FeeState.paid => ('$amount · ${l.blFeePaid}', context.ks.successText),
      FeeState.refunded => ('$amount · ${l.blFeeRefunded}', null),
    };
    return Column(
      key: Key('fee_${state.name}'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        KeyValueRow(label: l.blBookingFee, value: value, valueColor: color),
        if (state != FeeState.waived) Text(l.blFeeIsKaamSathi, style: t.bodySmall),
        if (state == FeeState.payable) ...[
          const SizedBox(height: KsSpace.s2),
          if (_notConfigured)
            InfoNote(key: const Key('fee_not_configured'), icon: LucideIcons.info, text: l.blFeeNotConfigured)
          else ...[
            OutlinedButton.icon(
              key: const Key('fee_pay'),
              onPressed: _busy ? null : _pay,
              icon:
                  _busy
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(LucideIcons.creditCard),
              label: Text(l.blPayFee),
            ),
            Text(l.blFeeOptional, style: t.bodySmall?.copyWith(color: context.ks.textMuted)),
          ],
        ],
        if (state == FeeState.paid)
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              key: const Key('fee_receipt'),
              onPressed:
                  () => downloadAndOpen(context, ref, apiPath: feeReceiptPath(b.id), fileName: 'receipt-${b.code}.pdf'),
              icon: const Icon(LucideIcons.fileText, size: 18),
              label: Text(l.blFeeReceipt),
            ),
          ),
        const SizedBox(height: KsSpace.s1),
      ],
    );
  }
}
