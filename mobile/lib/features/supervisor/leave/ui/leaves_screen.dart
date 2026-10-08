import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../common/inbox/inbox_screen.dart';
import '../data/leave_repository.dart';

class LeavesScreen extends StatelessWidget {
  const LeavesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: Text(l.navLeave),
          actions: const [InboxBell()],
          bottom: TabBar(tabs: [Tab(text: l.leavePending), Tab(text: l.leaveApproved), Tab(text: l.leaveRejected)]),
        ),
        body: const TabBarView(
          children: [_LeaveList(status: 'pending'), _LeaveList(status: 'approved'), _LeaveList(status: 'rejected')],
        ),
      ),
    );
  }
}

class _LeaveList extends ConsumerWidget {
  const _LeaveList({required this.status});
  final String status;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final value = ref.watch(leavesProvider(status));
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(leavesProvider(status));
        try {
          await ref.read(leavesProvider(status).future);
        } catch (_) {}
      },
      child: AsyncBody<List<LeaveRequest>>(
        value: value,
        onRetry: () => ref.invalidate(leavesProvider(status)),
        data:
            (items) =>
                items.isEmpty
                    ? ListView(children: [EmptyState(icon: LucideIcons.calendarOff, message: l.leaveEmpty)])
                    : ListView.separated(
                      padding: const EdgeInsets.all(KsSpace.page),
                      itemCount: items.length,
                      separatorBuilder: (_, _) => const SizedBox(height: KsSpace.s3),
                      itemBuilder: (_, i) => _LeaveCard(item: items[i]),
                    ),
      ),
    );
  }
}

class _LeaveCard extends ConsumerStatefulWidget {
  const _LeaveCard({required this.item});
  final LeaveRequest item;

  @override
  ConsumerState<_LeaveCard> createState() => _LeaveCardState();
}

class _LeaveCardState extends ConsumerState<_LeaveCard> {
  bool _busy = false;

  Future<void> _act(bool approve) async {
    final l = context.l10n;
    String? note;
    if (!approve) {
      final ctrl = TextEditingController();
      final ok = await showDialog<bool>(
        context: context,
        builder:
            (ctx) => AlertDialog(
              title: Text(l.leaveRejectTitle),
              content: TextField(controller: ctrl, decoration: InputDecoration(labelText: l.leaveRejectNote)),
              actions: [
                TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l.commonCancel)),
                FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: Theme.of(ctx).colorScheme.error),
                  onPressed: () => Navigator.pop(ctx, true),
                  child: Text(l.leaveReject),
                ),
              ],
            ),
      );
      note = ctrl.text;
      ctrl.dispose();
      if (ok != true) return;
    }
    setState(() => _busy = true);
    try {
      final repo = ref.read(leaveRepositoryProvider);
      if (approve) {
        await repo.approve(widget.item.id);
      } else {
        await repo.reject(widget.item.id, note: note);
      }
      if (!mounted) return;
      showSnack(context, approve ? l.leaveApprovedMsg : l.leaveRejectedMsg);
      ref.invalidate(leavesProvider);
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
    final it = widget.item;
    final from = it.fromDateBs != null ? formatBsString(it.fromDateBs, lang) : it.fromDate;
    final to = it.toDateBs != null ? formatBsString(it.toDateBs, lang) : it.toDate;
    final typeLabel = lang == 'en' || it.leaveTypeLabel == null ? leaveTypeLabel(l, it.leaveType) : it.leaveTypeLabel!;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(KsSpace.s4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                WorkerAvatar(name: it.workerName, photo: it.workerPhoto, size: 40),
                const SizedBox(width: KsSpace.s3),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(it.workerName, style: t.titleSmall),
                      if (it.designation != null) Text(it.designation!, style: t.bodySmall),
                    ],
                  ),
                ),
                StatusBadge(label: l.leaveDays(formatNumber(it.days, lang: lang)), tone: Tone.info),
              ],
            ),
            const SizedBox(height: KsSpace.s3),
            Text(typeLabel, style: t.bodyLarge?.copyWith(fontWeight: FontWeight.w600)),
            Text(from == to ? from : '$from – $to', style: t.bodyMedium),
            if (it.reason != null && it.reason!.isNotEmpty) ...[
              const SizedBox(height: KsSpace.s2),
              Text('“${it.reason!}”', style: t.bodyMedium?.copyWith(fontStyle: FontStyle.italic)),
            ],
            if (it.status == 'pending') ...[
              const SizedBox(height: KsSpace.s4),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(onPressed: _busy ? null : () => _act(false), child: Text(l.leaveReject)),
                  ),
                  const SizedBox(width: KsSpace.s3),
                  Expanded(
                    child: FilledButton(onPressed: _busy ? null : () => _act(true), child: Text(l.leaveApprove)),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
