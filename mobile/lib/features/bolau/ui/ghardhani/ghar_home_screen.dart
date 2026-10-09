import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/auth/session.dart';
import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/router/router.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/signature/signature.dart';
import '../../../common/inbox/inbox_screen.dart';
import '../../../common/ref_data.dart';
import '../../../worker/jobs/ui/jobs_screen.dart' show JobCardFrame;
import '../../bolau_models.dart';
import '../../bolau_repository.dart';
import '../bolau_widgets.dart';

/// Ghardhani Home: search by trade, post a Kaam request, the next booking.
class GharHomeScreen extends ConsumerStatefulWidget {
  const GharHomeScreen({super.key});

  @override
  ConsumerState<GharHomeScreen> createState() => _GharHomeScreenState();
}

class _GharHomeScreenState extends ConsumerState<GharHomeScreen> {
  final _q = TextEditingController();

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  void _search() {
    final q = _q.text.trim();
    context.push(q.isEmpty ? Routes.gharSearch() : '/g/search?q=${Uri.encodeQueryComponent(q)}');
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final me = ref.watch(sessionProvider).me;
    final trades = ref.watch(bolauTradesProvider);
    final bookings = ref.watch(ghardhaniBookingsProvider).value ?? const <Booking>[];
    final next =
        bookings.where((b) => b.status == BookingStatus.requested || BookingStatus.active.contains(b.status)).toList()
          ..sort((a, b) => (a.scheduledStart ?? DateTime(3000)).compareTo(b.scheduledStart ?? DateTime(3000)));
    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(bolauTradesProvider);
          ref.invalidate(ghardhaniBookingsProvider);
          try {
            await ref.read(ghardhaniBookingsProvider.future);
          } catch (_) {}
        },
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            MuralHeader(
              lettering: 'सीप',
              trailing: const InboxBell(onMural: true),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    me?.firstName.isNotEmpty ?? false ? l.blHelloName(me!.firstName) : l.homeHello,
                    style: t.bodyMedium?.copyWith(color: KsMural.onGround),
                  ),
                  const SizedBox(height: 2),
                  Text(l.blHomeTitle, style: t.headlineSmall?.copyWith(color: KsMural.onGround)),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(KsSpace.page),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextField(
                    key: const Key('ghar_search'),
                    controller: _q,
                    textInputAction: TextInputAction.search,
                    onSubmitted: (_) => _search(),
                    decoration: InputDecoration(
                      hintText: l.blSearchHint,
                      prefixIcon: const Icon(LucideIcons.search),
                      suffixIcon: IconButton(
                        tooltip: l.blSearch,
                        onPressed: _search,
                        icon: const Icon(LucideIcons.arrowRight),
                      ),
                    ),
                  ),
                  const SizedBox(height: KsSpace.s3),
                  Text(l.blPickTrade, style: t.titleSmall),
                  const SizedBox(height: KsSpace.s2),
                  _TradeChips(value: trades),
                  if (next.isNotEmpty) ...[
                    const SizedBox(height: KsSpace.s4),
                    Text(l.blNextBooking, style: t.titleMedium),
                    const SizedBox(height: KsSpace.s2),
                    GharBookingCard(booking: next.first),
                  ],
                  const SizedBox(height: KsSpace.s4),
                  JobCardFrame(
                    key: const Key('post_request_card'),
                    onTap: () => context.push(Routes.gharRequestNew),
                    child: Row(
                      children: [
                        const Icon(LucideIcons.megaphone, size: 28),
                        const SizedBox(width: KsSpace.s3),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(l.blPostRequest, style: t.titleMedium),
                              Text(l.blPostRequestHint, style: t.bodyMedium),
                            ],
                          ),
                        ),
                        const Icon(LucideIcons.chevronRight),
                      ],
                    ),
                  ),
                  const SizedBox(height: KsSpace.s4),
                  _Promise(lang: lang),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TradeChips extends ConsumerWidget {
  const _TradeChips({required this.value});
  final AsyncValue<List<BolauTrade>> value;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lang = context.lang;
    // Fall back to the reference list when /bolau/trades is not there yet.
    final List<Trade> trades = switch (value) {
      AsyncData(:final value) when value.isNotEmpty => value.map((x) => x.trade).toList(),
      _ => ref.watch(tradesProvider).value ?? const <Trade>[],
    };
    if (trades.isEmpty && value.isLoading) {
      return const Padding(padding: EdgeInsets.all(KsSpace.s3), child: LinearProgressIndicator());
    }
    return Wrap(
      spacing: KsSpace.s2,
      runSpacing: KsSpace.s2,
      children: [
        for (final tr in trades.take(16))
          ActionChip(
            key: Key('trade_${tr.code}'),
            avatar: const Icon(LucideIcons.hardHat, size: 16),
            label: Text(tr.name(lang)),
            onPressed: () => context.push(Routes.gharSearch(trade: tr.code)),
          ),
      ],
    );
  }
}

/// The three promises, in plain words (rules 1, 2, 3, 6).
class _Promise extends StatelessWidget {
  const _Promise({required this.lang});
  final String lang;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    Widget row(IconData i, String s) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(i, size: 20, color: context.ks.tealText),
          const SizedBox(width: KsSpace.s2),
          Expanded(child: Text(s, style: t.bodyMedium)),
        ],
      ),
    );
    return SectionCard(
      title: l.blHowBolauWorks,
      child: Column(
        children: [
          row(LucideIcons.badgeCheck, l.blPromiseVerified),
          row(LucideIcons.receipt, l.blPromisePrice),
          row(LucideIcons.handCoins, l.blPromisePayDirect),
          row(LucideIcons.shieldCheck, l.blPromiseSafety),
        ],
      ),
    );
  }
}

/// A booking row for the Ghardhani (who, what, when, status).
class GharBookingCard extends StatelessWidget {
  const GharBookingCard({super.key, required this.booking});
  final Booking booking;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final b = booking;
    final who = b.sipalu?.name ?? '';
    return Card(
      key: Key('ghar_booking_${b.id}'),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push(Routes.gharBooking(b.id)),
        child: Padding(
          padding: const EdgeInsets.all(KsSpace.s3),
          child: Row(
            children: [
              WorkerAvatar(name: who, photo: b.sipalu?.photoUrl),
              const SizedBox(width: KsSpace.s3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      [if (who.isNotEmpty) who, b.serviceTitle ?? b.trade?.name(lang) ?? b.code].join(' · '),
                      style: t.titleSmall,
                    ),
                    if (b.scheduledStart != null) Text(whenText(b.scheduledStart, lang), style: t.bodyMedium),
                    const SizedBox(height: KsSpace.s1),
                    Wrap(
                      spacing: KsSpace.s2,
                      runSpacing: KsSpace.s1,
                      children: [
                        BookingStatusBadge(status: b.status),
                        if (b.amount != null)
                          StatusBadge(label: formatMoney(b.amount, lang: lang), icon: LucideIcons.banknote),
                        if (b.isPaid) StatusBadge(label: l.blPaid, tone: Tone.success, icon: LucideIcons.check),
                      ],
                    ),
                  ],
                ),
              ),
              const Icon(LucideIcons.chevronRight),
            ],
          ),
        ),
      ),
    );
  }
}
