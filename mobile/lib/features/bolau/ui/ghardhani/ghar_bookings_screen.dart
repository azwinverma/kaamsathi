import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

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
        final free = isFreeCancellation(b);
        final reason = await showDeclineDialog(
          context,
          title: l.blCancelBookingTitle,
          body: free ? l.blCancelFree : l.blCancelLate,
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
    final fee = b.bookingFee;
    final waived = b.bookingFeeStatus == 'waived' || (parsePaisa(fee) ?? 0) == 0;
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
          InfoNote(icon: LucideIcons.hourglass, text: l.blWaitingSipalu),
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
            isFreeCancellation(b) ? l.blFreeCancel : l.blCancelLateShort,
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
              KeyValueRow(label: l.blBookingFee, value: waived ? l.blFeeWaived : formatMoney(fee, lang: lang)),
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
        BolauSafetyCard(booking: b),
      ],
    );
  }
}
