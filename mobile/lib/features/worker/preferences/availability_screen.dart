import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/format.dart';
import '../../../core/l10n/l10n.dart';
import '../../../core/theme/tokens.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/digit_formatter.dart';
import '../../../core/widgets/eco.dart';
import '../../../core/widgets/photo_picker.dart';
import '../../common/ref_data.dart';
import '../data/worker_models.dart';
import '../data/worker_repository.dart';
import '../jobs/jobs_data.dart';

/// Server limit on preferred districts (SelfWorkerSerializer).
const maxPreferredDistricts = 10;

/// Service-radius choices (km); null = anywhere.
const radiusChoices = <int?>[null, 5, 10, 25, 50, 100];

/// `PATCH /me/worker` body for the availability screen (EXTENSIONS §3).
Map<String, dynamic> preferencesPatch({
  required bool isAvailable,
  required List<String> districtCodes,
  required int? radiusKm,
  required String? expectedWage,
  required DateTime? availableFrom,
}) => {
  'is_available': isAvailable,
  'preferred_districts': districtCodes,
  'service_radius_km': radiusKm,
  'expected_monthly_wage': (expectedWage == null || expectedWage.trim().isEmpty) ? null : expectedWage.trim(),
  'available_from': availableFrom == null ? null : isoDate(availableFrom),
};

/// Availability & preferred areas.
class AvailabilityScreen extends ConsumerWidget {
  const AvailabilityScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = ref.watch(workerProfileProvider);
    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.availTitle)),
      body: FeatureAsyncBody<WorkerProfile>(
        value: value,
        onRetry: () => ref.invalidate(workerProfileProvider),
        data: (p) => AvailabilityForm(key: ValueKey(p.id), profile: p),
      ),
    );
  }
}

class AvailabilityForm extends ConsumerStatefulWidget {
  const AvailabilityForm({super.key, required this.profile});
  final WorkerProfile profile;

  @override
  ConsumerState<AvailabilityForm> createState() => _AvailabilityFormState();
}

class _AvailabilityFormState extends ConsumerState<AvailabilityForm> {
  late bool _available = widget.profile.isAvailable;
  late List<District> _districts = [...widget.profile.preferredDistricts];
  late int? _radius = widget.profile.serviceRadiusKm;
  late final _wage = TextEditingController(
    text: () {
      final p = parsePaisa(widget.profile.expectedMonthlyWage);
      return p == null || p == 0 ? '' : '${p ~/ 100}';
    }(),
  );
  late DateTime? _from = parseIsoDate(widget.profile.availableFrom);
  final _form = GlobalKey<FormState>();
  bool _busy = false;

  @override
  void dispose() {
    _wage.dispose();
    super.dispose();
  }

  Future<void> _pickDistricts() async {
    final picked = await Navigator.of(context).push<List<District>>(
      MaterialPageRoute(fullscreenDialog: true, builder: (_) => DistrictPickerScreen(selected: _districts)),
    );
    if (picked != null) setState(() => _districts = picked);
  }

  Future<void> _pickDate() async {
    final today = nepalToday();
    final d = await showDatePicker(
      context: context,
      initialDate: _from != null && _from!.isAfter(today) ? _from! : today,
      firstDate: today,
      lastDate: DateTime(today.year + 2),
    );
    if (d != null) setState(() => _from = d);
  }

  Future<void> _save() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    final l = context.l10n;
    setState(() => _busy = true);
    try {
      await ref
          .read(workerRepositoryProvider)
          .updateProfile(
            preferencesPatch(
              isAvailable: _available,
              districtCodes: _districts.map((d) => d.code).toList(),
              radiusKm: _radius,
              expectedWage: _wage.text,
              availableFrom: _from,
            ),
          );
      ref.invalidate(workerProfileProvider);
      ref.invalidate(recommendedJobsProvider);
      if (mounted) showSnack(context, l.commonSaved);
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
    // Show names from /ref/districts when the profile only had codes.
    final all = ref.watch(districtsProvider).value ?? const <District>[];
    District named(District d) => all.where((x) => x.code == d.code).firstOrNull ?? d;
    return Form(
      key: _form,
      child: ListView(
        padding: const EdgeInsets.all(KsSpace.page),
        children: [
          Card(
            child: SwitchListTile(
              key: const Key('avail_switch'),
              value: _available,
              onChanged: (v) => setState(() => _available = v),
              title: Text(l.profileAvailable),
              subtitle: Text(l.profileAvailableHint),
              secondary: const Icon(LucideIcons.userCheck),
            ),
          ),
          const SizedBox(height: KsSpace.s4),
          SectionCard(
            title: l.availAreas,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(l.availAreasHint, style: t.bodySmall),
                const SizedBox(height: KsSpace.s2),
                if (_districts.isEmpty)
                  Text(l.availAreasNone, style: t.bodyMedium)
                else
                  Wrap(
                    spacing: KsSpace.s2,
                    runSpacing: KsSpace.s1,
                    children: [
                      for (final d in _districts)
                        InputChip(
                          label: Text(named(d).name(lang)),
                          onDeleted: () => setState(() => _districts = _districts.where((x) => x.code != d.code).toList()),
                        ),
                    ],
                  ),
                const SizedBox(height: KsSpace.s2),
                OutlinedButton.icon(
                  key: const Key('avail_pick_districts'),
                  onPressed: _pickDistricts,
                  icon: const Icon(LucideIcons.mapPin),
                  label: Text(l.availPickDistricts),
                ),
              ],
            ),
          ),
          const SizedBox(height: KsSpace.s4),
          SectionCard(
            title: l.availRadius,
            child: Wrap(
              spacing: KsSpace.s2,
              runSpacing: KsSpace.s2,
              children: [
                for (final r in radiusChoices)
                  ChoiceChip(
                    key: Key('radius_${r ?? 'any'}'),
                    label: Text(r == null ? l.availRadiusAny : l.availRadiusKm(localizeDigits('$r', lang))),
                    selected: _radius == r,
                    onSelected: (_) => setState(() => _radius = r),
                  ),
              ],
            ),
          ),
          const SizedBox(height: KsSpace.s4),
          TextFormField(
            key: const Key('avail_wage'),
            controller: _wage,
            keyboardType: TextInputType.number,
            inputFormatters: const [DigitsFormatter(7)],
            decoration: InputDecoration(labelText: l.ecoOptional(l.availWage), prefixText: '${l.termNpr} '),
          ),
          const SizedBox(height: KsSpace.s3),
          DateField(
            label: l.availFrom,
            text: _from == null ? l.commonNow : formatBsDate(BsDate.fromAd(_from!), lang),
            onTap: _pickDate,
          ),
          const SizedBox(height: KsSpace.s6),
          FilledButton(
            key: const Key('avail_save'),
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

/// Full-screen multi-select of the 77 districts, grouped by province, with search.
class DistrictPickerScreen extends ConsumerStatefulWidget {
  const DistrictPickerScreen({super.key, required this.selected});
  final List<District> selected;

  @override
  ConsumerState<DistrictPickerScreen> createState() => _DistrictPickerScreenState();
}

class _DistrictPickerScreenState extends ConsumerState<DistrictPickerScreen> {
  late final Set<String> _codes = widget.selected.map((d) => d.code).toSet();
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final value = ref.watch(districtsProvider);
    return Scaffold(
      appBar: AppBar(
        title: Text(l.availPickDistricts),
        actions: [
          TextButton(
            key: const Key('districts_done'),
            onPressed: () {
              final all = value.value ?? const <District>[];
              final known = all.where((d) => _codes.contains(d.code)).toList();
              // Keep codes we couldn't resolve (e.g. list failed to load).
              final unknown = widget.selected.where((d) => !all.any((x) => x.code == d.code) && _codes.contains(d.code));
              Navigator.pop(context, [...known, ...unknown]);
            },
            child: Text(l.availDone),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(KsSpace.page, KsSpace.s2, KsSpace.page, KsSpace.s2),
            child: TextField(
              key: const Key('district_search'),
              onChanged: (v) => setState(() => _q = v.trim().toLowerCase()),
              decoration: InputDecoration(
                hintText: l.availSearchDistrict,
                prefixIcon: const Icon(LucideIcons.search),
                helperText: l.availSelectedCount(localizeDigits('${_codes.length}', lang)),
              ),
            ),
          ),
          Expanded(
            child: FeatureAsyncBody<List<District>>(
              value: value,
              onRetry: () => ref.invalidate(districtsProvider),
              data: (all) {
                final shown =
                    all
                        .where(
                          (d) =>
                              _q.isEmpty ||
                              d.nameEn.toLowerCase().contains(_q) ||
                              (d.nameNe ?? '').contains(_q) ||
                              d.code.toLowerCase().contains(_q),
                        )
                        .toList()
                      ..sort((a, b) {
                        final p = (a.province ?? 99).compareTo(b.province ?? 99);
                        return p != 0 ? p : a.name(lang).compareTo(b.name(lang));
                      });
                final rows = <Widget>[];
                int? lastProvince = -1;
                for (final d in shown) {
                  if (d.province != lastProvince) {
                    lastProvince = d.province;
                    if (d.province != null) {
                      rows.add(
                        Padding(
                          padding: const EdgeInsets.fromLTRB(KsSpace.page, KsSpace.s3, KsSpace.page, KsSpace.s1),
                          child: Text(
                            '${l.termProvince} ${localizeDigits('${d.province}', lang)}',
                            style: t.labelLarge?.copyWith(color: context.ks.textMuted),
                          ),
                        ),
                      );
                    }
                  }
                  rows.add(
                    CheckboxListTile(
                      key: Key('district_${d.code}'),
                      value: _codes.contains(d.code),
                      onChanged: (v) {
                        if ((v ?? false) && _codes.length >= maxPreferredDistricts) {
                          showSnack(
                            context,
                            l.availMaxDistricts(localizeDigits('$maxPreferredDistricts', lang)),
                            error: true,
                          );
                          return;
                        }
                        setState(() => (v ?? false) ? _codes.add(d.code) : _codes.remove(d.code));
                      },
                      title: Text(d.name(lang)),
                      subtitle: lang == 'ne' ? null : (d.nameNe == null ? null : Text(d.nameNe!)),
                    ),
                  );
                }
                return ListView(children: rows);
              },
            ),
          ),
        ],
      ),
    );
  }
}
