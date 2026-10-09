import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/l10n/l10n.dart';
import '../../../core/router/router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/tokens.dart';
import '../../../core/widgets/common.dart';
import '../../bolau/bolau_repository.dart';
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
    final c = context.ks;
    return Container(
      key: const Key('safety_danger'),
      padding: const EdgeInsets.all(KsSpace.s4),
      decoration: BoxDecoration(color: c.errorSoft, borderRadius: BorderRadius.circular(KsRadius.card)),
      child: Row(
        children: [
          Icon(LucideIcons.siren, color: c.errorText, size: 28),
          const SizedBox(width: KsSpace.s3),
          Expanded(
            child: Text(
              context.l10n.safetyDanger,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(color: c.errorText, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}

/// Confidential safety report: never visible to the employer.
class SafetyReportScreen extends ConsumerStatefulWidget {
  const SafetyReportScreen({super.key, this.bookingId, this.bookingCode});

  /// Bolau: the booking this report is about (the other party never sees
  /// the report).
  final String? bookingId;
  final String? bookingCode;

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
      final bookingId = widget.bookingId;
      final String? caseId;
      if (bookingId != null) {
        // Bolau: tied to the booking, never shown to the other party.
        caseId = await ref.read(bolauRepositoryProvider).safetyReport(bookingId, {
          'safety_kind': _kind,
          'description': _desc.text.trim(),
          'emergency': _emergency,
          'anonymous': _anonymous,
        });
      } else {
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
        caseId = created?.id;
      }
      ref.invalidate(supportCasesProvider);
      if (!mounted) return;
      showSnack(context, l.safetySent);
      if (caseId != null) {
        context.pushReplacement(Routes.helpCase(caseId));
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
    final c = context.ks;
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.bookingCode == null ? l.safetyTitle : '${l.safetyTitle} · ${widget.bookingCode}'),
      ),
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
              decoration: BoxDecoration(color: c.infoSoft, borderRadius: BorderRadius.circular(KsRadius.dense)),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(LucideIcons.lock, size: 18, color: c.infoText),
                  const SizedBox(width: KsSpace.s2),
                  Expanded(
                    child: Text(
                      widget.bookingId == null ? l.safetyConfidential : l.blSafetyConfidential,
                      style: t.bodyMedium?.copyWith(color: c.infoText),
                    ),
                  ),
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
              style: _emergency ? destructiveFilledStyle(context) : null,
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
