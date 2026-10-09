import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/flags.dart';
import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/router/router.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/eco.dart';
import '../../../../core/widgets/photo_picker.dart';
import '../trust_data.dart';
import 'disputes_screen.dart';

/// One complaint: status timeline, details, decision, evidence (list + add
/// photo) and appeal.
///
/// [party] picks the endpoints: the worker on the case (incl. a Sipalu on a
/// booking dispute) uses `/me/disputes/{id}`, the Ghardhani on a booking
/// dispute `/me/booking-disputes/{id}` (+ `/evidence`, `/appeal`).
/// [initial] is the dispute just raised or already loaded (e.g. from a
/// booking), shown when the server cannot be read.
class DisputeDetailScreen extends ConsumerWidget {
  const DisputeDetailScreen({super.key, required this.id, this.initial, this.party = DisputeParty.worker});
  final String id;
  final Dispute? initial;
  final DisputeParty party;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final first = initial;
    final v = ref.watch(disputeDetailProvider(party, id));
    final value = v.hasError && first != null ? AsyncData(first) : v;
    return Scaffold(
      appBar: AppBar(title: Text(l.disputeDetailTitle)),
      body: RefreshIndicator(
        onRefresh: () async {
          invalidateDispute(ref, party, id);
          ref.invalidate(evidenceListProvider(party, id));
          try {
            await ref.read(disputeDetailProvider(party, id).future);
          } catch (_) {}
        },
        child: FeatureAsyncBody<Dispute>(
          value: value,
          onRetry: () => invalidateDispute(ref, party, id),
          data: (d) => _Body(dispute: d, party: party),
        ),
      ),
    );
  }
}

class _Body extends ConsumerWidget {
  const _Body({required this.dispute, required this.party});
  final Dispute dispute;
  final DisputeParty party;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final d = dispute;
    final (label, tone) = disputeStatus(l, d);
    final evidenceOn = ref.watch(flagOnProvider(FlagKeys.disputeEvidence));
    final appealOn = ref.watch(flagOnProvider(FlagKeys.disputeAppeal));
    final ghardhani = party == DisputeParty.ghardhani;
    final bookingId = d.bookingId;
    return ListView(
      padding: const EdgeInsets.all(KsSpace.page),
      children: [
        SectionCard(
          title: (d.kindLabel?.isNotEmpty ?? false) ? d.kindLabel! : disputeKindLabel(l, d.kind),
          trailing: StatusBadge(key: const Key('dispute_status'), label: label, tone: tone),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (d.organization != null) Text(d.organization!.name, style: t.bodySmall),
              if (d.bookingCode != null)
                InkWell(
                  key: const Key('dispute_booking'),
                  onTap:
                      bookingId == null
                          ? null
                          : () => context.push(ghardhani ? Routes.gharBooking(bookingId) : Routes.sipaluJob(bookingId)),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: KsSpace.s1),
                    child: Text(
                      l.disputeBookingRef(d.bookingCode!),
                      style: t.labelLarge?.copyWith(color: Theme.of(context).colorScheme.primary),
                    ),
                  ),
                ),
              if (d.attendanceDate != null)
                Text(formatBsOrAd(d.attendanceDateBs, d.attendanceDate, lang), style: t.bodySmall),
              const SizedBox(height: KsSpace.s2),
              Text(d.description, style: t.bodyMedium),
              if (d.employerNote?.isNotEmpty ?? false) ...[
                const SizedBox(height: KsSpace.s3),
                Text(l.disputeEmployerNote, style: t.labelMedium),
                Text(d.employerNote!, style: t.bodyMedium),
              ],
              if (d.resolutionNote?.isNotEmpty ?? false) ...[
                const SizedBox(height: KsSpace.s3),
                Text(l.disputeResolution, style: t.labelMedium),
                Text(d.resolutionNote!, key: const Key('dispute_decision'), style: t.bodyMedium),
              ],
              if (d.raisedAt != null) ...[
                const SizedBox(height: KsSpace.s2),
                Text(l.disputeRaisedOn(formatBsDateTime(d.raisedAt, lang)), style: t.bodySmall),
              ],
            ],
          ),
        ),
        const SizedBox(height: KsSpace.s4),
        SectionCard(title: l.disputeProgress, child: DisputeTimelineView(dispute: d)),
        if (ghardhani && !d.isClosed) ...[
          const SizedBox(height: KsSpace.s4),
          InfoNote(key: const Key('dispute_support_note'), icon: LucideIcons.headset, text: l.blDisputeSupportNote),
        ],
        if (appealOn && (d.appeal != null || d.canAppeal)) ...[
          const SizedBox(height: KsSpace.s4),
          _AppealCard(dispute: d, party: party),
        ],
        if (evidenceOn) ...[const SizedBox(height: KsSpace.s4), _EvidenceCard(dispute: d, party: party)],
      ],
    );
  }
}

/// Raised → responded → decision → appeal, ticked as each happens.
class DisputeTimelineView extends StatelessWidget {
  const DisputeTimelineView({super.key, required this.dispute});
  final Dispute dispute;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final c = context.ks;
    final t = Theme.of(context).textTheme;
    final steps = disputeTimeline(dispute);
    String label(DisputeStep s) => switch (s.kind) {
      DisputeStepKind.raised => l.disputeStepRaised,
      DisputeStepKind.responded => l.disputeStepResponded,
      DisputeStepKind.decision => s.done ? l.disputeStepDecided : l.disputeStepAwaitingDecision,
      DisputeStepKind.appealed => l.disputeStepAppealed,
      DisputeStepKind.appealDecision => s.done ? l.disputeStepAppealDecided : l.disputeStepAwaitingAppeal,
    };
    return Column(
      key: const Key('dispute_timeline'),
      children: [
        for (final (i, s) in steps.indexed)
          Semantics(
            label: label(s),
            excludeSemantics: true,
            child: Row(
              key: Key('dispute_step_${s.kind.name}'),
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Column(
                  children: [
                    Container(
                      width: 18,
                      height: 18,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: s.done ? c.verified : c.surface,
                        border: Border.all(color: s.done ? c.verified : c.borderStrong, width: 2),
                      ),
                      child: s.done ? Icon(LucideIcons.check, size: 11, color: c.surface) : null,
                    ),
                    if (i < steps.length - 1)
                      Container(width: 2, height: 22, color: steps[i + 1].done ? c.verified : c.border),
                  ],
                ),
                const SizedBox(width: KsSpace.s3),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Text.rich(
                      TextSpan(
                        text: label(s),
                        style: t.bodyMedium?.copyWith(color: s.done ? null : c.textMuted),
                        children: [
                          if (s.at != null)
                            TextSpan(
                              text: '  ${formatBsDateTime(s.at, lang)}',
                              style: t.bodySmall?.copyWith(color: c.textMuted),
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _AppealCard extends ConsumerStatefulWidget {
  const _AppealCard({required this.dispute, required this.party});
  final Dispute dispute;
  final DisputeParty party;

  @override
  ConsumerState<_AppealCard> createState() => _AppealCardState();
}

class _AppealCardState extends ConsumerState<_AppealCard> {
  bool _busy = false;

  Future<void> _appeal() async {
    final l = context.l10n;
    final reason = await showDialog<String>(context: context, builder: (_) => const _AppealDialog());
    if (reason == null || !mounted) return;
    setState(() => _busy = true);
    try {
      await ref.read(trustRepositoryProvider).appeal(widget.dispute.id, reason, party: widget.party);
      invalidateDispute(ref, widget.party, widget.dispute.id);
      if (mounted) showSnack(context, l.appealSent);
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
    final d = widget.dispute;
    final a = d.appeal;
    return SectionCard(
      key: const Key('appeal_card'),
      title: l.appealSection,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (a != null) ...[
            Align(
              alignment: Alignment.centerLeft,
              child: StatusBadge(
                label: switch (a.outcome) {
                  'upheld' => l.appealUpheld,
                  'overturned' => l.appealOverturned,
                  _ => l.appealWaiting,
                },
                tone: a.outcome == null ? Tone.warning : (a.outcome == 'overturned' ? Tone.success : Tone.neutral),
              ),
            ),
            const SizedBox(height: KsSpace.s2),
            Text(a.reason, style: t.bodyMedium),
            if (a.appealedAt != null) Text(formatBsDateTime(a.appealedAt, lang), style: t.bodySmall),
            if (a.resolutionNote?.isNotEmpty ?? false) ...[
              const SizedBox(height: KsSpace.s2),
              Text(l.disputeResolution, style: t.labelMedium),
              Text(a.resolutionNote!, style: t.bodyMedium),
            ],
          ] else if (d.canAppeal) ...[
            if (d.appealDeadline != null)
              Text(
                l.appealUntil(formatBsDateTime(d.appealDeadline, lang)),
                key: const Key('appeal_deadline'),
                style: t.bodyMedium,
              ),
            const SizedBox(height: KsSpace.s2),
            Text(l.appealHint, style: t.bodySmall),
            const SizedBox(height: KsSpace.s3),
            FilledButton.icon(
              key: const Key('appeal_button'),
              onPressed: _busy ? null : _appeal,
              icon: const Icon(LucideIcons.scale),
              label: Text(l.appealButton),
            ),
          ],
        ],
      ),
    );
  }
}

class _AppealDialog extends StatefulWidget {
  const _AppealDialog();

  @override
  State<_AppealDialog> createState() => _AppealDialogState();
}

class _AppealDialogState extends State<_AppealDialog> {
  final _c = TextEditingController();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return AlertDialog(
      title: Text(l.appealButton),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l.appealHint),
            const SizedBox(height: KsSpace.s3),
            TextField(
              key: const Key('appeal_reason'),
              controller: _c,
              minLines: 3,
              maxLines: 6,
              maxLength: 2000,
              decoration: InputDecoration(labelText: l.appealReason, alignLabelWithHint: true),
              onChanged: (_) => setState(() {}),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: Text(l.commonCancel)),
        FilledButton(
          key: const Key('appeal_confirm'),
          onPressed: _c.text.trim().length < 5 ? null : () => Navigator.pop(context, _c.text.trim()),
          child: Text(l.ecoSubmit),
        ),
      ],
    );
  }
}

class _EvidenceCard extends ConsumerWidget {
  const _EvidenceCard({required this.dispute, required this.party});
  final Dispute dispute;
  final DisputeParty party;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final d = dispute;
    final value = ref.watch(evidenceListProvider(party, d.id));
    return SectionCard(
      key: const Key('evidence_card'),
      title: l.evidenceTitle,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          FeatureAsyncSection<List<DisputeEvidence>>(
            value: value,
            onRetry: () => ref.invalidate(evidenceListProvider(party, d.id)),
            data:
                (items) => Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (items.isEmpty) Text(l.evidenceEmpty, style: t.bodyMedium),
                    for (final e in items)
                      ListTile(
                        key: Key('evidence_${e.id}'),
                        contentPadding: EdgeInsets.zero,
                        leading: Icon(e.isPdf ? LucideIcons.fileText : LucideIcons.image),
                        title: Text(
                          (e.note?.isNotEmpty ?? false) ? e.note! : (e.isPdf ? l.evidencePdf : l.evidencePhoto),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        subtitle: Text(
                          [
                            if (e.partyLabel?.isNotEmpty ?? false) e.partyLabel!,
                            formatBsDateTime(e.createdAt, lang),
                          ].where((s) => s.isNotEmpty).join(' · '),
                        ),
                        trailing: const Icon(LucideIcons.externalLink, size: 18),
                        onTap:
                            e.fileUrl.isEmpty
                                ? null
                                : () => downloadAndOpen(
                                  context,
                                  ref,
                                  apiPath: e.fileUrl,
                                  fileName: 'evidence-${e.id}.${e.isPdf ? 'pdf' : 'jpg'}',
                                  mimeType: e.isPdf ? 'application/pdf' : 'image/*',
                                ),
                      ),
                    if (d.canAddEvidence && items.length < 10) ...[
                      const SizedBox(height: KsSpace.s2),
                      OutlinedButton.icon(
                        key: const Key('evidence_add'),
                        onPressed:
                            () => Navigator.of(context).push(
                              MaterialPageRoute<void>(
                                fullscreenDialog: true,
                                builder: (_) => AddEvidenceScreen(disputeId: d.id, party: party),
                              ),
                            ),
                        icon: const Icon(LucideIcons.paperclip),
                        label: Text(l.evidenceAdd),
                      ),
                    ],
                  ],
                ),
          ),
        ],
      ),
    );
  }
}

/// Photo (camera/gallery, ≤ 10 MB) + optional note → multipart upload.
class AddEvidenceScreen extends ConsumerStatefulWidget {
  const AddEvidenceScreen({super.key, required this.disputeId, this.party = DisputeParty.worker});
  final String disputeId;
  final DisputeParty party;

  @override
  ConsumerState<AddEvidenceScreen> createState() => _AddEvidenceScreenState();
}

class _AddEvidenceScreenState extends ConsumerState<AddEvidenceScreen> {
  String? _path;
  final _note = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _upload() async {
    final l = context.l10n;
    final path = _path;
    if (path == null) return;
    setState(() => _busy = true);
    try {
      await ref
          .read(trustRepositoryProvider)
          .addEvidence(widget.disputeId, path: path, note: _note.text, party: widget.party);
      ref.invalidate(evidenceListProvider(widget.party, widget.disputeId));
      invalidateDispute(ref, widget.party, widget.disputeId);
      if (!mounted) return;
      showSnack(context, l.evidenceUploaded);
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
    return Scaffold(
      appBar: AppBar(title: Text(l.evidenceAdd)),
      body: ListView(
        padding: const EdgeInsets.all(KsSpace.page),
        children: [
          InfoNote(text: l.evidenceHint),
          const SizedBox(height: KsSpace.s4),
          DocumentPhotoPicker(
            label: l.evidencePhoto,
            path: _path,
            onChanged: (p) => setState(() => _path = p),
            maxBytes: evidenceMaxBytes,
            tooBigMessage: l.evidenceTooBig,
          ),
          const SizedBox(height: KsSpace.s4),
          TextField(
            key: const Key('evidence_note'),
            controller: _note,
            maxLength: 500,
            maxLines: 3,
            minLines: 1,
            decoration: InputDecoration(labelText: l.ecoOptional(l.evidenceNote)),
          ),
          const SizedBox(height: KsSpace.s4),
          FilledButton.icon(
            key: const Key('evidence_upload'),
            onPressed: _busy || _path == null ? null : _upload,
            icon:
                _busy
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(LucideIcons.upload),
            label: Text(l.evidenceUpload),
          ),
        ],
      ),
    );
  }
}
