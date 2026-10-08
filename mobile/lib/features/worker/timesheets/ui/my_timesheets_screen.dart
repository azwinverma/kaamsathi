import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/api/cached.dart';
import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/eco.dart';
import '../../../../core/widgets/signature/signature.dart';
import '../../../common/timesheet_models.dart';
import '../../../common/timesheet_widgets.dart';
import '../../roster/ui/my_shifts_screen.dart' show WeekSwitcher;
import '../my_timesheets_data.dart';

/// Worker: weekly timesheets (hours + overtime) built from hajiri.
class MyTimesheetsScreen extends ConsumerStatefulWidget {
  const MyTimesheetsScreen({super.key});

  @override
  ConsumerState<MyTimesheetsScreen> createState() => _MyTimesheetsScreenState();
}

class _MyTimesheetsScreenState extends ConsumerState<MyTimesheetsScreen> {
  late DateTime _week = weekStartSunday(nepalToday());

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final value = ref.watch(myTimesheetsProvider(_week));
    return Scaffold(
      appBar: AppBar(title: Text(l.tsTitle)),
      body: Column(
        children: [
          WeekSwitcher(weekStart: _week, onChanged: (w) => setState(() => _week = w)),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(myTimesheetsProvider(_week));
                try {
                  await ref.read(myTimesheetsProvider(_week).future);
                } catch (_) {}
              },
              child: FeatureAsyncBody<Cached<List<Timesheet>>>(
                value: value,
                onRetry: () => ref.invalidate(myTimesheetsProvider(_week)),
                data:
                    (cached) => ListView(
                      padding: const EdgeInsets.fromLTRB(KsSpace.page, 0, KsSpace.page, KsSpace.page),
                      children: [
                        if (cached.fromCache) const CachedNotice(),
                        if (cached.data.isEmpty)
                          EmptyState(icon: LucideIcons.clock, message: l.tsEmpty, art: KsArt.supervisorHajiri),
                        for (final s in cached.data)
                          SectionCard(
                            key: Key('timesheet_${s.id}'),
                            title: s.organizationName ?? s.siteName ?? l.tsTitle,
                            trailing: Builder(
                              builder: (_) {
                                final (label, tone) = timesheetStatus(l, s.status);
                                return StatusBadge(label: label, tone: tone);
                              },
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                if (s.siteName != null && s.organizationName != null)
                                  Text(s.siteName!, style: t.bodySmall),
                                TimesheetDetails(sheet: s, weekStart: _week),
                              ],
                            ),
                          ),
                      ],
                    ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
