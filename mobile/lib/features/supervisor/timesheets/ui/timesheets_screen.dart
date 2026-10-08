import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/auth/session.dart';
import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/eco.dart';
import '../../../common/timesheet_models.dart';
import '../../../common/timesheet_widgets.dart';
import '../../../worker/roster/ui/my_shifts_screen.dart' show WeekSwitcher;
import '../../hajiri/ui/site_picker.dart';
import '../timesheets_data.dart';

/// Supervisor: this week's timesheets for my sites; prepare from hajiri and
/// submit for approval (owner/admin/HR approve on the web).
class TimesheetsScreen extends ConsumerStatefulWidget {
  const TimesheetsScreen({super.key});

  @override
  ConsumerState<TimesheetsScreen> createState() => _TimesheetsScreenState();
}

class _TimesheetsScreenState extends ConsumerState<TimesheetsScreen> {
  late DateTime _week = weekStartSunday(nepalToday());
  bool _busy = false;
  final Set<String> _submitted = {};

  Future<void> _run(Future<void> Function() fn, String done, TimesheetKey key) async {
    setState(() => _busy = true);
    try {
      await fn();
      ref.invalidate(orgTimesheetsProvider(key));
      if (mounted) showSnack(context, done);
    } catch (e) {
      if (mounted) showSnack(context, errorText(context, e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _submitOne(Timesheet s, TimesheetKey key) async {
    final l = context.l10n;
    if (!await confirmDialog(context, title: l.tsSubmitConfirm, confirmLabel: l.ecoSubmit)) return;
    await _run(() async {
      await ref.read(orgTimesheetsRepositoryProvider).submit(s.id);
      _submitted.add(s.id);
    }, l.tsSubmitted, key);
  }

  Future<void> _submitAll(List<Timesheet> drafts, TimesheetKey key) async {
    final l = context.l10n;
    if (!await confirmDialog(context, title: l.tsSubmitAllConfirm, confirmLabel: l.ecoSubmit)) return;
    await _run(() async {
      final repo = ref.read(orgTimesheetsRepositoryProvider);
      for (final s in drafts) {
        await repo.submit(s.id);
        _submitted.add(s.id);
      }
    }, l.tsSubmitted, key);
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final session = ref.watch(sessionProvider);
    final orgId = session.orgId;
    if (orgId == null) return const SizedBox.shrink();
    final key = (orgId: orgId, siteId: session.siteId, weekStart: _week);
    final value = ref.watch(orgTimesheetsProvider(key));
    return Scaffold(
      appBar: AppBar(title: Text(l.tsTitle), actions: const [SitePickerButton()]),
      body: Column(
        children: [
          WeekSwitcher(weekStart: _week, onChanged: (w) => setState(() => _week = w)),
          if (_busy) const LinearProgressIndicator(),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(orgTimesheetsProvider(key));
                try {
                  await ref.read(orgTimesheetsProvider(key).future);
                } catch (_) {}
              },
              child: FeatureAsyncBody<List<Timesheet>>(
                value: value,
                onRetry: () => ref.invalidate(orgTimesheetsProvider(key)),
                data: (items) {
                  final drafts = items.where((s) => s.canSubmit && !_submitted.contains(s.id)).toList();
                  return ListView(
                    padding: const EdgeInsets.fromLTRB(KsSpace.page, 0, KsSpace.page, KsSpace.page),
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              key: const Key('ts_generate'),
                              onPressed:
                                  _busy
                                      ? null
                                      : () => _run(
                                        () => ref
                                            .read(orgTimesheetsRepositoryProvider)
                                            .generate(_week, siteId: session.siteId),
                                        l.tsGenerated,
                                        key,
                                      ),
                              icon: const Icon(LucideIcons.refreshCw, size: 18),
                              label: Text(l.tsGenerate, overflow: TextOverflow.ellipsis),
                            ),
                          ),
                        ],
                      ),
                      if (drafts.length > 1) ...[
                        const SizedBox(height: KsSpace.s2),
                        FilledButton.icon(
                          key: const Key('ts_submit_all'),
                          onPressed: _busy ? null : () => _submitAll(drafts, key),
                          icon: const Icon(LucideIcons.send, size: 18),
                          label: Text(l.tsSubmitAll(localizeDigits('${drafts.length}', lang))),
                        ),
                      ],
                      const SizedBox(height: KsSpace.s3),
                      if (items.isEmpty) EmptyState(icon: LucideIcons.clock, message: l.tsSupEmpty),
                      for (final s in items)
                        Builder(
                          builder: (_) {
                            final status = _submitted.contains(s.id) ? 'submitted' : s.status;
                            final (label, tone) = timesheetStatus(l, status);
                            return Card(
                              key: Key('org_timesheet_${s.id}'),
                              child: ExpansionTile(
                                shape: const Border(),
                                title: Text(s.workerName ?? '', style: t.titleSmall),
                                subtitle: Text(
                                  [
                                    if (s.designation?.isNotEmpty ?? false) s.designation!,
                                    hoursText(l, s.regularMinutes, lang),
                                    if (s.overtimeClaimed > 0) l.tsOtShort(formatHours(s.overtimeClaimed, lang)),
                                  ].join(' · '),
                                ),
                                leading: s.overCap
                                    ? Icon(LucideIcons.triangleAlert, color: context.statusColors.warningFg)
                                    : null,
                                trailing: StatusBadge(label: label, tone: tone),
                                childrenPadding: const EdgeInsets.fromLTRB(KsSpace.s4, 0, KsSpace.s4, KsSpace.s4),
                                children: [
                                  TimesheetDetails(sheet: s, weekStart: _week),
                                  if (s.canSubmit && !_submitted.contains(s.id)) ...[
                                    const SizedBox(height: KsSpace.s3),
                                    FilledButton(
                                      key: Key('ts_submit_${s.id}'),
                                      onPressed: _busy ? null : () => _submitOne(s, key),
                                      child: Text(l.ecoSubmit),
                                    ),
                                  ],
                                ],
                              ),
                            );
                          },
                        ),
                    ],
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}
