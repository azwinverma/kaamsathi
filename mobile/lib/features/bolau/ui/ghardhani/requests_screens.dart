import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/router/router.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/eco.dart';
import '../../../../core/widgets/photo_picker.dart';
import '../../../../core/widgets/signature/signature.dart';
import '../../../common/inbox/inbox_screen.dart';
import '../../../common/ref_data.dart';
import '../../bolau_logic.dart';
import '../../bolau_models.dart';
import '../../bolau_repository.dart';
import '../bolau_widgets.dart';
import '../sipalu/bolau_tab.dart' show KaamRequestSummary, offerStatusLabel, offerStatusTone;
import 'addresses_screen.dart';
import 'book_screen.dart' show ChoiceTile;

String requestStatusLabel(AppLocalizations l, String s) => switch (s) {
  'offers_received' => l.blReqOffers,
  'booked' => l.blReqBooked,
  'expired' => l.blStatusExpired,
  'cancelled' => l.blStatusCancelled,
  _ => l.blReqOpen,
};

Tone requestStatusTone(String s) => switch (s) {
  'offers_received' => Tone.info,
  'booked' => Tone.success,
  'expired' || 'cancelled' => Tone.neutral,
  _ => Tone.warning,
};

/// Ghardhani → Requests tab.
class GharRequestsScreen extends ConsumerWidget {
  const GharRequestsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final value = ref.watch(myRequestsProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.blMyRequests), actions: const [InboxBell()]),
      floatingActionButton: FloatingActionButton.extended(
        key: const Key('request_new'),
        onPressed: () => context.push(Routes.gharRequestNew),
        icon: const Icon(LucideIcons.plus),
        label: Text(l.blPostRequest),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(myRequestsProvider);
          try {
            await ref.read(myRequestsProvider.future);
          } catch (_) {}
        },
        child: FeatureAsyncBody<List<KaamRequest>>(
          value: value,
          onRetry: () => ref.invalidate(myRequestsProvider),
          data:
              (list) =>
                  list.isEmpty
                      ? ListView(
                        children: [
                          EmptyState(icon: LucideIcons.megaphone, message: l.blNoRequests, art: KsArt.plumberWrench),
                        ],
                      )
                      : ListView(
                        padding: const EdgeInsets.fromLTRB(KsSpace.page, KsSpace.page, KsSpace.page, 96),
                        children: [
                          for (final r in list)
                            Card(
                              key: Key('my_request_${r.id}'),
                              clipBehavior: Clip.antiAlias,
                              child: InkWell(
                                onTap: () => context.push(Routes.gharRequest(r.id)),
                                child: Padding(
                                  padding: const EdgeInsets.all(KsSpace.s3),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      StatusBadge(
                                        label: requestStatusLabel(l, r.status),
                                        tone: requestStatusTone(r.status),
                                      ),
                                      const SizedBox(height: KsSpace.s1),
                                      KaamRequestSummary(request: r),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
        ),
      ),
    );
  }
}

/// Post a Kaam request: trade, what, photos (≤4), where, when, budget.
class RequestNewScreen extends ConsumerStatefulWidget {
  const RequestNewScreen({super.key});

  @override
  ConsumerState<RequestNewScreen> createState() => _RequestNewScreenState();
}

class _RequestNewScreenState extends ConsumerState<RequestNewScreen> {
  static const maxPhotos = 4;
  String? _trade;
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _budget = TextEditingController();
  final List<String> _photos = [];
  String? _addressId;
  late DateTime _day = nepalToday();
  TimeOfDay _from = const TimeOfDay(hour: 9, minute: 0);
  TimeOfDay _to = const TimeOfDay(hour: 17, minute: 0);
  final _form = GlobalKey<FormState>();
  final String _key = newIdempotencyKey();
  bool _busy = false;

  @override
  void dispose() {
    for (final c in [_title, _description, _budget]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _addPhoto(ImageSource source) async {
    if (_photos.length >= maxPhotos) return;
    try {
      final p = await ref.read(photoPickProvider)(source);
      if (p != null && mounted) setState(() => _photos.add(p));
    } catch (_) {
      if (mounted) showSnack(context, context.l10n.credPhotoError, error: true);
    }
  }

  Future<void> _pickDay() async {
    final today = nepalToday();
    final d = await showDatePicker(
      context: context,
      initialDate: _day,
      firstDate: today,
      lastDate: today.add(const Duration(days: 30)),
    );
    if (d != null) setState(() => _day = d);
  }

  Future<void> _pickTime(bool from) async {
    final t = await showTimePicker(context: context, initialTime: from ? _from : _to);
    if (t != null) setState(() => from ? _from = t : _to = t);
  }

  Future<void> _post(List<BolauAddress> addresses) async {
    final l = context.l10n;
    if (!(_form.currentState?.validate() ?? false)) return;
    if (_trade == null) {
      showSnack(context, l.blPickTradeShort, error: true);
      return;
    }
    final addressId = _addressId ?? addresses.where((a) => a.isDefault).firstOrNull?.id ?? addresses.firstOrNull?.id;
    if (addressId == null) {
      showSnack(context, l.blPickAddress, error: true);
      return;
    }
    final start = DateTime(_day.year, _day.month, _day.day, _from.hour, _from.minute);
    final end = DateTime(_day.year, _day.month, _day.day, _to.hour, _to.minute);
    if (!end.isAfter(start)) {
      showSnack(context, l.blEndAfterStart, error: true);
      return;
    }
    setState(() => _busy = true);
    try {
      final r = await ref
          .read(bolauRepositoryProvider)
          .postRequest(
            {
              'trade': _trade,
              'title': _title.text.trim(),
              'description': _description.text.trim(),
              'address_id': addressId,
              'preferred_window_start': nepalIso(start),
              'preferred_window_end': nepalIso(end),
              'budget_max': moneyInput(_budget.text),
            },
            _photos,
            idempotencyKey: _key,
          );
      ref.invalidate(myRequestsProvider);
      if (!mounted) return;
      showSnack(context, l.blRequestPosted);
      context.pushReplacement(Routes.gharRequest(r.id));
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
    final trades = ref.watch(tradesProvider);
    final addresses = ref.watch(addressesProvider);
    String fmt(TimeOfDay x) => formatTime(DateTime(2000, 1, 1, x.hour, x.minute), lang);
    return Scaffold(
      appBar: AppBar(title: Text(l.blPostRequest)),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.all(KsSpace.page),
          children: [
            Text(l.blPostRequestHint, style: t.bodyMedium),
            const SizedBox(height: KsSpace.s3),
            Text(l.blPickTrade, style: t.titleSmall),
            const SizedBox(height: KsSpace.s2),
            FeatureAsyncSection<List<Trade>>(
              value: trades,
              onRetry: () => ref.invalidate(tradesProvider),
              data:
                  (list) => Wrap(
                    spacing: KsSpace.s2,
                    runSpacing: KsSpace.s2,
                    children: [
                      for (final tr in list)
                        ChoiceChip(
                          key: Key('req_trade_${tr.code}'),
                          label: Text(tr.name(lang)),
                          selected: _trade == tr.code,
                          onSelected: (_) => setState(() => _trade = tr.code),
                        ),
                    ],
                  ),
            ),
            const SizedBox(height: KsSpace.s3),
            TextFormField(
              key: const Key('req_title'),
              controller: _title,
              maxLength: 80,
              decoration: InputDecoration(labelText: l.blReqTitle, hintText: l.blDescribeHint),
              validator: (v) => (v?.trim().isEmpty ?? true) ? l.ecoRequired : null,
            ),
            TextFormField(
              key: const Key('req_description'),
              controller: _description,
              maxLines: 4,
              maxLength: 1000,
              decoration: InputDecoration(labelText: l.ecoOptional(l.blReqDetails), alignLabelWithHint: true),
            ),
            Text(l.blReqPhotos(localizeDigits('$maxPhotos', lang)), style: t.titleSmall),
            const SizedBox(height: KsSpace.s2),
            Wrap(
              spacing: KsSpace.s2,
              runSpacing: KsSpace.s2,
              children: [
                for (final (i, p) in _photos.indexed)
                  Stack(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(KsRadius.dense),
                        child: Image.file(
                          File(p),
                          width: 76,
                          height: 76,
                          fit: BoxFit.cover,
                          cacheWidth: 200,
                          errorBuilder:
                              (_, _, _) => const SizedBox(width: 76, height: 76, child: Icon(LucideIcons.image)),
                        ),
                      ),
                      Positioned(
                        right: 0,
                        top: 0,
                        child: IconButton.filledTonal(
                          visualDensity: VisualDensity.compact,
                          tooltip: l.ecoRemove,
                          onPressed: () => setState(() => _photos.removeAt(i)),
                          icon: const Icon(LucideIcons.x, size: 16),
                        ),
                      ),
                    ],
                  ),
                if (_photos.length < maxPhotos) ...[
                  OutlinedButton.icon(
                    key: const Key('req_photo_camera'),
                    onPressed: () => _addPhoto(ImageSource.camera),
                    icon: const Icon(LucideIcons.camera),
                    label: Text(l.credTakePhoto),
                  ),
                  OutlinedButton.icon(
                    key: const Key('req_photo_gallery'),
                    onPressed: () => _addPhoto(ImageSource.gallery),
                    icon: const Icon(LucideIcons.image),
                    label: Text(l.credChoosePhoto),
                  ),
                ],
              ],
            ),
            const SizedBox(height: KsSpace.s4),
            Text(l.blWhen, style: t.titleSmall),
            const SizedBox(height: KsSpace.s2),
            DateField(label: l.blDay, text: formatBsDateTime(_day, lang), onTap: _pickDay),
            const SizedBox(height: KsSpace.s2),
            Row(
              children: [
                Expanded(
                  child: DateField(
                    label: l.blFrom,
                    text: fmt(_from),
                    icon: LucideIcons.clock,
                    onTap: () => _pickTime(true),
                  ),
                ),
                const SizedBox(width: KsSpace.s2),
                Expanded(
                  child: DateField(
                    label: l.blTo,
                    text: fmt(_to),
                    icon: LucideIcons.clock,
                    onTap: () => _pickTime(false),
                  ),
                ),
              ],
            ),
            const SizedBox(height: KsSpace.s4),
            Text(l.blWhere, style: t.titleSmall),
            FeatureAsyncSection<List<BolauAddress>>(
              value: addresses,
              onRetry: () => ref.invalidate(addressesProvider),
              data: (list) {
                final selected = _addressId ?? list.where((a) => a.isDefault).firstOrNull?.id ?? list.firstOrNull?.id;
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (final a in list)
                      ChoiceTile(
                        key: Key('req_address_${a.id}'),
                        selected: selected == a.id,
                        title: addressLabel(l, a.label),
                        subtitle: [a.line, a.area(lang)].where((s) => s.isNotEmpty).join(' · '),
                        onTap: () => setState(() => _addressId = a.id),
                      ),
                    TextButton.icon(
                      onPressed: () async {
                        final a = await showAddressSheet(context);
                        if (a != null && mounted) setState(() => _addressId = a.id);
                      },
                      icon: const Icon(LucideIcons.plus),
                      label: Text(l.blAddAddress),
                    ),
                  ],
                );
              },
            ),
            const SizedBox(height: KsSpace.s3),
            TextFormField(
              key: const Key('req_budget'),
              controller: _budget,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(labelText: l.ecoOptional(l.blBudget), prefixText: 'Rs '),
            ),
            const SizedBox(height: KsSpace.s3),
            InfoNote(icon: LucideIcons.eyeOff, text: l.blReqPrivacy),
            const SizedBox(height: KsSpace.s4),
            FilledButton.icon(
              key: const Key('req_post'),
              onPressed: _busy ? null : () => _post(addresses.value ?? const []),
              icon: const Icon(LucideIcons.send),
              label: Text(l.blPostRequestCta),
            ),
          ],
        ),
      ),
    );
  }
}

/// A Kaam request with its offers side by side (max 3) and accept.
class GharRequestScreen extends ConsumerStatefulWidget {
  const GharRequestScreen({super.key, required this.id});
  final String id;

  @override
  ConsumerState<GharRequestScreen> createState() => _GharRequestScreenState();
}

class _GharRequestScreenState extends ConsumerState<GharRequestScreen> {
  bool _busy = false;

  Future<void> _accept(KaamRequest r, BolauOffer o) async {
    final l = context.l10n;
    final lang = context.lang;
    final ok = await confirmDialog(
      context,
      title: l.blAcceptOfferTitle(o.sipalu?.name ?? ''),
      body:
          '${priceText(l, lang, priceType: o.priceType, price: o.price, visitFee: o.visitFee)}\n\n${l.blAcceptOfferBody}',
      confirmLabel: l.blAcceptOffer,
    );
    if (!ok || !mounted) return;
    setState(() => _busy = true);
    try {
      final b = await ref.read(bolauRepositoryProvider).acceptOffer(r.id, o.id);
      ref.invalidate(myRequestsProvider);
      ref.invalidate(kaamRequestProvider(widget.id));
      ref.invalidate(ghardhaniBookingsProvider);
      if (!mounted) return;
      showSnack(context, l.blOfferAcceptedSaved);
      if (b != null) context.pushReplacement(Routes.gharBooking(b.id));
    } catch (e) {
      if (mounted) showSnack(context, errorText(context, e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancel(KaamRequest r) async {
    final l = context.l10n;
    final ok = await confirmDialog(context, title: l.blCancelRequest, confirmLabel: l.blCancelRequestCta, danger: true);
    if (!ok) return;
    try {
      await ref.read(bolauRepositoryProvider).cancelRequest(r.id);
      ref.invalidate(myRequestsProvider);
      ref.invalidate(kaamRequestProvider(widget.id));
    } catch (e) {
      if (mounted) showSnack(context, errorText(context, e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final value = ref.watch(kaamRequestProvider(widget.id));
    return Scaffold(
      appBar: AppBar(title: Text(value.value?.code ?? l.blKaamRequest)),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(kaamRequestProvider(widget.id));
          try {
            await ref.read(kaamRequestProvider(widget.id).future);
          } catch (_) {}
        },
        child: FeatureAsyncBody<KaamRequest>(
          value: value,
          onRetry: () => ref.invalidate(kaamRequestProvider(widget.id)),
          data: _body,
        ),
      ),
    );
  }

  Widget _body(KaamRequest r) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final offers = r.offers.take(maxOffersPerRequest).toList();
    return ListView(
      padding: const EdgeInsets.all(KsSpace.page),
      children: [
        StatusBadge(label: requestStatusLabel(l, r.status), tone: requestStatusTone(r.status)),
        const SizedBox(height: KsSpace.s2),
        KaamRequestSummary(request: r),
        if (r.description.isNotEmpty) ...[const SizedBox(height: KsSpace.s2), Text(r.description, style: t.bodyLarge)],
        if (r.expiresAt != null && r.isOpen) ...[
          const SizedBox(height: KsSpace.s2),
          Text(
            l.blReqOpenUntil(whenText(r.expiresAt, lang)),
            style: t.bodySmall?.copyWith(color: context.ks.textMuted),
          ),
        ],
        const SizedBox(height: KsSpace.s4),
        Text(
          l.blOffersTitle(localizeDigits('${offers.length}', lang), localizeDigits('$maxOffersPerRequest', lang)),
          key: const Key('offers_title'),
          style: t.titleMedium,
        ),
        const SizedBox(height: KsSpace.s2),
        if (offers.isEmpty)
          InfoNote(icon: LucideIcons.hourglass, text: r.isOpen ? l.blNoOffersYet : l.blNoOffersClosed)
        else
          OffersCompare(offers: offers, busy: _busy, canAccept: r.isOpen, onAccept: (o) => _accept(r, o)),
        if (r.bookingId != null) ...[
          const SizedBox(height: KsSpace.s3),
          FilledButton(onPressed: () => context.push(Routes.gharBooking(r.bookingId!)), child: Text(l.blOpenBooking)),
        ],
        if (r.isOpen) ...[
          const SizedBox(height: KsSpace.s4),
          OutlinedButton(
            key: const Key('request_cancel'),
            onPressed: () => _cancel(r),
            child: Text(l.blCancelRequestCta),
          ),
        ],
      ],
    );
  }
}

/// Up to three offers, compared on price, start, rating and verification.
class OffersCompare extends StatelessWidget {
  const OffersCompare({
    super.key,
    required this.offers,
    required this.onAccept,
    this.busy = false,
    this.canAccept = true,
  });
  final List<BolauOffer> offers;
  final ValueChanged<BolauOffer> onAccept;
  final bool busy;
  final bool canAccept;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final shown = offers.take(maxOffersPerRequest).toList();
    final cheapest = shown
        .where((o) => o.priceType != PriceType.visitThenQuote && parsePaisa(o.price) != null)
        .map((o) => parsePaisa(o.price)!)
        .fold<int?>(null, (m, p) => m == null || p < m ? p : m);
    return Column(
      key: const Key('offers_compare'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final o in shown)
          Card(
            key: Key('offer_${o.id}'),
            child: Padding(
              padding: const EdgeInsets.all(KsSpace.s3),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      WorkerAvatar(name: o.sipalu?.name ?? '', photo: o.sipalu?.photoUrl),
                      const SizedBox(width: KsSpace.s3),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(o.sipalu?.name ?? '', style: t.titleSmall),
                            RatingLine(avg: o.sipalu?.ratingAvg, count: o.sipalu?.ratingCount ?? 0),
                          ],
                        ),
                      ),
                      StatusBadge(label: offerStatusLabel(l, o.status), tone: offerStatusTone(o.status)),
                    ],
                  ),
                  const SizedBox(height: KsSpace.s2),
                  Text(
                    priceText(l, lang, priceType: o.priceType, price: o.price, visitFee: o.visitFee),
                    style: t.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                  Wrap(
                    spacing: KsSpace.s2,
                    runSpacing: KsSpace.s1,
                    children: [
                      if ((o.sipalu?.verificationLevel ?? 0) >= 1)
                        StatusBadge(label: l.blIdVerified, tone: Tone.verified, icon: LucideIcons.badgeCheck),
                      if (cheapest != null && parsePaisa(o.price) == cheapest && shown.length > 1)
                        StatusBadge(label: l.blLowestPrice, tone: Tone.success, icon: LucideIcons.trendingDown),
                    ],
                  ),
                  if (o.proposedStart != null) Text(l.blCanCome(whenText(o.proposedStart, lang)), style: t.bodyMedium),
                  if (o.message.isNotEmpty) ...[
                    const SizedBox(height: KsSpace.s1),
                    Text('“${o.message}”', style: t.bodyMedium?.copyWith(fontStyle: FontStyle.italic)),
                  ],
                  if (canAccept && o.status == 'pending') ...[
                    const SizedBox(height: KsSpace.s2),
                    FilledButton(
                      key: Key('accept_offer_${o.id}'),
                      onPressed: busy ? null : () => onAccept(o),
                      child: Text(l.blAcceptOffer),
                    ),
                  ],
                ],
              ),
            ),
          ),
      ],
    );
  }
}
