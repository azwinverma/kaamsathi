import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/eco.dart';
import '../../../../core/widgets/signature/signature.dart';
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

  void _newShare() =>
      showModalBottomSheet<void>(context: context, isScrollControlled: true, builder: (_) => const _NewShareSheet());

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final value = ref.watch(passportProvider);
    final offline = value.value?.fromCache ?? true;
    return Scaffold(
      appBar: AppBar(
        title: Text(l.passportTitle),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: KsSpace.s3),
            child: FilledButton.icon(
              key: const Key('passport_share'),
              style: FilledButton.styleFrom(
                backgroundColor: context.ks.yellow,
                foregroundColor: context.ks.onAccentFill,
                minimumSize: const Size(KsSize.touchTarget, KsSize.touchTarget),
                padding: const EdgeInsets.symmetric(horizontal: 14),
              ),
              onPressed: offline || !value.hasValue ? null : _newShare,
              icon: const Icon(LucideIcons.share2, size: 18),
              label: Text(l.passportShare),
            ),
          ),
        ],
      ),
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
                PassportCard(payload: p.payload, code: p.publicCode),
                const SizedBox(height: KsSpace.s4),
                PassportPreview(payload: p.payload),
                const SizedBox(height: KsSpace.s3),
                InfoNote(
                  key: const Key('passport_privacy_note'),
                  text: l.passportPrivacyNote,
                  icon: LucideIcons.lock,
                  tone: Tone.neutral,
                ),
                const SizedBox(height: KsSpace.s4),
                Text(l.passportIntro, style: t.bodyMedium),
                const SizedBox(height: KsSpace.s3),
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

/// Top skill's NSTB level label, if any (e.g. "NSTB Level 2").
String? _topNstb(AppLocalizations l, PassportPayload p, String lang) {
  for (final s in p.skills) {
    final label = nstbLabel(l, s.nstbLevel, lang);
    if (label.isNotEmpty) return 'NSTB $label';
  }
  return null;
}

/// The Passport hero card (B-Passport): skill gradient, spray-dot grain,
/// सीप lettering, cut-paper photo, name, trade and the verified chips.
/// Components: [CutPaperFrame], [MuralLettering], [DotTexturePainter].
class PassportCard extends StatelessWidget {
  const PassportCard({super.key, required this.payload, this.code});

  final PassportPayload payload;
  final String? code;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final p = payload;
    final rungs = ladderRungsForLevel(p.verificationLevel);
    final nstb = _topNstb(l, p, lang);
    final where = [
      if (p.tradePrimary != null) p.tradePrimary!.name(lang),
      if (p.districts.isNotEmpty) p.districts.first,
    ].join(' · ');
    const onCard = KsMural.onGround;

    Widget chip(String label, {bool yellow = false}) => Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: yellow ? KsMural.strokeYellow : KsMural.paper,
        borderRadius: BorderRadius.circular(KsRadius.pill),
      ),
      child: Text(label, style: t.labelSmall?.copyWith(color: KsPalette.accentOnFill, fontWeight: FontWeight.w700)),
    );

    return Container(
      key: const Key('passport_card'),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(KsRadius.sheet),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: KsMural.passportGradient,
        ),
      ),
      child: Stack(
        children: [
          const Positioned.fill(child: ExcludeSemantics(child: CustomPaint(painter: DotTexturePainter()))),
          const Positioned(right: -6, bottom: -26, child: MuralLettering('सीप', fontSize: 96, shadowOffset: 5)),
          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    CutPaperFrame(
                      showTape: false,
                      child: WorkerPhoto(name: p.name, url: p.photoUrl, missingLabel: l.passportPhotoMissing),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (code != null)
                            Text(code!.toUpperCase(), style: t.labelSmall?.copyWith(color: onCard, letterSpacing: 1.2)),
                          Text(p.name, style: t.titleLarge?.copyWith(color: onCard, fontWeight: FontWeight.w700)),
                          if (where.isNotEmpty)
                            Text(where, style: t.bodyMedium?.copyWith(color: onCard, fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: KsSpace.s4),
                Wrap(
                  spacing: KsSpace.s2,
                  runSpacing: KsSpace.s2,
                  children: [
                    if (p.identity['citizenship'] ?? false) chip(l.trustLevel1),
                    if (nstb != null) chip(nstb),
                    chip(
                      l.ladderChipShort(localizeDigits('$rungs', lang), localizeDigits('$kLadderRungs', lang)),
                      yellow: true,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Verified details under the card: skill ladder, credential timeline,
/// identity checks and work record.
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
    final rungs = ladderRungsForLevel(p.verificationLevel);
    final labels = ladderLabels(l);
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
    Widget marker(Color color) => Padding(
      padding: const EdgeInsets.only(top: 5),
      child: Transform.rotate(
        angle: 0.785,
        child: Container(
          width: 11,
          height: 11,
          decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(3)),
        ),
      ),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionCard(
          title: l.ladderTitle,
          trailing: ScoreRing(score: p.reliabilityScore, size: 48),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SkillLadder(earned: rungs),
              const SizedBox(height: KsSpace.s2),
              Text(
                '${l.trustLevelN(localizeDigits('${p.verificationLevel}', lang))} · ${trustLevelLabel(l, p.verificationLevel)}',
                style: t.labelMedium?.copyWith(color: c.successText),
              ),
              if (rungs < kLadderRungs) Text(l.ladderNext(labels[rungs]), style: t.bodyMedium),
            ],
          ),
        ),
        const SizedBox(height: KsSpace.s4),
        SectionCard(
          key: const Key('passport_timeline'),
          title: l.ppTimeline,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (final (i, cr) in p.credentials.indexed)
                Padding(
                  padding: const EdgeInsets.only(bottom: KsSpace.s3),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      marker(i.isEven ? c.coral : c.teal),
                      const SizedBox(width: KsSpace.s3),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(cr.title, style: t.titleSmall),
                            Text(
                              [
                                if (cr.issuer?.isNotEmpty ?? false) cr.issuer!,
                                if (cr.issuedOn != null) formatBsOrAd(cr.issuedOnBs, cr.issuedOn, lang),
                                l.credStatusVerified,
                              ].join(' · '),
                              style: t.bodySmall,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              for (final s in p.skills)
                Padding(
                  padding: const EdgeInsets.only(bottom: KsSpace.s3),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      marker(c.actionPrimary),
                      const SizedBox(width: KsSpace.s3),
                      Expanded(
                        child: Text(
                          [
                            s.trade.name(lang),
                            l.ecoYears(formatNumber(s.years, lang: lang)),
                            nstbLabel(l, s.nstbLevel, lang),
                          ].where((x) => x.isNotEmpty).join(' · '),
                          style: t.bodyMedium,
                        ),
                      ),
                    ],
                  ),
                ),
              if (p.credentials.isEmpty && p.skills.isEmpty) Text(l.ppTimelineEmpty, style: t.bodyMedium),
              const Divider(),
              KeyValueRow(label: l.ppEmployers, value: formatNumber(p.verifiedEmployers, lang: lang)),
              KeyValueRow(label: l.ppMonths, value: formatNumber(p.totalMonths, lang: lang)),
              KeyValueRow(label: l.ppJobsDone, value: formatNumber(p.completedJobs, lang: lang)),
              if (p.attendanceRate != null)
                KeyValueRow(label: l.ppAttendance, value: formatPercent(p.attendanceRate!, lang)),
            ],
          ),
        ),
        const SizedBox(height: KsSpace.s4),
        SectionCard(
          title: l.passportPreview,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
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
              const SizedBox(height: KsSpace.s3),
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
        ),
      ],
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
