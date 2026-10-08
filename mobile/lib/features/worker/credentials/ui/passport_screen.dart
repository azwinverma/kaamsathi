import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/eco.dart';
import '../../trust/ui/trust_card.dart';
import '../credentials_data.dart';
import 'credentials_screen.dart';

String sharePurposeLabel(AppLocalizations l, String p) => switch (p) {
  'job' => l.sharePurposeJob,
  'recruitment_agency' => l.sharePurposeAgency,
  'bank' => l.sharePurposeBank,
  _ => l.sharePurposeOther,
};

class PassportScreen extends ConsumerStatefulWidget {
  const PassportScreen({super.key});

  @override
  ConsumerState<PassportScreen> createState() => _PassportScreenState();
}

class _PassportScreenState extends ConsumerState<PassportScreen> {
  bool? _public;
  bool? _contact;
  bool _pdfBusy = false;

  Future<void> _toggle({bool? isPublic, bool? showContact}) async {
    final prevPublic = _public;
    final prevContact = _contact;
    setState(() {
      if (isPublic != null) _public = isPublic;
      if (showContact != null) _contact = showContact;
    });
    try {
      await ref.read(credentialsRepositoryProvider).updatePassport(isPublic: isPublic, showContact: showContact);
      if (mounted) showSnack(context, context.l10n.commonSaved);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _public = prevPublic;
        _contact = prevContact;
      });
      showSnack(context, errorText(context, e), error: true);
    }
  }

  Future<void> _refresh() async {
    ref.invalidate(passportProvider);
    ref.invalidate(passportSharesProvider);
    setState(() {
      _public = null;
      _contact = null;
    });
    try {
      await ref.read(passportProvider.future);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final value = ref.watch(passportProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.passportTitle)),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FeatureAsyncBody(
          value: value,
          onRetry: () => ref.invalidate(passportProvider),
          data: (cached) {
            final p = cached.data;
            final isPublic = _public ?? p.isPublic;
            final showContact = _contact ?? p.showContact;
            final offline = cached.fromCache;
            return ListView(
              padding: const EdgeInsets.all(KsSpace.page),
              children: [
                if (offline) const CachedNotice(),
                Text(l.passportIntro, style: t.bodyMedium),
                const SizedBox(height: KsSpace.s3),
                PassportPreview(payload: p.payload),
                const SizedBox(height: KsSpace.s4),
                Card(
                  child: Column(
                    children: [
                      SwitchListTile(
                        key: const Key('passport_public'),
                        value: isPublic,
                        onChanged: offline ? null : (v) => _toggle(isPublic: v),
                        secondary: const Icon(LucideIcons.globe),
                        title: Text(l.passportPublic),
                        subtitle: Text(l.passportPublicHint),
                      ),
                      SwitchListTile(
                        value: showContact,
                        onChanged: offline || !isPublic ? null : (v) => _toggle(showContact: v),
                        secondary: const Icon(LucideIcons.phone),
                        title: Text(l.passportShowContact),
                        subtitle: Text(l.passportShowContactHint),
                      ),
                      if (isPublic && p.publicCode != null)
                        ListTile(
                          leading: const Icon(LucideIcons.qrCode),
                          title: Text(l.passportCode(p.publicCode!)),
                          subtitle: p.publicUrl == null ? null : Text(p.publicUrl!),
                          trailing: IconButton(
                            tooltip: l.ecoCopyLink,
                            icon: const Icon(LucideIcons.copy),
                            onPressed: () => copyText(context, p.publicUrl ?? p.publicCode!),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: KsSpace.s3),
                OutlinedButton.icon(
                  onPressed:
                      _pdfBusy
                          ? null
                          : () async {
                            setState(() => _pdfBusy = true);
                            await downloadAndOpen(
                              context,
                              ref,
                              apiPath: CredentialsRepository.passportPdfPath,
                              fileName: 'skill-passport.pdf',
                            );
                            if (mounted) setState(() => _pdfBusy = false);
                          },
                  icon: const Icon(LucideIcons.fileDown),
                  label: Text(l.passportOpenPdf),
                ),
                const SizedBox(height: KsSpace.s4),
                _Shares(offline: offline),
                const SizedBox(height: KsSpace.s2),
                Text(l.shareAgencyNote, style: t.bodySmall),
                const SizedBox(height: KsSpace.s6),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// Read-only rendering of the verified passport payload.
class PassportPreview extends StatelessWidget {
  const PassportPreview({super.key, required this.payload});
  final PassportPayload payload;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final c = context.ks;
    final p = payload;
    Widget check(String label, bool ok) => Padding(
      padding: const EdgeInsets.only(right: KsSpace.s3),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(ok ? LucideIcons.circleCheck : LucideIcons.circle, size: 16, color: ok ? c.successText : c.textMuted),
          const SizedBox(width: 4),
          Text(label, style: t.bodySmall),
        ],
      ),
    );
    return SectionCard(
      title: l.passportPreview,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              WorkerAvatar(name: p.name, photo: p.photoUrl, size: 56),
              const SizedBox(width: KsSpace.s3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(p.name, style: t.titleMedium),
                    if (p.tradePrimary != null) Text(p.tradePrimary!.name(lang), style: t.bodyMedium),
                    if (p.districts.isNotEmpty) Text(p.districts.join(', '), style: t.bodySmall),
                    Text(
                      '${l.trustLevelN(localizeDigits('${p.verificationLevel}', lang))} · ${trustLevelLabel(l, p.verificationLevel)}',
                      style: t.labelSmall?.copyWith(color: c.successText),
                    ),
                  ],
                ),
              ),
              ScoreRing(score: p.reliabilityScore, size: 56),
            ],
          ),
          const SizedBox(height: KsSpace.s3),
          Text(l.ppIdentity, style: t.labelLarge),
          const SizedBox(height: 4),
          Wrap(
            runSpacing: 4,
            children: [
              check(l.ppCitizenship, p.identity['citizenship'] ?? false),
              check(l.ppPhone, p.identity['phone'] ?? false),
              check(l.ppAddress, p.identity['address'] ?? false),
            ],
          ),
          if (p.skills.isNotEmpty) ...[
            const SizedBox(height: KsSpace.s3),
            Text(l.ppSkills, style: t.labelLarge),
            for (final s in p.skills)
              Text(
                [
                  s.trade.name(lang),
                  l.ecoYears(formatNumber(s.years, lang: lang)),
                  nstbLabel(l, s.nstbLevel, lang),
                ].where((x) => x.isNotEmpty).join(' · '),
                style: t.bodyMedium,
              ),
          ],
          if (p.credentials.isNotEmpty) ...[
            const SizedBox(height: KsSpace.s3),
            Text(l.ppCredentials, style: t.labelLarge),
            for (final cr in p.credentials)
              Row(
                children: [
                  Icon(LucideIcons.shieldCheck, size: 16, color: c.successText),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      [cr.title, if (cr.issuer?.isNotEmpty ?? false) cr.issuer!].join(' · '),
                      style: t.bodyMedium,
                    ),
                  ),
                ],
              ),
          ],
          const SizedBox(height: KsSpace.s3),
          Text(l.ppWork, style: t.labelLarge),
          KeyValueRow(label: l.ppEmployers, value: formatNumber(p.verifiedEmployers, lang: lang)),
          KeyValueRow(label: l.ppMonths, value: formatNumber(p.totalMonths, lang: lang)),
          KeyValueRow(label: l.ppJobsDone, value: formatNumber(p.completedJobs, lang: lang)),
          if (p.attendanceRate != null)
            KeyValueRow(label: l.ppAttendance, value: formatPercent(p.attendanceRate!, lang)),
          const SizedBox(height: KsSpace.s2),
          Align(
            alignment: Alignment.centerLeft,
            child: StatusBadge(
              label: p.isAvailable ? l.ppAvailable : l.ppNotAvailable,
              tone: p.isAvailable ? Tone.success : Tone.neutral,
            ),
          ),
          if (p.expectedMonthlyWage != null)
            KeyValueRow(label: l.ppExpectedWage, value: formatMoney(p.expectedMonthlyWage, lang: lang)),
          if (p.contactPhone != null) KeyValueRow(label: l.ppPhone, value: formatPhone(p.contactPhone, lang: lang)),
          if (p.verifyUrl != null) ...[
            const SizedBox(height: KsSpace.s2),
            Text(l.ppVerifyAt, style: t.bodySmall),
            SelectableText(p.verifyUrl!, style: t.bodySmall),
          ],
        ],
      ),
    );
  }
}

class _Shares extends ConsumerWidget {
  const _Shares({required this.offline});
  final bool offline;

  Future<void> _revoke(BuildContext context, WidgetRef ref, PassportShare s) async {
    final l = context.l10n;
    if (!await confirmDialog(context, title: l.shareRevokeConfirm, confirmLabel: l.ecoRevoke, danger: true)) return;
    try {
      await ref.read(credentialsRepositoryProvider).revokeShare(s.id);
      ref.invalidate(passportSharesProvider);
      if (context.mounted) showSnack(context, l.shareRevokedMsg);
    } catch (e) {
      if (context.mounted) showSnack(context, errorText(context, e), error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final value = ref.watch(passportSharesProvider);
    final create = OutlinedButton.icon(
      onPressed:
          offline
              ? null
              : () => showModalBottomSheet<void>(
                context: context,
                isScrollControlled: true,
                builder: (_) => const _NewShareSheet(),
              ),
      icon: const Icon(LucideIcons.link, size: 18),
      label: Text(l.passportNewShare),
    );
    return SectionCard(
      title: l.passportShares,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          switch (value) {
            AsyncData(:final value) when value.isEmpty => Text(l.passportSharesEmpty, style: t.bodyMedium),
            AsyncData(:final value) => Column(
              children: [
                for (final s in value)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(LucideIcons.link),
                    title: Text(s.audienceLabel.isEmpty ? sharePurposeLabel(l, s.purpose) : s.audienceLabel),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          [
                            sharePurposeLabel(l, s.purpose),
                            l.shareViews(localizeDigits('${s.views}', lang)),
                            if (s.isActive() && s.expiresAt != null) l.ecoUntil(formatBsDateTime(s.expiresAt, lang)),
                          ].join(' · '),
                        ),
                        const SizedBox(height: 4),
                        StatusBadge(
                          label:
                              s.isRevoked
                                  ? l.shareRevoked
                                  : s.isExpired()
                                  ? l.shareExpired
                                  : l.shareActive,
                          tone: s.isActive() ? Tone.success : Tone.neutral,
                        ),
                      ],
                    ),
                    isThreeLine: true,
                    trailing:
                        s.isActive()
                            ? PopupMenuButton<String>(
                              onSelected:
                                  (a) => a == 'copy' ? copyText(context, s.url ?? '') : _revoke(context, ref, s),
                              itemBuilder:
                                  (_) => [
                                    if (s.url != null) PopupMenuItem(value: 'copy', child: Text(l.ecoCopyLink)),
                                    PopupMenuItem(value: 'revoke', child: Text(l.ecoRevoke)),
                                  ],
                            )
                            : null,
                  ),
              ],
            ),
            AsyncError(:final error) => Text(errorText(context, error), style: t.bodySmall),
            _ => const LinearProgressIndicator(),
          },
          const SizedBox(height: KsSpace.s3),
          create,
        ],
      ),
    );
  }
}

class _NewShareSheet extends ConsumerStatefulWidget {
  const _NewShareSheet();

  @override
  ConsumerState<_NewShareSheet> createState() => _NewShareSheetState();
}

class _NewShareSheetState extends ConsumerState<_NewShareSheet> {
  final _audience = TextEditingController();
  String _purpose = 'job';
  int _days = 30;
  bool _contact = false;
  bool _busy = false;

  @override
  void dispose() {
    _audience.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    final l = context.l10n;
    if (_audience.text.trim().isEmpty) {
      showSnack(context, l.ecoRequired, error: true);
      return;
    }
    setState(() => _busy = true);
    try {
      final s = await ref
          .read(credentialsRepositoryProvider)
          .createShare(audienceLabel: _audience.text, purpose: _purpose, days: _days, includeContact: _contact);
      ref.invalidate(passportSharesProvider);
      if (!mounted) return;
      Navigator.pop(context);
      if (s.url != null) await copyText(context, s.url!);
      if (mounted) showSnack(context, l.shareCreated);
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
    return Padding(
      padding: EdgeInsets.only(
        left: KsSpace.page,
        right: KsSpace.page,
        bottom: MediaQuery.viewInsetsOf(context).bottom + KsSpace.page,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l.passportNewShare, style: t.titleLarge),
            const SizedBox(height: KsSpace.s4),
            TextField(
              controller: _audience,
              decoration: InputDecoration(labelText: l.shareAudience, hintText: l.shareAudienceHint),
            ),
            const SizedBox(height: KsSpace.s3),
            Text(l.sharePurpose, style: t.titleSmall),
            const SizedBox(height: KsSpace.s2),
            Wrap(
              spacing: KsSpace.s2,
              runSpacing: KsSpace.s2,
              children: [
                for (final p in SharePurpose.all)
                  ChoiceChip(
                    label: Text(sharePurposeLabel(l, p)),
                    selected: _purpose == p,
                    onSelected: (_) => setState(() => _purpose = p),
                  ),
              ],
            ),
            if (_purpose == 'recruitment_agency') ...[
              const SizedBox(height: KsSpace.s2),
              Text(l.shareAgencyNote, style: t.bodySmall),
            ],
            const SizedBox(height: KsSpace.s3),
            Text(l.shareDays, style: t.titleSmall),
            const SizedBox(height: KsSpace.s2),
            Wrap(
              spacing: KsSpace.s2,
              children: [
                for (final d in const [7, 30, 90])
                  ChoiceChip(
                    label: Text(l.ecoDays(localizeDigits('$d', lang))),
                    selected: _days == d,
                    onSelected: (_) => setState(() => _days = d),
                  ),
              ],
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              value: _contact,
              onChanged: (v) => setState(() => _contact = v),
              title: Text(l.shareIncludeContact),
            ),
            const SizedBox(height: KsSpace.s3),
            FilledButton.icon(
              onPressed: _busy ? null : _create,
              icon: const Icon(LucideIcons.link),
              label: Text(l.passportNewShare),
            ),
          ],
        ),
      ),
    );
  }
}
