import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/api/cached.dart';
import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/eco.dart';
import '../../../../core/widgets/photo_picker.dart';
import '../../credentials/ui/credentials_screen.dart' show credentialStatus;
import '../../money/money_data.dart';
import '../mobility_data.dart';

String mobilityKindLabel(AppLocalizations l, String kind) => switch (kind) {
  'passport' => l.mobKindPassport,
  'labour_permit' => l.mobKindLabourPermit,
  'visa' => l.mobKindVisa,
  'police_clearance' => l.mobKindPolice,
  'medical_fitness' => l.mobKindMedical,
  'pre_departure_orientation' => l.mobKindOrientation,
  'insurance' => l.mobKindInsurance,
  'language_test' => l.mobKindLanguage,
  _ => kind,
};

/// The safety guidance every mobility screen must show (EXTENSIONS §5).
/// Built-in text always shows (offline, backend off); when the server sent
/// its own `safety_guidance`, those points are used instead.
class MobilitySafetyGuidance extends ConsumerWidget {
  const MobilitySafetyGuidance({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final lang = context.lang;
    final c = context.statusColors;
    final t = Theme.of(context).textTheme;
    final server = ref.watch(mobilityDocumentsProvider.select((v) => v.value?.data.guidance));
    final serverPoints = server?.points(lang) ?? const <String>[];
    final points = serverPoints.isNotEmpty ? serverPoints : [l.mobSafety1, l.mobSafety2, l.mobSafety3, l.mobSafety4];
    final title = server?.title(lang) ?? l.mobSafetyTitle;
    final dofe = server?.dofeUrl;
    return Container(
      key: const Key('mobility_safety'),
      padding: const EdgeInsets.all(KsSpace.s4),
      decoration: BoxDecoration(
        color: c.warningBg,
        borderRadius: BorderRadius.circular(KsRadius.lg),
        border: Border.all(color: c.warningFg.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(LucideIcons.shieldAlert, color: c.warningFg),
              const SizedBox(width: KsSpace.s2),
              Expanded(child: Text(title, style: t.titleSmall?.copyWith(color: c.warningFg))),
            ],
          ),
          const SizedBox(height: KsSpace.s2),
          for (final p in points)
            Padding(
              padding: const EdgeInsets.only(top: KsSpace.s1),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(top: 2, right: KsSpace.s2),
                    child: Icon(LucideIcons.check, size: 16, color: c.warningFg),
                  ),
                  Expanded(child: Text(p, style: t.bodyMedium)),
                ],
              ),
            ),
          if (dofe != null && dofe.isNotEmpty) ...[
            const SizedBox(height: KsSpace.s2),
            InkWell(
              onTap: () => copyText(context, dofe),
              child: Row(
                children: [
                  Icon(LucideIcons.link, size: 16, color: c.warningFg),
                  const SizedBox(width: KsSpace.s2),
                  Flexible(child: Text(dofe, style: t.bodyMedium?.copyWith(decoration: TextDecoration.underline))),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Working-abroad documents: my documents, eligible agencies, shares.
class MobilityScreen extends StatelessWidget {
  const MobilityScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: Text(l.mobTitle),
          bottom: TabBar(tabs: [Tab(text: l.mobTabDocuments), Tab(text: l.mobTabAgencies)]),
        ),
        body: const TabBarView(children: [_DocumentsTab(), _AgenciesTab()]),
      ),
    );
  }
}

class _DocumentsTab extends ConsumerWidget {
  const _DocumentsTab();

  Future<void> _delete(BuildContext context, WidgetRef ref, MobilityDocument d) async {
    final l = context.l10n;
    if (!await confirmDialog(context, title: l.mobDeleteConfirm, confirmLabel: l.ecoRemove, danger: true)) return;
    try {
      await ref.read(mobilityRepositoryProvider).delete(d.id);
      ref.invalidate(mobilityDocumentsProvider);
      if (context.mounted) showSnack(context, l.workHistDeleted);
    } catch (e) {
      if (context.mounted) showSnack(context, errorText(context, e), error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final value = ref.watch(mobilityDocumentsProvider);
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(mobilityDocumentsProvider);
        try {
          await ref.read(mobilityDocumentsProvider.future);
        } catch (_) {}
      },
      child: ListView(
        padding: const EdgeInsets.all(KsSpace.page),
        children: [
          const MobilitySafetyGuidance(),
          const SizedBox(height: KsSpace.s3),
          Text(l.mobIntro, style: t.bodyMedium),
          const SizedBox(height: KsSpace.s3),
          FeatureAsyncSection<Cached<MobilityDocuments>>(
            value: value,
            onRetry: () => ref.invalidate(mobilityDocumentsProvider),
            data: (cached) {
              final docs = cached.data.items;
              final travel = docs.where((d) => d.kindGroup == 'travel').toList();
              final clearance = docs.where((d) => d.kindGroup != 'travel').toList();
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (cached.fromCache) const CachedNotice(),
                  FilledButton.icon(
                    key: const Key('mobility_add'),
                    onPressed:
                        () => Navigator.of(context).push(
                          MaterialPageRoute<void>(fullscreenDialog: true, builder: (_) => const AddMobilityDocScreen()),
                        ),
                    icon: const Icon(LucideIcons.plus),
                    label: Text(l.mobAdd),
                  ),
                  if (docs.isEmpty) EmptyState(icon: LucideIcons.bookUser, message: l.mobEmpty),
                  if (travel.isNotEmpty) GroupLabel(l.mobTravel),
                  for (final d in travel) _DocCard(doc: d, onDelete: () => _delete(context, ref, d)),
                  if (clearance.isNotEmpty) GroupLabel(l.mobClearance),
                  for (final d in clearance) _DocCard(doc: d, onDelete: () => _delete(context, ref, d)),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _DocCard extends StatelessWidget {
  const _DocCard({required this.doc, required this.onDelete});
  final MobilityDocument doc;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final d = doc;
    final (label, tone, icon) = credentialStatus(l, d.status);
    final days = d.daysToExpiry();
    return Card(
      key: Key('mobility_doc_${d.id}'),
      child: Padding(
        padding: const EdgeInsets.all(KsSpace.s4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(d.kindGroup == 'travel' ? LucideIcons.bookUser : LucideIcons.fileCheck),
            const SizedBox(width: KsSpace.s3),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text((d.title?.isNotEmpty ?? false) ? d.title! : mobilityKindLabel(l, d.kind), style: t.titleSmall),
                  Text(
                    [
                      if (d.title?.isNotEmpty ?? false) mobilityKindLabel(l, d.kind),
                      if (d.number?.isNotEmpty ?? false) d.number!,
                      if (d.issuer?.isNotEmpty ?? false) d.issuer!,
                      if (d.scoreOrLevel?.isNotEmpty ?? false) d.scoreOrLevel!,
                    ].join(' · '),
                    style: t.bodySmall,
                  ),
                  if (d.expiresOn != null)
                    Text(l.credExpires(formatBsOrAd(d.expiresOnBs, d.expiresOn, lang)), style: t.bodySmall),
                  if (d.note?.isNotEmpty ?? false) Text(d.note!, style: t.bodySmall),
                  const SizedBox(height: KsSpace.s2),
                  Wrap(
                    spacing: KsSpace.s2,
                    runSpacing: KsSpace.s1,
                    children: [
                      StatusBadge(
                        label: (d.statusLabel?.isNotEmpty ?? false) ? d.statusLabel! : label,
                        tone: tone,
                        icon: icon,
                      ),
                      if (d.isExpired() && d.status != 'expired')
                        StatusBadge(label: l.mobExpired, tone: Tone.danger, icon: LucideIcons.calendarX)
                      else if (d.expiresSoon() && days != null)
                        StatusBadge(
                          key: Key('expiry_warning_${d.id}'),
                          label: l.mobExpiresInDays(localizeDigits('$days', lang)),
                          tone: Tone.warning,
                          icon: LucideIcons.triangleAlert,
                        ),
                    ],
                  ),
                ],
              ),
            ),
            IconButton(tooltip: l.ecoRemove, onPressed: onDelete, icon: const Icon(LucideIcons.trash2)),
          ],
        ),
      ),
    );
  }
}

class _AgenciesTab extends ConsumerWidget {
  const _AgenciesTab();

  Future<void> _share(BuildContext context, WidgetRef ref, RecruitmentAgency a) async {
    final l = context.l10n;
    final days = await showModalBottomSheet<int>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _ShareSheet(agency: a),
    );
    if (days == null || !context.mounted) return;
    try {
      await ref.read(mobilityRepositoryProvider).share(a.id, days);
      ref.invalidate(mobilitySharesProvider);
      ref.invalidate(grantsProvider);
      if (context.mounted) showSnack(context, l.mobShared);
    } catch (e) {
      if (context.mounted) showSnack(context, errorText(context, e), error: true);
    }
  }

  Future<void> _revoke(BuildContext context, WidgetRef ref, ConsentGrant g) async {
    final l = context.l10n;
    if (!await confirmDialog(
      context,
      title: l.grantRevokeConfirm(g.partner.name),
      confirmLabel: l.ecoRevoke,
      danger: true,
    )) {
      return;
    }
    try {
      await ref.read(moneyRepositoryProvider).revokeGrant(g.id);
      ref.invalidate(mobilitySharesProvider);
      ref.invalidate(grantsProvider);
      if (context.mounted) showSnack(context, l.grantRevokedMsg);
    } catch (e) {
      if (context.mounted) showSnack(context, errorText(context, e), error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final agencies = ref.watch(mobilityAgenciesProvider);
    final shares = ref.watch(mobilitySharesProvider);
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(mobilityAgenciesProvider);
        ref.invalidate(mobilitySharesProvider);
        ref.invalidate(grantsProvider);
        try {
          await ref.read(mobilityAgenciesProvider.future);
        } catch (_) {}
      },
      child: ListView(
        padding: const EdgeInsets.all(KsSpace.page),
        children: [
          const MobilitySafetyGuidance(),
          const SizedBox(height: KsSpace.s3),
          Text(l.mobAgenciesIntro, style: t.bodyMedium),
          FeatureAsyncSection<List<RecruitmentAgency>>(
            value: agencies,
            onRetry: () => ref.invalidate(mobilityAgenciesProvider),
            data:
                (items) => Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (items.isEmpty) EmptyState(icon: LucideIcons.building2, message: l.mobAgenciesEmpty),
                    for (final a in items)
                      Card(
                        key: Key('agency_${a.id}'),
                        child: Padding(
                          padding: const EdgeInsets.all(KsSpace.s4),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text(a.name, style: t.titleSmall),
                              if (a.licenseNo?.isNotEmpty ?? false)
                                Text(l.mobLicence(a.licenseNo!), style: t.bodyMedium),
                              if (a.licenseValidUntil != null)
                                Text(
                                  l.mobLicenceValid(formatBsOrAd(a.licenseValidUntilBs, a.licenseValidUntil, lang)),
                                  style: t.bodySmall,
                                ),
                              if (a.address?.isNotEmpty ?? false) Text(a.address!, style: t.bodySmall),
                              const SizedBox(height: KsSpace.s3),
                              OutlinedButton.icon(
                                key: Key('share_${a.id}'),
                                onPressed: () => _share(context, ref, a),
                                icon: const Icon(LucideIcons.share2),
                                label: Text(l.mobShare),
                              ),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
          ),
          GroupLabel(l.mobSharesTitle),
          FeatureAsyncSection<List<ConsentGrant>>(
            value: shares,
            onRetry: () => ref.invalidate(mobilitySharesProvider),
            data:
                (items) => Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (items.isEmpty) Text(l.mobSharesEmpty, style: t.bodyMedium),
                    for (final g in items)
                      Card(
                        child: ListTile(
                          leading: const Icon(LucideIcons.share2),
                          title: Text(g.partner.name),
                          subtitle: Text(
                            g.isActive()
                                ? (g.expiresAt == null
                                    ? l.grantActive
                                    : l.ecoUntil(formatBsDateTime(g.expiresAt, lang)))
                                : (g.isRevoked ? l.grantRevoked : l.grantExpired),
                          ),
                          trailing:
                              g.isActive()
                                  ? TextButton(
                                    key: Key('revoke_${g.id}'),
                                    onPressed: () => _revoke(context, ref, g),
                                    child: Text(l.ecoRevoke),
                                  )
                                  : null,
                        ),
                      ),
                  ],
                ),
          ),
        ],
      ),
    );
  }
}

class _ShareSheet extends StatefulWidget {
  const _ShareSheet({required this.agency});
  final RecruitmentAgency agency;

  @override
  State<_ShareSheet> createState() => _ShareSheetState();
}

class _ShareSheetState extends State<_ShareSheet> {
  int _days = 30;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    return SafeArea(
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(
          KsSpace.page,
          KsSpace.s4,
          KsSpace.page,
          KsSpace.s4 + MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l.mobShareTitle(widget.agency.name), style: t.titleMedium),
            const SizedBox(height: KsSpace.s2),
            Text(l.mobShareBody, style: t.bodyMedium),
            const SizedBox(height: KsSpace.s3),
            Text(l.mobShareDays, style: t.titleSmall),
            const SizedBox(height: KsSpace.s2),
            Wrap(
              spacing: KsSpace.s2,
              children: [
                for (final d in const [30, 60, 90])
                  ChoiceChip(
                    label: Text(l.ecoDays(localizeDigits('$d', context.lang))),
                    selected: _days == d,
                    onSelected: (_) => setState(() => _days = d),
                  ),
              ],
            ),
            const SizedBox(height: KsSpace.s3),
            const MobilitySafetyGuidance(),
            const SizedBox(height: KsSpace.s4),
            FilledButton(
              key: const Key('share_confirm'),
              onPressed: () => Navigator.pop(context, _days),
              child: Text(l.mobShare),
            ),
            TextButton(onPressed: () => Navigator.pop(context), child: Text(l.commonCancel)),
          ],
        ),
      ),
    );
  }
}

class AddMobilityDocScreen extends ConsumerStatefulWidget {
  const AddMobilityDocScreen({super.key});

  @override
  ConsumerState<AddMobilityDocScreen> createState() => _AddMobilityDocScreenState();
}

class _AddMobilityDocScreenState extends ConsumerState<AddMobilityDocScreen> {
  String _kind = 'passport';
  final _number = TextEditingController();
  final _country = TextEditingController(text: 'NP');
  final _title = TextEditingController();
  final _issuer = TextEditingController();
  final _score = TextEditingController();
  DateTime? _issued;
  DateTime? _expires;
  String? _photo;
  final _form = GlobalKey<FormState>();
  bool _busy = false;

  bool get _travel => MobilityKinds.groupOf(_kind) == 'travel';

  @override
  void dispose() {
    for (final c in [_number, _country, _title, _issuer, _score]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _date(bool expires) async {
    final today = nepalToday();
    final d = await showDatePicker(
      context: context,
      initialDate: (expires ? _expires : _issued) ?? today,
      firstDate: DateTime(1990),
      lastDate: expires ? DateTime(today.year + 15) : today,
    );
    if (d != null) setState(() => expires ? _expires = d : _issued = d);
  }

  Future<void> _save() async {
    final l = context.l10n;
    if (!(_form.currentState?.validate() ?? false)) return;
    if (_photo == null) {
      showSnack(context, l.credPhotoNeeded, error: true);
      return;
    }
    setState(() => _busy = true);
    try {
      await ref
          .read(mobilityRepositoryProvider)
          .add(
            MobilityDocInput(
              kind: _kind,
              number: _number.text,
              issuingCountry: _country.text,
              title: _title.text.trim().isEmpty ? mobilityKindLabel(l, _kind) : _title.text,
              issuer: _issuer.text,
              scoreOrLevel: _score.text,
              issuedOn: _issued == null ? null : isoDate(_issued!),
              expiresOn: _expires == null ? null : isoDate(_expires!),
              documentPath: _photo!,
            ),
          );
      ref.invalidate(mobilityDocumentsProvider);
      if (!mounted) return;
      showSnack(context, l.mobSaved);
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
    String? req(String? v) => (v?.trim().isEmpty ?? true) ? l.ecoRequired : null;
    String? dateText(DateTime? d) => d == null ? null : formatBsDate(BsDate.fromAd(d), lang);
    return Scaffold(
      appBar: AppBar(title: Text(l.mobAdd)),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.all(KsSpace.page),
          children: [
            const MobilitySafetyGuidance(),
            const SizedBox(height: KsSpace.s4),
            DropdownButtonFormField<String>(
              key: const Key('mobility_kind'),
              value: _kind,
              isExpanded: true,
              decoration: InputDecoration(labelText: l.mobKind),
              items: [
                for (final k in [...MobilityKinds.travel, ...MobilityKinds.clearance])
                  DropdownMenuItem(value: k, child: Text(mobilityKindLabel(l, k))),
              ],
              onChanged: (v) => setState(() => _kind = v ?? _kind),
            ),
            const SizedBox(height: KsSpace.s3),
            if (_travel) ...[
              TextFormField(
                key: const Key('mobility_number'),
                controller: _number,
                textCapitalization: TextCapitalization.characters,
                decoration: InputDecoration(labelText: l.mobNumber),
                validator: req,
              ),
              const SizedBox(height: KsSpace.s3),
              TextFormField(
                controller: _country,
                textCapitalization: TextCapitalization.characters,
                maxLength: 2,
                decoration: InputDecoration(labelText: l.mobCountry),
                validator: req,
              ),
            ] else ...[
              TextFormField(controller: _title, decoration: InputDecoration(labelText: l.ecoOptional(l.mobTitleField))),
              const SizedBox(height: KsSpace.s3),
              TextFormField(controller: _issuer, decoration: InputDecoration(labelText: l.mobIssuer), validator: req),
              const SizedBox(height: KsSpace.s3),
              TextFormField(controller: _number, decoration: InputDecoration(labelText: l.ecoOptional(l.mobNumber))),
              if (_kind == 'language_test') ...[
                const SizedBox(height: KsSpace.s3),
                TextFormField(controller: _score, decoration: InputDecoration(labelText: l.ecoOptional(l.mobScore))),
              ],
            ],
            const SizedBox(height: KsSpace.s3),
            DateField(label: l.ecoOptional(l.credIssuedOn), text: dateText(_issued), onTap: () => _date(false)),
            const SizedBox(height: KsSpace.s3),
            DateField(
              label: l.ecoOptional(l.credExpiresOn),
              text: dateText(_expires),
              icon: LucideIcons.calendarClock,
              onTap: () => _date(true),
            ),
            const SizedBox(height: KsSpace.s4),
            DocumentPhotoPicker(label: l.credPhoto, path: _photo, onChanged: (p) => setState(() => _photo = p)),
            const SizedBox(height: KsSpace.s6),
            FilledButton(
              key: const Key('mobility_save'),
              onPressed: _busy ? null : _save,
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
