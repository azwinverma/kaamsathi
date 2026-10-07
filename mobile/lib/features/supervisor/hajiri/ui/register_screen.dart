import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/auth/session.dart';
import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/month_switcher.dart';
import '../data/attendance_models.dart';
import '../hajiri_providers.dart';
import 'site_picker.dart';

/// Monthly register (BS month) as a compact coloured grid.
class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  late BsDate _month = BsDate.fromAd(nepalToday()).firstOfMonth;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final session = ref.watch(sessionProvider);
    final orgId = session.orgId;
    if (orgId == null) return const SizedBox.shrink();
    final key = (orgId: orgId, siteId: session.siteId, bsYear: _month.year, bsMonth: _month.month);
    final reg = ref.watch(registerProvider(key));
    final current = BsDate.fromAd(nepalToday()).firstOfMonth;
    return Scaffold(
      appBar: AppBar(title: Text(l.hajiriRegister), actions: const [SitePickerButton()]),
      body: Column(
        children: [
          MonthSwitcher(
            month: _month,
            canGoNext: _month.compareTo(current) < 0,
            onChanged: (m) => setState(() => _month = m),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(registerProvider(key));
                try {
                  await ref.read(registerProvider(key).future);
                } catch (_) {}
              },
              child: AsyncBody<Register>(
                value: reg,
                onRetry: () => ref.invalidate(registerProvider(key)),
                data: (r) => r.rows.isEmpty
                    ? ListView(children: [EmptyState(icon: LucideIcons.calendarDays, message: l.registerEmpty)])
                    : _Grid(register: r),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Grid extends StatelessWidget {
  const _Grid({required this.register});
  final Register register;

  static const _nameW = 136.0;
  static const _cell = 30.0;
  static const _rowH = 52.0;
  static const _totW = 44.0;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final c = context.statusColors;
    final headerStyle = t.labelSmall?.copyWith(color: c.textSecondary);
    final totals = [
      ('present', l.statusShortPresent),
      ('half_day', l.statusShortHalfDay),
      ('absent', l.statusShortAbsent),
      ('leave', l.statusShortLeave),
      ('overtime_hours', 'OT'),
    ];

    Widget dayHeader(RegisterDay d) {
      final off = d.isHoliday || d.isWeeklyOff;
      return SizedBox(
        width: _cell + 4,
        height: 40,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              localizeDigits('${d.bsDay}', lang),
              style: t.labelSmall?.copyWith(color: off ? c.dangerFg : null),
            ),
            Text(
              (lang == 'ne' ? weekdaysShortNe : weekdaysShortEn)[d.weekday % 7].characters.first,
              style: headerStyle,
            ),
          ],
        ),
      );
    }

    Widget cell(String? code) {
      final status = AttendanceStatus.fromCode(code);
      final (bg, fg) = attendanceColors(context, status);
      return Container(
        width: _cell,
        height: _cell,
        margin: const EdgeInsets.all(2),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: status == null ? null : bg,
          borderRadius: BorderRadius.circular(KsRadius.sm),
          border: status == null ? Border.all(color: c.border) : null,
        ),
        child: Text(
          status == null ? '' : attendanceShort(l, status),
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: fg),
        ),
      );
    }

    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(bottom: 32),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Pinned names column.
          SizedBox(
            width: _nameW,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 40),
                for (final r in register.rows)
                  Container(
                    height: _rowH,
                    padding: const EdgeInsets.only(left: KsSpace.page, right: 4),
                    alignment: Alignment.centerLeft,
                    decoration: BoxDecoration(border: Border(top: BorderSide(color: c.border))),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(r.workerName, style: t.labelMedium, maxLines: 1, overflow: TextOverflow.ellipsis),
                        if (r.designation != null)
                          Text(r.designation!, style: t.bodySmall, maxLines: 1, overflow: TextOverflow.ellipsis),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.only(right: KsSpace.page),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      for (final d in register.days) dayHeader(d),
                      for (final (_, label) in totals)
                        SizedBox(
                          width: _totW,
                          height: 40,
                          child: Center(child: Text(label, style: t.labelSmall)),
                        ),
                    ],
                  ),
                  for (final r in register.rows)
                    Container(
                      height: _rowH,
                      decoration: BoxDecoration(border: Border(top: BorderSide(color: c.border))),
                      child: Row(
                        children: [
                          for (final d in register.days) cell(r.cells[d.date]),
                          for (final (k, _) in totals)
                            SizedBox(
                              width: _totW,
                              child: Text(
                                formatNumber(r.totals[k] ?? 0, lang: lang),
                                textAlign: TextAlign.center,
                                style: t.labelMedium?.copyWith(
                                  fontFeatures: const [FontFeature.tabularFigures()],
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
