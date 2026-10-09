import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/eco.dart';
import '../../../common/ref_data.dart';
import '../../bolau_models.dart';
import '../../bolau_repository.dart';

String addressLabel(AppLocalizations l, String label) => switch (label) {
  'office' => l.blAddrOffice,
  'other' => l.blAddrOther,
  _ => l.blAddrHome,
};

/// The Ghardhani's saved addresses.
class AddressesScreen extends ConsumerWidget {
  const AddressesScreen({super.key});

  Future<void> _delete(BuildContext context, WidgetRef ref, BolauAddress a) async {
    final l = context.l10n;
    if (!await confirmDialog(context, title: l.blRemoveAddress, confirmLabel: l.ecoRemove, danger: true)) return;
    try {
      await ref.read(bolauRepositoryProvider).deleteAddress(a.id);
      ref.invalidate(addressesProvider);
    } catch (e) {
      if (context.mounted) showSnack(context, errorText(context, e), error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final value = ref.watch(addressesProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.blAddresses)),
      floatingActionButton: FloatingActionButton.extended(
        key: const Key('address_add'),
        onPressed: () => showAddressSheet(context),
        icon: const Icon(LucideIcons.plus),
        label: Text(l.blAddAddress),
      ),
      body: FeatureAsyncBody<List<BolauAddress>>(
        value: value,
        onRetry: () => ref.invalidate(addressesProvider),
        data:
            (list) =>
                list.isEmpty
                    ? ListView(children: [EmptyState(icon: LucideIcons.mapPin, message: l.blNoAddresses)])
                    : ListView(
                      padding: const EdgeInsets.fromLTRB(KsSpace.page, KsSpace.page, KsSpace.page, 96),
                      children: [
                        for (final a in list)
                          Card(
                            key: Key('address_${a.id}'),
                            child: ListTile(
                              leading: Icon(a.label == 'office' ? LucideIcons.building2 : LucideIcons.house),
                              title: Text('${addressLabel(l, a.label)}${a.isDefault ? ' · ${l.blDefault}' : ''}'),
                              subtitle: Text([a.line, a.area(context.lang)].where((s) => s.isNotEmpty).join('\n')),
                              isThreeLine: true,
                              onTap: () => showAddressSheet(context, initial: a),
                              trailing: IconButton(
                                tooltip: l.ecoRemove,
                                onPressed: () => _delete(context, ref, a),
                                icon: const Icon(LucideIcons.trash2),
                              ),
                            ),
                          ),
                        const SizedBox(height: KsSpace.s2),
                        InfoNote(icon: LucideIcons.lock, text: l.blAddressPrivacy),
                      ],
                    ),
      ),
    );
  }
}

/// Add/edit an address; saves it and returns the saved address.
Future<BolauAddress?> showAddressSheet(BuildContext context, {BolauAddress? initial}) =>
    showModalBottomSheet<BolauAddress>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _AddressForm(initial: initial),
    );

class _AddressForm extends ConsumerStatefulWidget {
  const _AddressForm({this.initial});
  final BolauAddress? initial;

  @override
  ConsumerState<_AddressForm> createState() => _AddressFormState();
}

class _AddressFormState extends ConsumerState<_AddressForm> {
  late String _label = widget.initial?.label ?? 'home';
  late final _line = TextEditingController(text: widget.initial?.line ?? '');
  late final _ward = TextEditingController(text: widget.initial?.ward == null ? '' : '${widget.initial!.ward}');
  late final _municipality = TextEditingController(text: widget.initial?.municipality ?? '');
  late final _landmark = TextEditingController(text: widget.initial?.landmark ?? '');
  late String? _district = widget.initial?.district?.code;
  late bool _default = widget.initial?.isDefault ?? false;
  final _form = GlobalKey<FormState>();
  bool _busy = false;

  @override
  void dispose() {
    for (final c in [_line, _ward, _municipality, _landmark]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    setState(() => _busy = true);
    try {
      final districts = ref.read(districtsProvider).value ?? const <District>[];
      final saved = await ref
          .read(bolauRepositoryProvider)
          .saveAddress(
            BolauAddress(
              id: widget.initial?.id ?? '',
              label: _label,
              line: _line.text,
              ward: int.tryParse(toLatinDigits(_ward.text.trim())),
              municipality: _municipality.text,
              district:
                  districts.where((d) => d.code == _district).firstOrNull ??
                  District(code: _district!, nameEn: _district!),
              landmark: _landmark.text,
              isDefault: _default,
            ),
          );
      ref.invalidate(addressesProvider);
      if (mounted) Navigator.pop(context, saved);
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
    final districts = ref.watch(districtsProvider).value ?? const <District>[];
    String? req(String? v) => (v?.trim().isEmpty ?? true) ? l.ecoRequired : null;
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
              Text(
                widget.initial == null ? l.blAddAddress : l.blEditAddress,
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: KsSpace.s3),
              Wrap(
                spacing: KsSpace.s2,
                children: [
                  for (final x in ['home', 'office', 'other'])
                    ChoiceChip(
                      label: Text(addressLabel(l, x)),
                      selected: _label == x,
                      onSelected: (_) => setState(() => _label = x),
                    ),
                ],
              ),
              const SizedBox(height: KsSpace.s3),
              TextFormField(
                key: const Key('addr_line'),
                controller: _line,
                decoration: InputDecoration(labelText: l.blAddrLine, hintText: l.blAddrLineHint),
                validator: req,
              ),
              const SizedBox(height: KsSpace.s2),
              Row(
                children: [
                  SizedBox(
                    width: 96,
                    child: TextFormField(
                      key: const Key('addr_ward'),
                      controller: _ward,
                      keyboardType: TextInputType.number,
                      decoration: InputDecoration(labelText: l.blWard),
                      validator: (v) => int.tryParse(toLatinDigits(v?.trim() ?? '')) == null ? l.ecoRequired : null,
                    ),
                  ),
                  const SizedBox(width: KsSpace.s2),
                  Expanded(
                    child: TextFormField(
                      key: const Key('addr_municipality'),
                      controller: _municipality,
                      decoration: InputDecoration(labelText: l.blMunicipality),
                      validator: req,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: KsSpace.s2),
              DropdownButtonFormField<String>(
                key: const Key('addr_district'),
                value: districts.any((d) => d.code == _district) ? _district : null,
                isExpanded: true,
                decoration: InputDecoration(labelText: l.termDistrict),
                items: [for (final d in districts) DropdownMenuItem(value: d.code, child: Text(d.name(lang)))],
                onChanged: (v) => setState(() => _district = v),
                validator: (v) => v == null ? l.ecoRequired : null,
              ),
              const SizedBox(height: KsSpace.s2),
              TextFormField(
                controller: _landmark,
                decoration: InputDecoration(labelText: l.ecoOptional(l.blLandmark), hintText: l.blLandmarkHint),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: _default,
                onChanged: (v) => setState(() => _default = v),
                title: Text(l.blUseByDefault),
              ),
              Text(l.blAddressPrivacy, style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: KsSpace.s3),
              FilledButton(key: const Key('addr_save'), onPressed: _busy ? null : _save, child: Text(l.commonSave)),
            ],
          ),
        ),
      ),
    );
  }
}
