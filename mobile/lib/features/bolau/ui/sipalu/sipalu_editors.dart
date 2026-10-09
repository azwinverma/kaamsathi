import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/eco.dart';
import '../../../common/ref_data.dart';
import '../../bolau_logic.dart';
import '../../bolau_models.dart';
import '../../bolau_repository.dart';
import '../bolau_widgets.dart';

/// Display order of weekdays (Nepal's week starts on Sunday); API weekdays
/// are 0 = Sunday … 6 = Saturday.
const weekdayDisplayOrder = [0, 1, 2, 3, 4, 5, 6];

/// Day name for an API weekday (0 = Sunday).
String apiWeekdayName(int weekday, String lang, {bool short = false}) {
  final i = weekday.clamp(0, 6);
  if (short) return lang == 'ne' ? weekdaysShortNe[i] : weekdaysShortEn[i];
  return lang == 'ne' ? weekdaysLongNe[i] : weekdaysLongEn[i];
}

/// Default week for a new Sipalu: Sunday–Friday, 9 to 5.
List<AvailabilityRule> defaultWeek() => [
  for (final d in [0, 1, 2, 3, 4, 5]) AvailabilityRule(weekday: d, start: '09:00', end: '17:00'),
];

/// Weekly hours: one row per day with a switch and from/to times.
class WeeklyHoursEditor extends StatelessWidget {
  const WeeklyHoursEditor({super.key, required this.rules, required this.onChanged});
  final List<AvailabilityRule> rules;
  final ValueChanged<List<AvailabilityRule>> onChanged;

  AvailabilityRule? _rule(int d) => rules.where((r) => r.weekday == d).firstOrNull;

  void _set(int day, AvailabilityRule? r) {
    final next = [...rules.where((x) => x.weekday != day), if (r != null) r];
    next.sort((a, b) => weekdayDisplayOrder.indexOf(a.weekday).compareTo(weekdayDisplayOrder.indexOf(b.weekday)));
    onChanged(next);
  }

  Future<String?> _pickTime(BuildContext context, String current) async {
    final m = minutesOfDay(current) ?? 540;
    final t = await showTimePicker(context: context, initialTime: TimeOfDay(hour: m ~/ 60, minute: m % 60));
    if (t == null) return null;
    return '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final hours = rules.fold<int>(0, (s, r) => s + (r.minutes > 0 ? r.minutes : 0)) / 60;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(l.blWeeklyHours(formatNumber(hours, lang: lang)), key: const Key('weekly_hours'), style: t.titleSmall),
        const SizedBox(height: KsSpace.s1),
        for (final d in weekdayDisplayOrder)
          Builder(
            builder: (context) {
              final r = _rule(d);
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Row(
                  children: [
                    Switch(
                      key: Key('day_$d'),
                      value: r != null,
                      onChanged: (v) => _set(d, v ? AvailabilityRule(weekday: d, start: '09:00', end: '17:00') : null),
                    ),
                    const SizedBox(width: KsSpace.s1),
                    SizedBox(width: 64, child: Text(apiWeekdayName(d, lang, short: true), style: t.bodyLarge)),
                    if (r == null)
                      Expanded(child: Text(l.blDayOff, style: t.bodyMedium?.copyWith(color: context.ks.textMuted)))
                    else ...[
                      Expanded(
                        child: TextButton(
                          key: Key('day_${d}_start'),
                          onPressed: () async {
                            final v = await _pickTime(context, r.start);
                            if (v != null) _set(d, AvailabilityRule(weekday: d, start: v, end: r.end));
                          },
                          child: Text(formatClock(r.start, lang)),
                        ),
                      ),
                      const Text('–'),
                      Expanded(
                        child: TextButton(
                          key: Key('day_${d}_end'),
                          onPressed: () async {
                            final v = await _pickTime(context, r.end);
                            if (v != null) _set(d, AvailabilityRule(weekday: d, start: r.start, end: v));
                          },
                          child: Text(formatClock(r.end, lang)),
                        ),
                      ),
                    ],
                  ],
                ),
              );
            },
          ),
      ],
    );
  }
}

/// True when every rule ends after it starts.
bool rulesValid(List<AvailabilityRule> rules) => rules.every((r) => r.minutes > 0);

/// One service line: title, price, active state, edit/delete.
class ServiceTile extends StatelessWidget {
  const ServiceTile({super.key, required this.service, this.onEdit, this.onDelete});
  final SipaluService service;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final s = service;
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: const Icon(LucideIcons.wrench),
      title: Text(s.name(lang)),
      subtitle: Text(
        [
          priceText(l, lang, priceType: s.priceType, price: s.price, visitFee: s.visitFee),
          if (s.estimatedMinutes != null) l.blAboutMinutes(localizeDigits('${s.estimatedMinutes}', lang)),
          if (!s.isActive) l.blPaused,
        ].join(' · '),
      ),
      onTap: onEdit,
      trailing:
          onDelete == null
              ? null
              : IconButton(tooltip: l.ecoRemove, onPressed: onDelete, icon: const Icon(LucideIcons.trash2)),
    );
  }
}

/// Add/edit a service. Hourly prices must be at least the hourly minimum
/// wage (shown as a hint). Returns the edited service, or null.
Future<SipaluService?> showServiceSheet(
  BuildContext context, {
  SipaluService? initial,
  List<Trade> trades = const [],
}) => showModalBottomSheet<SipaluService>(
  context: context,
  isScrollControlled: true,
  builder: (_) => ServiceForm(initial: initial, trades: trades),
);

class ServiceForm extends ConsumerStatefulWidget {
  const ServiceForm({super.key, this.initial, this.trades = const []});
  final SipaluService? initial;

  /// The Sipalu's own trades (first = default).
  final List<Trade> trades;

  @override
  ConsumerState<ServiceForm> createState() => _ServiceFormState();
}

class _ServiceFormState extends ConsumerState<ServiceForm> {
  late final _title = TextEditingController(text: widget.initial?.title ?? '');
  late final _titleNe = TextEditingController(text: widget.initial?.titleNe ?? '');
  late final _price = TextEditingController(text: _rupees(widget.initial?.price));
  late final _visitFee = TextEditingController(text: _rupees(widget.initial?.visitFee));
  late final _minutes = TextEditingController(
    text: widget.initial?.estimatedMinutes == null ? '' : '${widget.initial!.estimatedMinutes}',
  );
  late String _type = widget.initial?.priceType ?? PriceType.fixed;
  late Trade? _trade = widget.initial?.trade ?? widget.trades.firstOrNull;
  late bool _active = widget.initial?.isActive ?? true;
  final _form = GlobalKey<FormState>();

  static String _rupees(String? v) {
    final p = parsePaisa(v);
    return p == null || p == 0 ? '' : '${p ~/ 100}';
  }

  @override
  void dispose() {
    for (final c in [_title, _titleNe, _price, _visitFee, _minutes]) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final min = ref.watch(minimumHourlyProvider).value ?? MinimumHourly.fallback;
    final minText = formatMoney(min.amount, lang: lang);
    final trades =
        {
          for (final x in [...widget.trades, if (widget.initial != null) widget.initial!.trade])
            if (x.code.isNotEmpty) x.code: x,
        }.values.toList();
    return Padding(
      padding: EdgeInsets.only(
        left: KsSpace.page,
        right: KsSpace.page,
        top: KsSpace.page,
        bottom: MediaQuery.viewInsetsOf(context).bottom + KsSpace.page,
      ),
      child: Form(
        key: _form,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(widget.initial == null ? l.blAddService : l.blEditService, style: t.titleLarge),
              const SizedBox(height: KsSpace.s3),
              if (trades.length > 1) ...[
                Wrap(
                  spacing: KsSpace.s2,
                  runSpacing: KsSpace.s2,
                  children: [
                    for (final tr in trades)
                      ChoiceChip(
                        label: Text(tr.name(lang)),
                        selected: _trade?.code == tr.code,
                        onSelected: (_) => setState(() => _trade = tr),
                      ),
                  ],
                ),
                const SizedBox(height: KsSpace.s3),
              ],
              TextFormField(
                key: const Key('service_title'),
                controller: _title,
                maxLength: 80,
                decoration: InputDecoration(labelText: l.blServiceTitle, hintText: l.blServiceTitleHint),
                validator: (v) => (v?.trim().isEmpty ?? true) ? l.ecoRequired : null,
              ),
              TextFormField(
                controller: _titleNe,
                maxLength: 80,
                decoration: InputDecoration(labelText: l.ecoOptional(l.blServiceTitleNe)),
              ),
              Text(l.blHowCharge, style: t.titleSmall),
              const SizedBox(height: KsSpace.s2),
              Wrap(
                spacing: KsSpace.s2,
                runSpacing: KsSpace.s2,
                children: [
                  for (final pt in PriceType.all)
                    ChoiceChip(
                      key: Key('price_type_$pt'),
                      label: Text(priceTypeLabel(l, pt)),
                      selected: _type == pt,
                      onSelected: (_) => setState(() => _type = pt),
                    ),
                ],
              ),
              const SizedBox(height: KsSpace.s3),
              if (_type == PriceType.visitThenQuote)
                TextFormField(
                  key: const Key('service_visit_fee'),
                  controller: _visitFee,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText: l.blVisitFee,
                    prefixText: 'Rs ',
                    helperText: l.blVisitFeeHint,
                    helperMaxLines: 3,
                  ),
                  validator:
                      (v) =>
                          checkPrice(v, priceType: PriceType.fixed, minimumHourly: min.amount) == null
                              ? null
                              : l.blEnterAmount,
                )
              else
                TextFormField(
                  key: const Key('service_price'),
                  controller: _price,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText: _type == PriceType.hourly ? l.blPricePerHour : l.blPriceForJob,
                    prefixText: 'Rs ',
                    helperText: _type == PriceType.hourly ? l.blMinHourlyHint(minText) : null,
                    helperMaxLines: 3,
                  ),
                  validator:
                      (v) => switch (checkPrice(
                        v,
                        priceType: _type,
                        minimumHourly: min.amount,
                        estimatedMinutes: int.tryParse(toLatinDigits(_minutes.text.trim())),
                      )) {
                        PriceProblem.missing => l.blEnterAmount,
                        PriceProblem.belowMinimum =>
                          _type == PriceType.hourly ? l.blBelowMinHourly(minText) : l.blBelowMinForTime(minText),
                        null => null,
                      },
                ),
              const SizedBox(height: KsSpace.s3),
              TextFormField(
                controller: _minutes,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(labelText: l.ecoOptional(l.blEstimatedMinutes)),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: _active,
                onChanged: (v) => setState(() => _active = v),
                title: Text(l.blServiceActive),
              ),
              const SizedBox(height: KsSpace.s2),
              FilledButton(
                key: const Key('service_save'),
                onPressed: () {
                  if (!(_form.currentState?.validate() ?? false)) return;
                  if (_trade == null) {
                    showSnack(context, l.blPickTradeFirst, error: true);
                    return;
                  }
                  Navigator.pop(
                    context,
                    SipaluService(
                      id: widget.initial?.id ?? '',
                      trade: _trade!,
                      title: _title.text.trim(),
                      titleNe: _titleNe.text.trim(),
                      priceType: _type,
                      price: _type == PriceType.visitThenQuote ? null : moneyInput(_price.text),
                      visitFee: _type == PriceType.visitThenQuote ? moneyInput(_visitFee.text) : null,
                      estimatedMinutes: int.tryParse(toLatinDigits(_minutes.text.trim())),
                      isActive: _active,
                    ),
                  );
                },
                child: Text(l.commonSave),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// "Customers pay you directly" note used wherever money is mentioned.
class DirectPayNote extends StatelessWidget {
  const DirectPayNote({super.key});

  @override
  Widget build(BuildContext context) => InfoNote(
    key: const Key('direct_pay_note'),
    icon: LucideIcons.handCoins,
    tone: Tone.success,
    text: context.l10n.blDirectPay,
  );
}
