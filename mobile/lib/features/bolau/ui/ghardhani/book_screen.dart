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
import '../../../../core/widgets/photo_picker.dart' show DateField;
import '../../bolau_logic.dart';
import '../../bolau_models.dart';
import '../../bolau_repository.dart';
import '../bolau_widgets.dart';
import 'addresses_screen.dart';

/// Booking fee line for the Ghardhani: the amount while the fee is on
/// (`/bolau/config`, else the `bolau_fee` flag), otherwise waived. Returns
/// the amount, or null when waived. The Sipalu's own `booking_fee` wins,
/// then the config amount, then the contract default.
String? bookingFeeFor(PublicSipalu p, {required bool feeOn, String? configFee}) =>
    feeOn ? (p.bookingFee ?? configFee ?? defaultBookingFee) : null;

/// Book a specific Sipalu: service → time → address → price → confirm.
class BookScreen extends ConsumerWidget {
  const BookScreen({super.key, required this.handle, this.serviceId});
  final String handle;
  final String? serviceId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final value = ref.watch(publicSipaluProvider(handle));
    return Scaffold(
      appBar: AppBar(title: Text(l.blBookTitle)),
      body: FeatureAsyncBody<PublicSipalu>(
        value: value,
        onRetry: () => ref.invalidate(publicSipaluProvider(handle)),
        data: (p) => _BookForm(sipalu: p, serviceId: serviceId),
      ),
    );
  }
}

class _BookForm extends ConsumerStatefulWidget {
  const _BookForm({required this.sipalu, this.serviceId});
  final PublicSipalu sipalu;
  final String? serviceId;

  @override
  ConsumerState<_BookForm> createState() => _BookFormState();
}

class _BookFormState extends ConsumerState<_BookForm> {
  late SipaluService? _service =
      widget.sipalu.services.where((s) => s.id == widget.serviceId).firstOrNull ?? widget.sipalu.services.firstOrNull;
  final _description = TextEditingController();
  late DateTime _day = nepalToday();
  DateTime? _slot;
  String? _addressId;
  bool _busy = false;

  /// One key per booking attempt: a retry after a timeout reuses it so the
  /// server never creates two bookings.
  final String _idempotencyKey = newIdempotencyKey();

  PublicSipalu get _p => widget.sipalu;

  @override
  void dispose() {
    _description.dispose();
    super.dispose();
  }

  int get _minutes => _service?.estimatedMinutes ?? 60;

  Future<void> _pickManual() async {
    final today = nepalToday();
    final d = await showDatePicker(
      context: context,
      initialDate: _day,
      firstDate: today,
      lastDate: today.add(const Duration(days: 30)),
    );
    if (d == null || !mounted) return;
    final t = await showTimePicker(context: context, initialTime: const TimeOfDay(hour: 10, minute: 0));
    if (t == null) return;
    setState(() {
      _day = d;
      _slot = DateTime(d.year, d.month, d.day, t.hour, t.minute);
    });
  }

  Future<void> _addAddress() async {
    final a = await showAddressSheet(context);
    if (a != null && mounted) setState(() => _addressId = a.id);
  }

  Future<void> _confirm(List<BolauAddress> addresses) async {
    final l = context.l10n;
    final addressId = _addressId ?? addresses.where((a) => a.isDefault).firstOrNull?.id ?? addresses.firstOrNull?.id;
    if (_slot == null) {
      showSnack(context, l.blPickTime, error: true);
      return;
    }
    if (addressId == null) {
      showSnack(context, l.blPickAddress, error: true);
      return;
    }
    if (_service == null && _description.text.trim().isEmpty) {
      showSnack(context, l.blDescribeJob, error: true);
      return;
    }
    setState(() => _busy = true);
    try {
      final trade = _service?.trade.code ?? _p.trades.firstOrNull?.trade.code;
      final b = await ref.read(bolauRepositoryProvider).createBooking({
        'sipalu_handle': _p.handle,
        if (_service != null && _service!.id.isNotEmpty) 'service_id': _service!.id,
        'trade': trade,
        'description': _description.text.trim(),
        'address_id': addressId,
        'scheduled_start': nepalIso(_slot!),
        'estimated_minutes': _minutes,
      }, idempotencyKey: _idempotencyKey);
      ref.invalidate(ghardhaniBookingsProvider);
      if (!mounted) return;
      showSnack(
        context,
        b.status == BookingStatus.accepted ? l.blBookedInstant : l.blRequestSent(_p.displayName(context.lang)),
      );
      context.pushReplacement(Routes.gharBooking(b.id));
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
    final cfg = ref.watch(bolauConfigValueProvider);
    final fee = bookingFeeFor(_p, feeOn: ref.watch(bookingFeeEnabledProvider), configFee: cfg.bookingFee);
    final addresses = ref.watch(addressesProvider);
    final now = DateTime.now();
    final days = [for (var i = 0; i < 7; i++) nepalToday().add(Duration(days: i))];
    final hasRules = _p.availabilityRules.isNotEmpty;
    final slots = hasRules ? slotsFor(_day, _p.availabilityRules, minutes: _minutes, now: now) : const <DateTime>[];
    return ListView(
      padding: const EdgeInsets.all(KsSpace.page),
      children: [
        Row(
          children: [
            WorkerAvatar(name: _p.name, photo: _p.photoUrl),
            const SizedBox(width: KsSpace.s3),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(_p.displayName(lang), style: t.titleMedium),
                  RatingLine(avg: _p.ratingAvg, count: _p.ratingCount, jobs: _p.jobsCompleted),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: KsSpace.s4),
        // 1. Service
        Text(l.blWhatWork, style: t.titleSmall),
        const SizedBox(height: KsSpace.s1),
        for (final s in _p.services)
          ChoiceTile(
            key: Key('book_service_${s.id}'),
            selected: _service?.id == s.id,
            title: s.name(lang),
            subtitle: priceText(l, lang, priceType: s.priceType, price: s.price, visitFee: s.visitFee),
            onTap: () => setState(() => _service = s),
          ),
        ChoiceTile(
          key: const Key('book_service_other'),
          selected: _service == null,
          title: l.blSomethingElse,
          subtitle: l.blSomethingElseHint,
          onTap: () => setState(() => _service = null),
        ),
        TextField(
          key: const Key('book_description'),
          controller: _description,
          maxLines: 3,
          maxLength: 500,
          decoration: InputDecoration(
            labelText: _service == null ? l.blDescribeJob : l.ecoOptional(l.blNoteForSipalu),
            hintText: l.blDescribeHint,
          ),
        ),
        const SizedBox(height: KsSpace.s3),
        // 2. When
        Text(l.blWhen, style: t.titleSmall),
        const SizedBox(height: KsSpace.s2),
        if (hasRules) ...[
          SizedBox(
            height: 48,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: days.length,
              separatorBuilder: (_, _) => const SizedBox(width: KsSpace.s2),
              itemBuilder: (_, i) {
                final d = days[i];
                return ChoiceChip(
                  key: Key('book_day_$i'),
                  label: Text(
                    i == 0
                        ? l.blToday
                        : '${weekdayName(d, lang, short: true)} ${localizeDigits('${BsDate.fromAd(d).day}', lang)}',
                  ),
                  selected: d == _day,
                  onSelected:
                      (_) => setState(() {
                        _day = d;
                        _slot = null;
                      }),
                );
              },
            ),
          ),
          const SizedBox(height: KsSpace.s2),
          if (slots.isEmpty)
            Text(l.blNoSlots, style: t.bodyMedium?.copyWith(color: context.ks.textMuted))
          else
            Wrap(
              spacing: KsSpace.s2,
              runSpacing: KsSpace.s2,
              children: [
                for (final s in slots)
                  ChoiceChip(
                    key: Key('slot_${s.hour}'),
                    label: Text(formatTime(s, lang)),
                    selected: _slot == s,
                    onSelected: (_) => setState(() => _slot = s),
                  ),
              ],
            ),
        ] else
          DateField(
            key: const Key('book_when'),
            label: l.blPickTime,
            text: _slot == null ? null : whenText(_slot, lang),
            icon: LucideIcons.calendarClock,
            onTap: _pickManual,
          ),
        const SizedBox(height: KsSpace.s4),
        // 3. Where
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
                    key: Key('book_address_${a.id}'),
                    selected: selected == a.id,
                    title: addressLabel(l, a.label),
                    subtitle: [a.line, a.area(lang)].where((s) => s.isNotEmpty).join(' · '),
                    onTap: () => setState(() => _addressId = a.id),
                  ),
                TextButton.icon(
                  key: const Key('book_add_address'),
                  onPressed: _addAddress,
                  icon: const Icon(LucideIcons.plus),
                  label: Text(l.blAddAddress),
                ),
                Text(l.blAddressPrivacy, style: t.bodySmall?.copyWith(color: context.ks.textMuted)),
              ],
            );
          },
        ),
        const SizedBox(height: KsSpace.s4),
        // 4. Price
        SectionCard(
          key: const Key('book_price'),
          title: l.blPrice,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              KeyValueRow(
                label: l.blToSipalu,
                value:
                    _service == null
                        ? l.blAgreeOnPrice
                        : priceText(
                          l,
                          lang,
                          priceType: _service!.priceType,
                          price: _service!.price,
                          visitFee: _service!.visitFee,
                        ),
              ),
              KeyValueRow(
                key: const Key('book_fee'),
                label: l.blBookingFee,
                value: fee == null ? l.blFeeWaived : formatMoney(fee, lang: lang),
              ),
              const Divider(),
              Text(l.blPayDirectNote, style: t.bodyMedium),
              if (fee != null) ...[
                Text(l.blFeeNote, style: t.bodySmall),
                Text(l.blFeeIsKaamSathi, key: const Key('book_fee_note'), style: t.bodySmall),
              ],
            ],
          ),
        ),
        const SizedBox(height: KsSpace.s3),
        InfoNote(
          icon: LucideIcons.calendarX,
          text: l.blFreeCancelHours(localizeDigits('${cfg.freeCancelHours}', lang)),
        ),
        const SizedBox(height: KsSpace.s4),
        FilledButton.icon(
          key: const Key('book_confirm'),
          onPressed: _busy ? null : () => _confirm(addresses.value ?? const []),
          icon:
              _busy
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(LucideIcons.check),
          label: Text(_p.instantBooking ? l.blConfirmBooking : l.blSendRequest),
        ),
        const SizedBox(height: KsSpace.s2),
        Text(
          _p.instantBooking ? l.blInstantNote : l.blRequestNoteMin(localizeDigits('${cfg.acceptTimeoutMinutes}', lang)),
          textAlign: TextAlign.center,
          style: t.bodySmall?.copyWith(color: context.ks.textMuted),
        ),
      ],
    );
  }
}

/// One option of a single-choice list (radio semantics).
class ChoiceTile extends StatelessWidget {
  const ChoiceTile({super.key, required this.selected, required this.title, this.subtitle, required this.onTap});
  final bool selected;
  final String title;
  final String? subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    inMutuallyExclusiveGroup: true,
    checked: selected,
    child: ListTile(
      contentPadding: EdgeInsets.zero,
      selected: selected,
      leading: Icon(selected ? LucideIcons.circleCheckBig : LucideIcons.circle),
      title: Text(title),
      subtitle: subtitle == null ? null : Text(subtitle!),
      onTap: onTap,
    ),
  );
}
