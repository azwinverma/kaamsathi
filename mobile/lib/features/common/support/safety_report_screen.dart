import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/l10n/l10n.dart';
import '../../../core/router/router.dart';
import '../../../core/theme/tokens.dart';
import '../../../core/widgets/common.dart';
import 'support_data.dart';

String safetyKindLabel(AppLocalizations l, String k) => switch (k) {
  'unsafe_workplace' => l.safetyKindUnsafe,
  'harassment' => l.safetyKindHarassment,
  'payment_withholding' => l.safetyKindWages,
  _ => l.safetyKindOther,
};

/// Prominent "call 100" line — shown at the top of every safety screen.
class DangerCallout extends StatelessWidget {
  const DangerCallout({super.key});

  @override
  Widget build(BuildContext context) {
    final c = context.statusColors;
    return Container(
      key: const Key('safety_danger'),
      padding: const EdgeInsets.all(KsSpace.s4),
      decoration: BoxDecoration(color: c.dangerBg, borderRadius: BorderRadius.circular(KsRadius.lg)),
      child: Row(
        children: [
          Icon(LucideIcons.siren, color: c.dangerFg, size: 28),
          const SizedBox(width: KsSpace.s3),
          Expanded(
            child: Text(
              context.l10n.safetyDanger,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(color: c.dangerFg, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}

/// Confidential safety report: never visible to the employer.
class SafetyReportScreen extends ConsumerStatefulWidget {
  const SafetyReportScreen({super.key});

  @override
  ConsumerState<SafetyReportScreen> createState() => _SafetyReportScreenState();
}

class _SafetyReportScreenState extends ConsumerState<SafetyReportScreen> {
  String _kind = 'unsafe_workplace';
  bool _emergency = false;
  bool _anonymous = false;
  final _desc = TextEditingController();
  final _form = GlobalKey<FormState>();
  bool _busy = false;

  @override
  void dispose() {
    _desc.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    final l = context.l10n;
    setState(() => _busy = true);
    try {
      final created = await ref
          .read(supportRepositoryProvider)
          .reportSafety(
            safetyReportBody(
              kind: _kind,
              subject: safetyKindLabel(lookupAppLocalizations(const Locale('en')), _kind),
              description: _desc.text,
              emergency: _emergency,
              anonymous: _anonymous,
            ),
          );
      ref.invalidate(supportCasesProvider);
      if (!mounted) return;
      showSnack(context, l.safetySent);
      if (created != null) {
        context.pushReplacement(Routes.helpCase(created.id));
      } else {
        context.pop();
      }
    } catch (e) {
      if (mounted) showSnack(context, errorText(context, e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final c = context.statusColors;
    return Scaffold(
      appBar: AppBar(title: Text(l.safetyTitle)),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.all(KsSpace.page),
          children: [
            const DangerCallout(),
            const SizedBox(height: KsSpace.s3),
            Container(
              key: const Key('safety_confidential'),
              padding: const EdgeInsets.all(KsSpace.s3),
              decoration: BoxDecoration(color: c.infoBg, borderRadius: BorderRadius.circular(KsRadius.md)),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(LucideIcons.lock, size: 18, color: c.infoFg),
                  const SizedBox(width: KsSpace.s2),
                  Expanded(child: Text(l.safetyConfidential, style: t.bodyMedium?.copyWith(color: c.infoFg))),
                ],
              ),
            ),
            const SizedBox(height: KsSpace.s4),
            Text(l.safetyKind, style: t.titleSmall),
            const SizedBox(height: KsSpace.s2),
            Wrap(
              spacing: KsSpace.s2,
              runSpacing: KsSpace.s2,
              children: [
                for (final k in safetyKinds)
                  ChoiceChip(
                    key: Key('safety_kind_$k'),
                    label: Text(safetyKindLabel(l, k)),
                    selected: _kind == k,
                    onSelected: (_) => setState(() => _kind = k),
                  ),
              ],
            ),
            const SizedBox(height: KsSpace.s4),
            TextFormField(
              key: const Key('safety_description'),
              controller: _desc,
              minLines: 4,
              maxLines: 8,
              maxLength: 3000,
              decoration: InputDecoration(labelText: l.safetyDescription, alignLabelWithHint: true),
              validator: (v) => (v?.trim().isEmpty ?? true) ? l.ecoRequired : null,
            ),
            SwitchListTile(
              key: const Key('safety_emergency'),
              contentPadding: EdgeInsets.zero,
              value: _emergency,
              onChanged: (v) => setState(() => _emergency = v),
              title: Text(l.safetyEmergency),
              subtitle: Text(l.safetyEmergencyHint),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              value: _anonymous,
              onChanged: (v) => setState(() => _anonymous = v),
              title: Text(l.safetyAnonymous),
            ),
            const SizedBox(height: KsSpace.s4),
            FilledButton(
              key: const Key('safety_submit'),
              style: _emergency ? FilledButton.styleFrom(backgroundColor: Theme.of(context).colorScheme.error) : null,
              onPressed: _busy ? null : _submit,
              child:
                  _busy
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                      : Text(l.ecoSubmit),
            ),
          ],
        ),
      ),
    );
  }
}
