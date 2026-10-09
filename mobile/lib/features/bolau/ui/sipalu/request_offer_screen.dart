import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/api/api_exception.dart';
import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/eco.dart';
import '../../../../core/widgets/photo_picker.dart' show DateField;
import '../../bolau_logic.dart';
import '../../bolau_models.dart';
import '../../bolau_repository.dart';
import '../bolau_widgets.dart';
import 'bolau_tab.dart' show KaamRequestSummary;

/// A nearby Kaam request (ward/municipality only) and the send-offer form.
class RequestOfferScreen extends ConsumerWidget {
  const RequestOfferScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final value = ref.watch(sipaluRequestProvider(id));
    return Scaffold(
      appBar: AppBar(title: Text(value.value?.code ?? l.blKaamRequest)),
      body: switch (value) {
        // 404 with the error envelope: no longer open to this Sipalu (taken,
        // expired, out of area). A bare 404/501 means the route is missing.
        AsyncError(:final error) when error is ApiException && error.code == 'not_found' && error.message.isNotEmpty =>
          ListView(children: [EmptyState(icon: LucideIcons.searchX, message: l.blRequestGone)]),
        _ => FeatureAsyncBody<KaamRequest>(
          value: value,
          onRetry: () => ref.invalidate(sipaluRequestProvider(id)),
          data: (r) => _Body(request: r),
        ),
      },
    );
  }
}

class _Body extends ConsumerStatefulWidget {
  const _Body({required this.request});
  final KaamRequest request;

  @override
  ConsumerState<_Body> createState() => _BodyState();
}

class _BodyState extends ConsumerState<_Body> {
  String _type = PriceType.fixed;
  final _price = TextEditingController();
  final _visitFee = TextEditingController();
  final _message = TextEditingController();
  DateTime? _start;
  final _form = GlobalKey<FormState>();
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    final w = widget.request.windowStart;
    if (w != null) _start = w.isUtc ? w.add(const Duration(hours: 5, minutes: 45)) : w;
  }

  @override
  void dispose() {
    for (final c in [_price, _visitFee, _message]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _pickStart() async {
    final today = nepalToday();
    final d = await showDatePicker(
      context: context,
      initialDate: _start ?? today,
      firstDate: today,
      lastDate: today.add(const Duration(days: 30)),
    );
    if (d == null || !mounted) return;
    final t = await showTimePicker(context: context, initialTime: TimeOfDay(hour: _start?.hour ?? 10, minute: 0));
    if (t == null) return;
    setState(() => _start = DateTime(d.year, d.month, d.day, t.hour, t.minute));
  }

  Future<void> _send() async {
    final l = context.l10n;
    if (!(_form.currentState?.validate() ?? false)) return;
    if (_start == null) {
      showSnack(context, l.blPickWhen, error: true);
      return;
    }
    setState(() => _busy = true);
    try {
      await ref
          .read(bolauRepositoryProvider)
          .sendOffer(
            widget.request.id,
            BolauOffer(
              id: '',
              priceType: _type,
              price: moneyInput(_price.text),
              visitFee: moneyInput(_visitFee.text),
              message: _message.text,
              proposedStart: _start,
            ),
          );
      ref.invalidate(nearbyRequestsProvider);
      ref.invalidate(sipaluRequestProvider(widget.request.id));
      ref.invalidate(myOffersProvider);
      if (!mounted) return;
      showSnack(context, l.blOfferSent);
      context.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      showSnack(context, e.code == 'request_full' ? l.blRequestFull : errorText(context, e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final r = widget.request;
    final min = ref.watch(minimumHourlyProvider).value ?? MinimumHourly.fallback;
    final minText = formatMoney(min.amount, lang: lang);
    final canOffer = r.isOpen && !r.isFull && r.myOffer == null;
    return Form(
      key: _form,
      child: ListView(
        padding: const EdgeInsets.all(KsSpace.page),
        children: [
          KaamRequestSummary(request: r),
          if (r.description.isNotEmpty) ...[
            const SizedBox(height: KsSpace.s3),
            Text(r.description, style: t.bodyLarge),
          ],
          if (r.photos.isNotEmpty) ...[
            const SizedBox(height: KsSpace.s3),
            SizedBox(
              height: 96,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: r.photos.length,
                separatorBuilder: (_, _) => const SizedBox(width: KsSpace.s2),
                itemBuilder:
                    (_, i) => ClipRRect(
                      borderRadius: BorderRadius.circular(KsRadius.dense),
                      child: CachedNetworkImage(
                        imageUrl: r.photos[i],
                        width: 96,
                        height: 96,
                        fit: BoxFit.cover,
                        errorWidget: (_, _, _) => const SizedBox(width: 96, child: Icon(LucideIcons.image)),
                      ),
                    ),
              ),
            ),
          ],
          const SizedBox(height: KsSpace.s3),
          InfoNote(icon: LucideIcons.eyeOff, text: l.blExactAddressLater),
          const SizedBox(height: KsSpace.s4),
          if (r.myOffer != null)
            InfoNote(
              key: const Key('already_offered'),
              tone: Tone.success,
              icon: LucideIcons.check,
              text: l.blYouOfferedPrice(
                priceText(
                  l,
                  lang,
                  priceType: r.myOffer!.priceType,
                  price: r.myOffer!.price,
                  visitFee: r.myOffer!.visitFee,
                ),
              ),
            )
          else if (!canOffer)
            InfoNote(key: const Key('request_full'), tone: Tone.warning, text: l.blRequestFull)
          else ...[
            Text(l.blYourOffer, style: t.titleMedium),
            const SizedBox(height: KsSpace.s2),
            Wrap(
              spacing: KsSpace.s2,
              runSpacing: KsSpace.s2,
              children: [
                for (final pt in PriceType.all)
                  ChoiceChip(
                    key: Key('offer_type_$pt'),
                    label: Text(priceTypeLabel(l, pt)),
                    selected: _type == pt,
                    onSelected: (_) => setState(() => _type = pt),
                  ),
              ],
            ),
            const SizedBox(height: KsSpace.s3),
            if (_type == PriceType.visitThenQuote)
              TextFormField(
                key: const Key('offer_visit_fee'),
                controller: _visitFee,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(labelText: l.blVisitFee, prefixText: 'Rs '),
                validator:
                    (v) =>
                        checkPrice(v, priceType: PriceType.fixed, minimumHourly: min.amount) == null
                            ? null
                            : l.blEnterAmount,
              )
            else
              TextFormField(
                key: const Key('offer_price'),
                controller: _price,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: _type == PriceType.hourly ? l.blPricePerHour : l.blPriceForJob,
                  prefixText: 'Rs ',
                  helperText: _type == PriceType.hourly ? l.blMinHourlyHint(minText) : null,
                  helperMaxLines: 3,
                ),
                // The server assumes an hour of work when an offer gives no time.
                validator:
                    (v) => switch (checkPrice(v, priceType: _type, minimumHourly: min.amount, estimatedMinutes: 60)) {
                      PriceProblem.missing => l.blEnterAmount,
                      PriceProblem.belowMinimum =>
                        _type == PriceType.hourly ? l.blBelowMinHourly(minText) : l.blBelowMinForTime(minText),
                      null => null,
                    },
              ),
            const SizedBox(height: KsSpace.s3),
            DateField(
              key: const Key('offer_when'),
              label: l.blWhenCanYouCome,
              text: _start == null ? null : whenText(_start, lang),
              icon: LucideIcons.calendarClock,
              onTap: _pickStart,
            ),
            const SizedBox(height: KsSpace.s3),
            TextFormField(
              key: const Key('offer_message'),
              controller: _message,
              maxLines: 3,
              maxLength: 300,
              decoration: InputDecoration(labelText: l.blOfferMessage, hintText: l.blOfferMessageHint),
            ),
            const SizedBox(height: KsSpace.s2),
            FilledButton.icon(
              key: const Key('offer_send'),
              onPressed: _busy ? null : _send,
              icon: const Icon(LucideIcons.send),
              label: Text(l.blSendOffer),
            ),
          ],
        ],
      ),
    );
  }
}
