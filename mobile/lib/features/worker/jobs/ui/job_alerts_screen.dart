import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/digit_formatter.dart';
import '../../../../core/widgets/eco.dart';
import '../../../common/ref_data.dart';
import '../../preferences/availability_screen.dart' show DistrictPickerScreen;
import '../jobs_data.dart';

const alertFrequencies = ['instant', 'daily', 'weekly'];

String frequencyLabel(AppLocalizations l, String f) => switch (f) {
  'instant' => l.freqInstant,
  'weekly' => l.freqWeekly,
  _ => l.freqDaily,
};

/// Job alerts: get told (inbox/SMS) when a matching job opens.
class JobAlertsScreen extends ConsumerWidget {
  const JobAlertsScreen({super.key});

  Future<void> _open(BuildContext context, [JobAlert? a]) => Navigator.of(
    context,
  ).push(MaterialPageRoute<void>(fullscreenDialog: true, builder: (_) => JobAlertFormScreen(alert: a)));

  Future<void> _toggle(BuildContext context, WidgetRef ref, JobAlert a, bool v) async {
    try {
      await ref.read(offersRepositoryProvider).updateAlert(a.id, {'is_active': v});
      ref.invalidate(jobAlertsProvider);
    } catch (e) {
      if (context.mounted) showSnack(context, errorText(context, e), error: true);
    }
  }

  Future<void> _delete(BuildContext context, WidgetRef ref, JobAlert a) async {
    final l = context.l10n;
    if (!await confirmDialog(context, title: l.alertsDeleteConfirm, confirmLabel: l.ecoRemove, danger: true)) return;
    try {
      await ref.read(offersRepositoryProvider).deleteAlert(a.id);
      ref.invalidate(jobAlertsProvider);
    } catch (e) {
      if (context.mounted) showSnack(context, errorText(context, e), error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final value = ref.watch(jobAlertsProvider);
    // The API returns codes; show names when the reference lists are loaded.
    final trades = ref.watch(tradesProvider).value ?? const <Trade>[];
    final districts = ref.watch(districtsProvider).value ?? const <District>[];
    String tradeName(Trade t) => (trades.where((x) => x.code == t.code).firstOrNull ?? t).name(lang);
    String districtName(District d) => (districts.where((x) => x.code == d.code).firstOrNull ?? d).name(lang);
    return Scaffold(
      appBar: AppBar(title: Text(l.alertsTitle)),
      floatingActionButton:
          value.hasError
              ? null
              : FloatingActionButton.extended(
                key: const Key('alerts_add'),
                onPressed: () => _open(context),
                icon: const Icon(LucideIcons.plus),
                label: Text(l.alertsAdd),
              ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(jobAlertsProvider);
          try {
            await ref.read(jobAlertsProvider.future);
          } catch (_) {}
        },
        child: FeatureAsyncBody<List<JobAlert>>(
          value: value,
          onRetry: () => ref.invalidate(jobAlertsProvider),
          data:
              (items) => ListView(
                padding: const EdgeInsets.fromLTRB(KsSpace.page, KsSpace.page, KsSpace.page, 96),
                children: [
                  Text(l.alertsMenuSubtitle, style: t.bodyMedium),
                  const SizedBox(height: KsSpace.s3),
                  if (items.isEmpty) EmptyState(icon: LucideIcons.bellPlus, message: l.alertsEmpty),
                  for (final a in items)
                    Card(
                      key: Key('alert_${a.id}'),
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(KsSpace.s4, KsSpace.s2, KsSpace.s2, KsSpace.s2),
                        child: Row(
                          children: [
                            Expanded(
                              child: InkWell(
                                onTap: () => _open(context, a),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(a.trade == null ? l.alertsAnyTrade : tradeName(a.trade!), style: t.titleSmall),
                                    Text(
                                      a.districts.isEmpty
                                          ? l.alertsAnyDistrict
                                          : a.districts.map(districtName).join(', '),
                                      style: t.bodySmall,
                                    ),
                                    Text(
                                      [
                                        if ((parsePaisa(a.minWage) ?? 0) > 0)
                                          l.alertsFrom(formatMoney(a.minWage, lang: lang)),
                                        frequencyLabel(l, a.frequency),
                                      ].join(' · '),
                                      style: t.bodySmall,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            Switch(value: a.isActive, onChanged: (v) => _toggle(context, ref, a, v)),
                            IconButton(
                              tooltip: l.ecoRemove,
                              onPressed: () => _delete(context, ref, a),
                              icon: const Icon(LucideIcons.trash2),
                            ),
                          ],
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

class JobAlertFormScreen extends ConsumerStatefulWidget {
  const JobAlertFormScreen({super.key, this.alert});
  final JobAlert? alert;

  @override
  ConsumerState<JobAlertFormScreen> createState() => _JobAlertFormScreenState();
}

class _JobAlertFormScreenState extends ConsumerState<JobAlertFormScreen> {
  late String? _trade = widget.alert?.trade?.code;
  late List<District> _districts = [...?widget.alert?.districts];
  late String _freq = widget.alert?.frequency ?? 'daily';
  late final _wage = TextEditingController(
    text: () {
      final p = parsePaisa(widget.alert?.minWage);
      return p == null || p == 0 ? '' : '${p ~/ 100}';
    }(),
  );
  bool _busy = false;

  @override
  void dispose() {
    _wage.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final l = context.l10n;
    setState(() => _busy = true);
    final body = JobAlert.body(
      tradeCode: _trade,
      districtCodes: _districts.map((d) => d.code).toList(),
      minWage: _wage.text,
      frequency: _freq,
      isActive: widget.alert?.isActive ?? true,
    );
    try {
      final repo = ref.read(offersRepositoryProvider);
      if (widget.alert == null) {
        await repo.createAlert(body);
      } else {
        await repo.updateAlert(widget.alert!.id, body);
      }
      ref.invalidate(jobAlertsProvider);
      if (!mounted) return;
      showSnack(context, l.alertsSaved);
      Navigator.of(context).pop();
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
    final trades = ref.watch(tradesProvider).value ?? const <Trade>[];
    return Scaffold(
      appBar: AppBar(title: Text(widget.alert == null ? l.alertsAdd : l.alertsEdit)),
      body: ListView(
        padding: const EdgeInsets.all(KsSpace.page),
        children: [
          DropdownButtonFormField<String?>(
            value: trades.any((x) => x.code == _trade) ? _trade : null,
            isExpanded: true,
            decoration: InputDecoration(labelText: l.workHistTrade),
            items: [
              DropdownMenuItem(value: null, child: Text(l.alertsAnyTrade)),
              for (final x in trades) DropdownMenuItem(value: x.code, child: Text(x.name(lang))),
            ],
            onChanged: (v) => setState(() => _trade = v),
          ),
          const SizedBox(height: KsSpace.s4),
          Text(l.termDistrict, style: t.titleSmall),
          const SizedBox(height: KsSpace.s2),
          if (_districts.isEmpty)
            Text(l.alertsAnyDistrict, style: t.bodyMedium)
          else
            Wrap(
              spacing: KsSpace.s2,
              runSpacing: KsSpace.s1,
              children: [
                for (final d in _districts)
                  InputChip(
                    label: Text(d.name(lang)),
                    onDeleted: () => setState(() => _districts = _districts.where((x) => x.code != d.code).toList()),
                  ),
              ],
            ),
          const SizedBox(height: KsSpace.s2),
          OutlinedButton.icon(
            onPressed: () async {
              final picked = await Navigator.of(context).push<List<District>>(
                MaterialPageRoute(fullscreenDialog: true, builder: (_) => DistrictPickerScreen(selected: _districts)),
              );
              if (picked != null) setState(() => _districts = picked);
            },
            icon: const Icon(LucideIcons.mapPin),
            label: Text(l.availPickDistricts),
          ),
          const SizedBox(height: KsSpace.s4),
          TextField(
            key: const Key('alert_wage'),
            controller: _wage,
            keyboardType: TextInputType.number,
            inputFormatters: const [DigitsFormatter(7)],
            decoration: InputDecoration(labelText: l.ecoOptional(l.alertsMinWage), prefixText: '${l.termNpr} '),
          ),
          const SizedBox(height: KsSpace.s4),
          Text(l.alertsFrequency, style: t.titleSmall),
          const SizedBox(height: KsSpace.s2),
          Wrap(
            spacing: KsSpace.s2,
            runSpacing: KsSpace.s2,
            children: [
              for (final f in alertFrequencies)
                ChoiceChip(
                  key: Key('freq_$f'),
                  label: Text(frequencyLabel(l, f)),
                  selected: _freq == f,
                  onSelected: (_) => setState(() => _freq = f),
                ),
            ],
          ),
          const SizedBox(height: KsSpace.s6),
          FilledButton(
            key: const Key('alert_save'),
            onPressed: _busy ? null : _save,
            child:
                _busy
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                    : Text(l.commonSave),
          ),
        ],
      ),
    );
  }
}
