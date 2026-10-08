import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/json.dart';
import '../../../core/auth/session.dart';
import '../../../core/format.dart';
import '../../../core/l10n/l10n.dart';
import '../../../core/providers.dart';
import '../../../core/theme/tokens.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/eco.dart';

/// `GET|PATCH /me/notification-preferences`.
class NotificationPrefs {
  const NotificationPrefs({
    this.smsEnabled = true,
    this.pushEnabled = true,
    this.emailEnabled = false,
    this.marketingOptIn = false,
    this.jobAlertFrequency = 'daily',
    this.quietHoursStart,
    this.quietHoursEnd,
  });

  final bool smsEnabled;
  final bool pushEnabled;
  final bool emailEnabled;
  final bool marketingOptIn;

  /// instant | daily | weekly
  final String jobAlertFrequency;

  /// "HH:MM" (server may send seconds).
  final String? quietHoursStart;
  final String? quietHoursEnd;

  bool get hasQuietHours => quietHoursStart != null && quietHoursEnd != null;

  static String? _hhmm(Object? v) {
    final m = RegExp(r'^(\d{1,2}):(\d{2})').firstMatch('${v ?? ''}');
    return m == null ? null : '${m.group(1)!.padLeft(2, '0')}:${m.group(2)}';
  }

  factory NotificationPrefs.fromJson(Json j) => NotificationPrefs(
    smsEnabled: boolOf(j['sms_enabled'], true),
    pushEnabled: boolOf(j['push_enabled'], true),
    emailEnabled: boolOf(j['email_enabled']),
    marketingOptIn: boolOf(j['marketing_opt_in']),
    jobAlertFrequency: strOr(j['job_alert_frequency'], 'daily'),
    quietHoursStart: _hhmm(j['quiet_hours_start']),
    quietHoursEnd: _hhmm(j['quiet_hours_end']),
  );

  Json toJson() => {
    'sms_enabled': smsEnabled,
    'push_enabled': pushEnabled,
    'email_enabled': emailEnabled,
    'marketing_opt_in': marketingOptIn,
    'job_alert_frequency': jobAlertFrequency,
    'quiet_hours_start': quietHoursStart,
    'quiet_hours_end': quietHoursEnd,
  };

  NotificationPrefs copyWith({
    bool? smsEnabled,
    bool? pushEnabled,
    bool? emailEnabled,
    bool? marketingOptIn,
    String? jobAlertFrequency,
    String? Function()? quietHoursStart,
    String? Function()? quietHoursEnd,
  }) => NotificationPrefs(
    smsEnabled: smsEnabled ?? this.smsEnabled,
    pushEnabled: pushEnabled ?? this.pushEnabled,
    emailEnabled: emailEnabled ?? this.emailEnabled,
    marketingOptIn: marketingOptIn ?? this.marketingOptIn,
    jobAlertFrequency: jobAlertFrequency ?? this.jobAlertFrequency,
    quietHoursStart: quietHoursStart == null ? this.quietHoursStart : quietHoursStart(),
    quietHoursEnd: quietHoursEnd == null ? this.quietHoursEnd : quietHoursEnd(),
  );
}

final notificationPrefsProvider = FutureProvider.autoDispose<NotificationPrefs>((ref) async {
  ref.watch(sessionProvider.select((s) => s.me?.id));
  final data = await ref.watch(apiClientProvider).get<dynamic>('/me/notification-preferences');
  return NotificationPrefs.fromJson(asJson(data));
});

class NotificationPrefsScreen extends ConsumerWidget {
  const NotificationPrefsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = ref.watch(notificationPrefsProvider);
    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.notifPrefsTitle)),
      body: ListView(
        padding: const EdgeInsets.all(KsSpace.page),
        children: [
          // Always visible, whatever the server state.
          InfoNote(key: const Key('notif_always'), text: context.l10n.notifPrefsAlways, icon: LucideIcons.shieldCheck),
          const SizedBox(height: KsSpace.s3),
          FeatureAsyncSection<NotificationPrefs>(
            value: value,
            onRetry: () => ref.invalidate(notificationPrefsProvider),
            data: (p) => _PrefsForm(initial: p),
          ),
        ],
      ),
    );
  }
}

class _PrefsForm extends ConsumerStatefulWidget {
  const _PrefsForm({required this.initial});
  final NotificationPrefs initial;

  @override
  ConsumerState<_PrefsForm> createState() => _PrefsFormState();
}

class _PrefsFormState extends ConsumerState<_PrefsForm> {
  late NotificationPrefs _p = widget.initial;

  /// Saves each change straight away (PATCH just the changed fields).
  Future<void> _set(NotificationPrefs next, Json patch) async {
    final before = _p;
    setState(() => _p = next);
    try {
      await ref.read(apiClientProvider).patch<dynamic>('/me/notification-preferences', data: patch);
    } catch (e) {
      if (!mounted) return;
      setState(() => _p = before);
      showSnack(context, errorText(context, e), error: true);
    }
  }

  Future<String?> _pickTime(String? current, String fallback) async {
    final parts = (current ?? fallback).split(':');
    final t = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(hour: int.parse(parts[0]), minute: int.parse(parts[1])),
    );
    if (t == null) return null;
    return '${'${t.hour}'.padLeft(2, '0')}:${'${t.minute}'.padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final p = _p;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Card(
          child: Column(
            children: [
              SwitchListTile(
                key: const Key('notif_sms'),
                secondary: const Icon(LucideIcons.messageSquare),
                title: Text(l.notifSms),
                value: p.smsEnabled,
                onChanged: (v) => _set(p.copyWith(smsEnabled: v), {'sms_enabled': v}),
              ),
              SwitchListTile(
                secondary: const Icon(LucideIcons.bell),
                title: Text(l.notifPush),
                value: p.pushEnabled,
                onChanged: (v) => _set(p.copyWith(pushEnabled: v), {'push_enabled': v}),
              ),
              SwitchListTile(
                secondary: const Icon(LucideIcons.mail),
                title: Text(l.notifEmail),
                value: p.emailEnabled,
                onChanged: (v) => _set(p.copyWith(emailEnabled: v), {'email_enabled': v}),
              ),
              SwitchListTile(
                secondary: const Icon(LucideIcons.megaphone),
                title: Text(l.notifMarketing),
                value: p.marketingOptIn,
                onChanged: (v) => _set(p.copyWith(marketingOptIn: v), {'marketing_opt_in': v}),
              ),
            ],
          ),
        ),
        const SizedBox(height: KsSpace.s4),
        SectionCard(
          title: l.notifJobAlertFreq,
          child: Wrap(
            spacing: KsSpace.s2,
            runSpacing: KsSpace.s2,
            children: [
              for (final (f, label) in [('instant', l.freqInstant), ('daily', l.freqDaily), ('weekly', l.freqWeekly)])
                ChoiceChip(
                  label: Text(label),
                  selected: p.jobAlertFrequency == f,
                  onSelected: (_) => _set(p.copyWith(jobAlertFrequency: f), {'job_alert_frequency': f}),
                ),
            ],
          ),
        ),
        const SizedBox(height: KsSpace.s4),
        SectionCard(
          title: l.notifQuietHours,
          trailing: Switch(
            key: const Key('notif_quiet'),
            value: p.hasQuietHours,
            onChanged: (v) {
              final start = v ? '21:00' : null;
              final end = v ? '07:00' : null;
              _set(p.copyWith(quietHoursStart: () => start, quietHoursEnd: () => end), {
                'quiet_hours_start': start,
                'quiet_hours_end': end,
              });
            },
          ),
          child:
              !p.hasQuietHours
                  ? Text(l.notifQuietOff, style: t.bodyMedium)
                  : Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () async {
                            final v = await _pickTime(p.quietHoursStart, '21:00');
                            if (v != null) await _set(p.copyWith(quietHoursStart: () => v), {'quiet_hours_start': v});
                          },
                          child: Text('${l.notifQuietFrom} ${formatClock(p.quietHoursStart, lang)}'),
                        ),
                      ),
                      const SizedBox(width: KsSpace.s2),
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () async {
                            final v = await _pickTime(p.quietHoursEnd, '07:00');
                            if (v != null) await _set(p.copyWith(quietHoursEnd: () => v), {'quiet_hours_end': v});
                          },
                          child: Text('${formatClock(p.quietHoursEnd, lang)} ${l.notifQuietTo}'),
                        ),
                      ),
                    ],
                  ),
        ),
      ],
    );
  }
}
