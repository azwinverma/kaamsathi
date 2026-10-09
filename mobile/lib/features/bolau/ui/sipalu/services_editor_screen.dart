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
import 'sipalu_editors.dart';

/// Quick editor: services & prices (saved one by one) and weekly hours +
/// time off (saved together).
class SipaluServicesScreen extends ConsumerWidget {
  const SipaluServicesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = ref.watch(mySipaluProvider);
    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.blServicesAndHours)),
      body: FeatureAsyncBody<MySipalu>(
        value: value,
        onRetry: () => ref.invalidate(mySipaluProvider),
        data: (p) => _Editor(key: ValueKey(p.handle), profile: p),
      ),
    );
  }
}

class _Editor extends ConsumerStatefulWidget {
  const _Editor({super.key, required this.profile});
  final MySipalu profile;

  @override
  ConsumerState<_Editor> createState() => _EditorState();
}

class _EditorState extends ConsumerState<_Editor> {
  late List<SipaluService> _services = [...widget.profile.services];
  late List<AvailabilityRule> _rules = widget.profile.availability;
  late final List<TimeOff> _off = [...widget.profile.timeOff];
  bool _hoursDirty = false;
  bool _busy = false;

  List<Trade> get _trades => widget.profile.skills.map((s) => s.trade).where((t) => t.code.isNotEmpty).toList();

  Future<void> _editService([int? i]) async {
    final l = context.l10n;
    final s = await showServiceSheet(context, initial: i == null ? null : _services[i], trades: _trades);
    if (s == null || !mounted) return;
    try {
      final saved = await ref.read(bolauRepositoryProvider).saveService(s);
      setState(() => i == null ? _services = [..._services, saved] : _services[i] = saved);
      ref.invalidate(mySipaluProvider);
      if (mounted) showSnack(context, l.commonSaved);
    } catch (e) {
      if (mounted) showSnack(context, errorText(context, e), error: true);
    }
  }

  Future<void> _deleteService(int i) async {
    final l = context.l10n;
    if (!await confirmDialog(context, title: l.blRemoveService, confirmLabel: l.ecoRemove, danger: true)) return;
    try {
      final s = _services[i];
      if (s.id.isNotEmpty) await ref.read(bolauRepositoryProvider).deleteService(s.id);
      setState(() => _services = [..._services]..removeAt(i));
      ref.invalidate(mySipaluProvider);
    } catch (e) {
      if (mounted) showSnack(context, errorText(context, e), error: true);
    }
  }

  Future<void> _saveHours() async {
    final l = context.l10n;
    if (!rulesValid(_rules)) {
      showSnack(context, l.blEndAfterStart, error: true);
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(bolauRepositoryProvider).putAvailability(_rules);
      ref.invalidate(mySipaluProvider);
      if (!mounted) return;
      setState(() => _hoursDirty = false);
      showSnack(context, l.commonSaved);
    } catch (e) {
      if (mounted) showSnack(context, errorText(context, e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _addOff() async {
    final today = nepalToday();
    final r = await showDateRangePicker(context: context, firstDate: today, lastDate: DateTime(today.year + 1));
    if (r == null || !mounted) return;
    try {
      final saved = await ref
          .read(bolauRepositoryProvider)
          .addTimeOff(TimeOff(from: isoDate(r.start), to: isoDate(r.end)));
      setState(() => _off.add(saved));
    } catch (e) {
      if (mounted) showSnack(context, errorText(context, e), error: true);
    }
  }

  Future<void> _removeOff(TimeOff o) async {
    try {
      if (o.id.isNotEmpty) await ref.read(bolauRepositoryProvider).deleteTimeOff(o.id);
      setState(() => _off.remove(o));
    } catch (e) {
      if (mounted) showSnack(context, errorText(context, e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    return ListView(
      padding: const EdgeInsets.all(KsSpace.page),
      children: [
        SectionCard(
          title: l.blStepServices,
          trailing: TextButton.icon(
            key: const Key('services_add'),
            onPressed: _editService,
            icon: const Icon(LucideIcons.plus, size: 16),
            label: Text(l.ecoAdd),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_services.isEmpty) Text(l.blNoServices),
              for (var i = 0; i < _services.length; i++)
                ServiceTile(
                  key: Key('service_${_services[i].id}_$i'),
                  service: _services[i],
                  onEdit: () => _editService(i),
                  onDelete: () => _deleteService(i),
                ),
            ],
          ),
        ),
        const SizedBox(height: KsSpace.s3),
        SectionCard(
          title: l.blStepAvailability,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              WeeklyHoursEditor(
                rules: _rules,
                onChanged:
                    (r) => setState(() {
                      _rules = r;
                      _hoursDirty = true;
                    }),
              ),
              const SizedBox(height: KsSpace.s2),
              FilledButton(
                key: const Key('hours_save'),
                onPressed: _hoursDirty && !_busy ? _saveHours : null,
                child: Text(l.blSaveHours),
              ),
            ],
          ),
        ),
        const SizedBox(height: KsSpace.s3),
        SectionCard(
          title: l.blTimeOff,
          trailing: TextButton.icon(
            onPressed: _addOff,
            icon: const Icon(LucideIcons.plus, size: 16),
            label: Text(l.ecoAdd),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_off.isEmpty) Text(l.blNoTimeOff),
              for (final o in _off)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(LucideIcons.calendarOff),
                  title: Text('${formatBsOrAd(null, o.from, lang)} – ${formatBsOrAd(null, o.to, lang)}'),
                  subtitle: o.note == null ? null : Text(o.note!),
                  trailing: IconButton(
                    tooltip: l.ecoRemove,
                    onPressed: () => _removeOff(o),
                    icon: const Icon(LucideIcons.x),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: KsSpace.s3),
        const DirectPayNote(),
      ],
    );
  }
}
