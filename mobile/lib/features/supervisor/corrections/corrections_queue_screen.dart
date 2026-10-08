import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/l10n/l10n.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/tokens.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/eco.dart';
import '../../worker/my_hajiri/corrections_data.dart';
import '../../worker/my_hajiri/ui/corrections_screen.dart';

const _pending = 'pending';
const _decided = 'approved,rejected';

/// Supervisor: workers' hajiri correction requests for own sites
/// (the server scopes supervisors to their sites).
class CorrectionsQueueScreen extends StatelessWidget {
  const CorrectionsQueueScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: Text(l.corrQueueTitle),
          bottom: TabBar(tabs: [Tab(text: l.corrTabPending), Tab(text: l.corrTabDecided)]),
        ),
        body: const TabBarView(children: [_Queue(status: _pending), _Queue(status: _decided)]),
      ),
    );
  }
}

class _Queue extends ConsumerStatefulWidget {
  const _Queue({required this.status});
  final String status;

  @override
  ConsumerState<_Queue> createState() => _QueueState();
}

class _QueueState extends ConsumerState<_Queue> {
  /// Decided in this session (hidden from "waiting" until reload).
  final Set<String> _done = {};
  String? _busy;

  Future<void> _decide(AttendanceCorrection c, {required bool approve}) async {
    final l = context.l10n;
    final note = await showDialog<String>(context: context, builder: (_) => _NoteDialog(approve: approve));
    if (note == null || !mounted) return;
    setState(() => _busy = c.id);
    try {
      final repo = ref.read(correctionsRepositoryProvider);
      if (approve) {
        await repo.approve(c.id, note: note);
      } else {
        await repo.reject(c.id, note: note);
      }
      if (!mounted) return;
      setState(() => _done.add(c.id));
      showSnack(context, approve ? l.corrApproved : l.corrRejected);
      ref.invalidate(correctionQueueProvider(_decided));
    } catch (e) {
      if (mounted) showSnack(context, errorText(context, e), error: true);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final pending = widget.status == _pending;
    final value = ref.watch(correctionQueueProvider(widget.status));
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(correctionQueueProvider(widget.status));
        try {
          await ref.read(correctionQueueProvider(widget.status).future);
        } catch (_) {}
        if (mounted) setState(_done.clear);
      },
      child: FeatureAsyncBody<List<AttendanceCorrection>>(
        value: value,
        onRetry: () => ref.invalidate(correctionQueueProvider(widget.status)),
        data: (all) {
          final items = pending ? all.where((c) => !_done.contains(c.id)).toList() : all;
          return ListView(
            padding: const EdgeInsets.all(KsSpace.page),
            children: [
              if (pending) ...[
                Text(l.corrQueueSubtitle, style: Theme.of(context).textTheme.bodyMedium),
                const SizedBox(height: KsSpace.s3),
              ],
              if (items.isEmpty) EmptyState(icon: LucideIcons.calendarCheck, message: l.corrEmpty),
              for (final c in items)
                Card(
                  key: Key('queue_${c.id}'),
                  child: Padding(
                    padding: const EdgeInsets.all(KsSpace.s4),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        CorrectionSummary(c: c, showWorker: true),
                        if (pending && c.isPending) ...[
                          const SizedBox(height: KsSpace.s3),
                          Row(
                            children: [
                              Expanded(
                                child: OutlinedButton(
                                  key: Key('reject_${c.id}'),
                                  onPressed: _busy == null ? () => _decide(c, approve: false) : null,
                                  child: Text(l.corrReject, textAlign: TextAlign.center),
                                ),
                              ),
                              const SizedBox(width: KsSpace.s2),
                              Expanded(
                                child: FilledButton(
                                  key: Key('approve_${c.id}'),
                                  onPressed: _busy == null ? () => _decide(c, approve: true) : null,
                                  child: Text(l.corrApprove, textAlign: TextAlign.center),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

/// Approve: optional note. Reject: a note for the worker is required.
/// Returns the note ('' when none) or null when cancelled.
class _NoteDialog extends StatefulWidget {
  const _NoteDialog({required this.approve});
  final bool approve;

  @override
  State<_NoteDialog> createState() => _NoteDialogState();
}

class _NoteDialogState extends State<_NoteDialog> {
  final _c = TextEditingController();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final approve = widget.approve;
    final ok = approve || _c.text.trim().isNotEmpty;
    return AlertDialog(
      title: Text(approve ? l.corrApproveTitle : l.corrRejectTitle),
      content: TextField(
        key: const Key('decision_note'),
        controller: _c,
        maxLength: 1000,
        maxLines: 3,
        minLines: 1,
        decoration: InputDecoration(labelText: approve ? l.ecoOptional(l.corrNoteLabel) : l.corrRejectNote),
        onChanged: (_) => setState(() {}),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: Text(l.commonCancel)),
        FilledButton(
          key: const Key('decision_confirm'),
          style: approve ? null : destructiveFilledStyle(context),
          onPressed: ok ? () => Navigator.pop(context, _c.text.trim()) : null,
          child: Text(approve ? l.corrApprove : l.corrReject),
        ),
      ],
    );
  }
}
