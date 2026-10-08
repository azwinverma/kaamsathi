import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/eco.dart';
import '../../../../core/widgets/signature/signature.dart';
import '../../employment/employment_data.dart';
import '../corrections_data.dart';

(String, Tone) correctionStatus(AppLocalizations l, String status) => switch (status) {
  'approved' => (l.corrStatusApproved, Tone.success),
  'rejected' => (l.corrStatusRejected, Tone.danger),
  _ => (l.corrStatusPending, Tone.warning),
};

/// Card body shared by the worker list and the supervisor queue.
class CorrectionSummary extends StatelessWidget {
  const CorrectionSummary({super.key, required this.c, this.showWorker = false});
  final AttendanceCorrection c;
  final bool showWorker;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final (label, tone) = correctionStatus(l, c.status);
    final times = [
      if (c.requestedCheckInAt != null) '${l.corrCheckIn}: ${formatTime(c.requestedCheckInAt!.toLocal(), lang)}',
      if (c.requestedCheckOutAt != null) '${l.corrCheckOut}: ${formatTime(c.requestedCheckOutAt!.toLocal(), lang)}',
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Text(
                showWorker ? (c.workerName ?? '') : l.corrFor(formatBsOrAd(c.dateBs, c.date, lang)),
                style: t.titleSmall,
              ),
            ),
            StatusBadge(label: label, tone: tone),
          ],
        ),
        if (showWorker) Text(l.corrFor(formatBsOrAd(c.dateBs, c.date, lang)), style: t.bodySmall),
        if (!showWorker && (c.organizationName?.isNotEmpty ?? false)) Text(c.organizationName!, style: t.bodySmall),
        if (showWorker && (c.designation?.isNotEmpty ?? false)) Text(c.designation!, style: t.bodySmall),
        const SizedBox(height: KsSpace.s2),
        Text(
          l.corrChange(attendanceLabel(l, c.currentStatus), attendanceLabel(l, c.requestedStatus)),
          style: t.bodyLarge?.copyWith(fontWeight: FontWeight.w600),
        ),
        if (times.isNotEmpty) Text(times.join(' · '), style: t.bodySmall),
        const SizedBox(height: KsSpace.s1),
        Text(c.reason, style: t.bodyMedium),
        if (c.decisionNote?.isNotEmpty ?? false) ...[
          const SizedBox(height: KsSpace.s1),
          Text(l.corrNote(c.decisionNote!), style: t.bodySmall),
        ],
      ],
    );
  }
}

/// Worker: my correction requests.
class MyCorrectionsScreen extends ConsumerWidget {
  const MyCorrectionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final value = ref.watch(myCorrectionsProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.corrTitle)),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(myCorrectionsProvider);
          try {
            await ref.read(myCorrectionsProvider.future);
          } catch (_) {}
        },
        child: FeatureAsyncBody<List<AttendanceCorrection>>(
          value: value,
          onRetry: () => ref.invalidate(myCorrectionsProvider),
          data:
              (items) => ListView(
                padding: const EdgeInsets.all(KsSpace.page),
                children: [
                  Text(l.corrMenuSubtitle, style: Theme.of(context).textTheme.bodyMedium),
                  const SizedBox(height: KsSpace.s3),
                  if (items.isEmpty)
                    EmptyState(icon: LucideIcons.calendarCheck, message: l.corrEmpty, art: KsArt.supervisorHajiri),
                  for (final c in items)
                    Card(
                      key: Key('correction_${c.id}'),
                      child: Padding(padding: const EdgeInsets.all(KsSpace.s4), child: CorrectionSummary(c: c)),
                    ),
                ],
              ),
        ),
      ),
    );
  }
}

/// Is [e] employed on [isoDay]?
bool employedOn(MyEmployment e, String isoDay) {
  final d = parseIsoDate(isoDay);
  final s = parseIsoDate(e.startDate);
  final end = parseIsoDate(e.endDate);
  if (d == null) return false;
  if (s != null && d.isBefore(s)) return false;
  if (end != null && d.isAfter(end)) return false;
  return true;
}

/// Worker: "Request a correction" for one day.
class CorrectionRequestScreen extends ConsumerStatefulWidget {
  const CorrectionRequestScreen({super.key, required this.date, this.currentStatus});

  /// ISO AD date.
  final String date;
  final String? currentStatus;

  @override
  ConsumerState<CorrectionRequestScreen> createState() => _CorrectionRequestScreenState();
}

class _CorrectionRequestScreenState extends ConsumerState<CorrectionRequestScreen> {
  String? _status;
  String? _employmentId;
  TimeOfDay? _in;
  TimeOfDay? _out;
  final _reason = TextEditingController();
  final _form = GlobalKey<FormState>();
  bool _busy = false;

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _time(bool checkOut) async {
    final t = await showTimePicker(
      context: context,
      initialTime:
          (checkOut ? _out : _in) ??
          (checkOut ? const TimeOfDay(hour: 17, minute: 0) : const TimeOfDay(hour: 9, minute: 0)),
    );
    if (t != null) setState(() => checkOut ? _out = t : _in = t);
  }

  Future<void> _submit(String employmentId) async {
    final l = context.l10n;
    if (!(_form.currentState?.validate() ?? false) || _status == null) return;
    final withTimes = _status == 'present' || _status == 'half_day';
    setState(() => _busy = true);
    try {
      await ref
          .read(correctionsRepositoryProvider)
          .request(
            correctionBody(
              employmentId: employmentId,
              date: widget.date,
              requestedStatus: _status!,
              checkIn: withTimes && _in != null ? (hour: _in!.hour, minute: _in!.minute) : null,
              checkOut: withTimes && _out != null ? (hour: _out!.hour, minute: _out!.minute) : null,
              reason: _reason.text,
            ),
          );
      ref.invalidate(myCorrectionsProvider);
      if (!mounted) return;
      showSnack(context, l.corrSent);
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
    final jobs = (jobsValue.value ?? const <MyEmployment>[]).where((e) => employedOn(e, widget.date)).toList();
    final employmentId =
        jobs.any((j) => j.id == _employmentId) ? _employmentId : (jobs.length == 1 ? jobs.first.id : null);
    final withTimes = _status == 'present' || _status == 'half_day';
    String timeLabel(String label, TimeOfDay? v) =>
        v == null ? l.ecoOptional(label) : '$label: ${formatTime(DateTime(2000, 1, 1, v.hour, v.minute), lang)}';
    return Scaffold(
      appBar: AppBar(title: Text(l.corrRequest)),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.all(KsSpace.page),
          children: [
            Text(l.corrFor(formatBsOrAd(null, widget.date, lang)), style: t.titleMedium),
            Text(l.corrRecorded(attendanceLabel(l, widget.currentStatus)), style: t.bodyMedium),
            const SizedBox(height: KsSpace.s4),
            if (jobsValue.isLoading && !jobsValue.hasValue)
              const LinearProgressIndicator()
            else if (jobs.isEmpty)
              InfoNote(key: const Key('corr_no_job'), text: l.corrNoJob, tone: Tone.warning)
            else if (jobs.length > 1) ...[
              DropdownButtonFormField<String>(
                key: const Key('corr_job'),
                value: employmentId,
                isExpanded: true,
                decoration: InputDecoration(labelText: l.corrJob),
                items: [
                  for (final j in jobs)
                    DropdownMenuItem(value: j.id, child: Text(j.orgName(lang), overflow: TextOverflow.ellipsis)),
                ],
                onChanged: (v) => setState(() => _employmentId = v),
                validator: (v) => v == null ? l.ecoRequired : null,
              ),
            ],
            const SizedBox(height: KsSpace.s4),
            Text(l.corrShouldBe, style: t.titleSmall),
            const SizedBox(height: KsSpace.s2),
            Wrap(
              spacing: KsSpace.s2,
              runSpacing: KsSpace.s2,
              children: [
                for (final s in correctionStatuses)
                  ChoiceChip(
                    key: Key('corr_status_$s'),
                    label: Text(attendanceLabel(l, s)),
                    selected: _status == s,
                    onSelected: s == widget.currentStatus ? null : (_) => setState(() => _status = s),
                  ),
              ],
            ),
            if (withTimes) ...[
              const SizedBox(height: KsSpace.s3),
              OutlinedButton.icon(
                key: const Key('corr_check_in'),
                onPressed: () => _time(false),
                icon: const Icon(LucideIcons.logIn),
                label: Text(timeLabel(l.corrCheckIn, _in)),
              ),
              const SizedBox(height: KsSpace.s2),
              OutlinedButton.icon(
                key: const Key('corr_check_out'),
                onPressed: () => _time(true),
                icon: const Icon(LucideIcons.logOut),
                label: Text(timeLabel(l.corrCheckOut, _out)),
              ),
            ],
            const SizedBox(height: KsSpace.s4),
            TextFormField(
              key: const Key('corr_reason'),
              controller: _reason,
              minLines: 2,
              maxLines: 5,
              maxLength: 1000,
              decoration: InputDecoration(
                labelText: l.corrReason,
                hintText: l.corrReasonHint,
                alignLabelWithHint: true,
              ),
              validator: (v) => (v?.trim().isEmpty ?? true) ? l.ecoRequired : null,
            ),
            const SizedBox(height: KsSpace.s4),
            FilledButton(
              key: const Key('corr_submit'),
              onPressed: _busy || employmentId == null || _status == null ? null : () => _submit(employmentId),
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
