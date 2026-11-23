import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/eco.dart';
import '../../employment/employment_data.dart';
import '../my_leave_data.dart';

(String, Tone) leaveStatus(AppLocalizations l, String status) => switch (status) {
  'approved' => (l.myLeaveStatusApproved, Tone.success),
  'rejected' => (l.myLeaveStatusRejected, Tone.danger),
  'cancelled' => (l.myLeaveStatusCancelled, Tone.neutral),
  _ => (l.myLeaveStatusPending, Tone.warning),
};

/// Worker: my leave (बिदा) requests, with "Request leave" and cancel for pending ones.
class MyLeaveScreen extends ConsumerWidget {
  const MyLeaveScreen({super.key});

  Future<void> _openRequest(BuildContext context) =>
      Navigator.of(context).push<bool>(MaterialPageRoute(builder: (_) => const LeaveRequestScreen()));

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final value = ref.watch(myLeavesProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.myLeaveTitle)),
      floatingActionButton: FloatingActionButton.extended(
        key: const Key('leave_new'),
        onPressed: () => _openRequest(context),
        icon: const Icon(LucideIcons.plus),
        label: Text(l.myLeaveRequest),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(myLeavesProvider);
          try {
            await ref.read(myLeavesProvider.future);
          } catch (_) {}
        },
        child: FeatureAsyncBody<List<LeaveRequest>>(
          value: value,
          onRetry: () => ref.invalidate(myLeavesProvider),
          data:
              (items) => ListView(
                // Room below the last card for the floating button.
                padding: const EdgeInsets.fromLTRB(KsSpace.page, KsSpace.page, KsSpace.page, 96),
                children: [
                  Text(l.myLeaveSubtitle, style: Theme.of(context).textTheme.bodyMedium),
                  const SizedBox(height: KsSpace.s3),
                  if (items.isEmpty) EmptyState(icon: LucideIcons.calendarOff, message: l.myLeaveEmpty),
                  for (final it in items) _MyLeaveCard(key: Key('leave_${it.id}'), item: it),
                ],
              ),
        ),
      ),
    );
  }
}

class _MyLeaveCard extends ConsumerStatefulWidget {
  const _MyLeaveCard({super.key, required this.item});
  final LeaveRequest item;

  @override
  ConsumerState<_MyLeaveCard> createState() => _MyLeaveCardState();
}

class _MyLeaveCardState extends ConsumerState<_MyLeaveCard> {
  bool _busy = false;

  Future<void> _cancel() async {
    final l = context.l10n;
    final ok = await showDialog<bool>(
      context: context,
      builder:
          (ctx) => AlertDialog(
            title: Text(l.myLeaveCancelTitle),
            content: Text(l.myLeaveCancelBody),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l.myLeaveKeep)),
              FilledButton(
                key: const Key('leave_cancel_confirm'),
                style: destructiveFilledStyle(ctx),
                onPressed: () => Navigator.pop(ctx, true),
                child: Text(l.myLeaveCancel),
              ),
            ],
          ),
    );
    if (ok != true || !mounted) return;
    setState(() => _busy = true);
    try {
      await ref.read(myLeaveRepositoryProvider).cancel(widget.item.id);
      ref.invalidate(myLeavesProvider);
      if (mounted) showSnack(context, l.myLeaveCancelled);
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
    final (label, tone) = leaveStatus(l, it.status);
    final from = formatBsOrAd(it.fromDateBs, it.fromDate, lang);
    final to = formatBsOrAd(it.toDateBs, it.toDate, lang);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(KsSpace.s4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: Text(leaveTypeLabel(l, it.leaveType), style: t.titleSmall)),
                StatusBadge(label: label, tone: tone),
              ],
            ),
            if (it.organizationName?.isNotEmpty ?? false) Text(it.organizationName!, style: t.bodySmall),
            const SizedBox(height: KsSpace.s2),
            Text(
              '${from == to ? from : '$from – $to'} · ${l.leaveDays(formatNumber(it.days, lang: lang))}',
              style: t.bodyLarge?.copyWith(fontWeight: FontWeight.w600),
            ),
            if (it.reason?.isNotEmpty ?? false) ...[
              const SizedBox(height: KsSpace.s1),
              Text(it.reason!, style: t.bodyMedium),
            ],
            if (it.decisionNote?.isNotEmpty ?? false) ...[
              const SizedBox(height: KsSpace.s1),
              Text(l.corrNote(it.decisionNote!), style: t.bodySmall),
            ],
            if (it.isPending) ...[
              const SizedBox(height: KsSpace.s3),
              Align(
                alignment: Alignment.centerRight,
                child: OutlinedButton.icon(
                  key: Key('leave_cancel_${it.id}'),
                  onPressed: _busy ? null : _cancel,
                  icon: const Icon(LucideIcons.x),
                  label: Text(l.myLeaveCancel),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Worker: "Request leave" — job, type, first/last day (shown in BS), reason.
class LeaveRequestScreen extends ConsumerStatefulWidget {
  const LeaveRequestScreen({super.key});

  @override
  ConsumerState<LeaveRequestScreen> createState() => _LeaveRequestScreenState();
}

class _LeaveRequestScreenState extends ConsumerState<LeaveRequestScreen> {
  String? _employmentId;
  String? _type;
  late String _from = isoDate(nepalToday());
  late String _to = _from;
  final _reason = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _pick(bool last) async {
    final today = nepalToday();
    final first = last ? parseIsoDate(_from)! : today.subtract(const Duration(days: 30));
    final current = parseIsoDate(last ? _to : _from)!;
    final d = await showDatePicker(
      context: context,
      initialDate: current.isBefore(first) ? first : current,
      firstDate: first,
      lastDate: today.add(const Duration(days: 365)),
    );
    if (d == null || !mounted) return;
    setState(() {
      if (last) {
        _to = isoDate(d);
      } else {
        _from = isoDate(d);
        if (_to.compareTo(_from) < 0) _to = _from;
      }
    });
  }

  Future<void> _submit(String employmentId) async {
    final l = context.l10n;
    setState(() => _busy = true);
    try {
      await ref
          .read(myLeaveRepositoryProvider)
          .request(
            leaveRequestBody(
              employmentId: employmentId,
              leaveType: _type!,
              fromDate: _from,
              toDate: _to,
              reason: _reason.text,
            ),
          );
      ref.invalidate(myLeavesProvider);
      if (!mounted) return;
      showSnack(context, l.myLeaveSent);
      Navigator.of(context).pop(true);
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
    final jobsValue = ref.watch(myEmploymentsProvider);
    final jobs = (jobsValue.value ?? const <MyEmployment>[]).where((e) => e.status == 'active').toList();
    final employmentId =
        jobs.any((j) => j.id == _employmentId) ? _employmentId : (jobs.length == 1 ? jobs.first.id : null);
    final days = leaveDayCount(_from, _to);
    String dayLabel(String label, String iso) => '$label: ${formatBsOrAd(null, iso, lang)}';
    return Scaffold(
      appBar: AppBar(title: Text(l.myLeaveRequest)),
      body: ListView(
        padding: const EdgeInsets.all(KsSpace.page),
        children: [
          if (jobsValue.isLoading && !jobsValue.hasValue)
            const LinearProgressIndicator()
          else if (jobs.isEmpty)
            InfoNote(key: const Key('leave_no_job'), text: l.myLeaveNoJob, tone: Tone.warning)
          else if (jobs.length > 1) ...[
            DropdownButtonFormField<String>(
              key: const Key('leave_job'),
              value: employmentId,
              isExpanded: true,
              decoration: InputDecoration(labelText: l.corrJob),
              items: [
                for (final j in jobs)
                  DropdownMenuItem(value: j.id, child: Text(j.orgName(lang), overflow: TextOverflow.ellipsis)),
              ],
              onChanged: (v) => setState(() => _employmentId = v),
            ),
          ] else
            Text(jobs.first.orgName(lang), style: t.titleMedium),
          const SizedBox(height: KsSpace.s4),
          Text(l.myLeaveType, style: t.titleSmall),
          const SizedBox(height: KsSpace.s2),
          Wrap(
            spacing: KsSpace.s2,
            runSpacing: KsSpace.s2,
            children: [
              for (final lt in leaveTypes)
                ChoiceChip(
                  key: Key('leave_type_$lt'),
                  label: Text(leaveTypeLabel(l, lt)),
                  selected: _type == lt,
                  onSelected: (_) => setState(() => _type = lt),
                ),
            ],
          ),
          const SizedBox(height: KsSpace.s4),
          OutlinedButton.icon(
            key: const Key('leave_from'),
            onPressed: () => _pick(false),
            icon: const Icon(LucideIcons.calendar),
            label: Text(dayLabel(l.myLeaveFrom, _from)),
          ),
          const SizedBox(height: KsSpace.s2),
          OutlinedButton.icon(
            key: const Key('leave_to'),
            onPressed: () => _pick(true),
            icon: const Icon(LucideIcons.calendar),
            label: Text(dayLabel(l.myLeaveTo, _to)),
          ),
          const SizedBox(height: KsSpace.s2),
          Text(l.leaveDays(formatNumber(days, lang: lang)), key: const Key('leave_days'), style: t.bodyMedium),
          const SizedBox(height: KsSpace.s4),
          TextField(
            key: const Key('leave_reason'),
            controller: _reason,
            minLines: 2,
            maxLines: 5,
            maxLength: 1000,
            decoration: InputDecoration(
              labelText: l.ecoOptional(l.myLeaveReason),
              hintText: l.myLeaveReasonHint,
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: KsSpace.s4),
          FilledButton(
            key: const Key('leave_submit'),
            onPressed: _busy || employmentId == null || _type == null || days == 0 ? null : () => _submit(employmentId),
            child:
                _busy
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                    : Text(l.ecoSubmit),
          ),
        ],
      ),
    );
  }
}
