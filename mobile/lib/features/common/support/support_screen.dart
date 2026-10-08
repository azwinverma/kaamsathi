import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/auth/session.dart';
import '../../../core/format.dart';
import '../../../core/l10n/l10n.dart';
import '../../../core/router/router.dart';
import '../../../core/theme/tokens.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/eco.dart';
import 'support_data.dart';

String supportCategoryLabel(AppLocalizations l, String c) => switch (c) {
  'account' => l.supportCatAccount,
  'payment' => l.supportCatPayment,
  'attendance' => l.supportCatAttendance,
  'job' => l.supportCatJob,
  'privacy' => l.supportCatPrivacy,
  'technical' => l.supportCatTechnical,
  'safety' => l.supportCatSafety,
  _ => l.supportCatOther,
};

(String, Tone) supportStatus(AppLocalizations l, SupportCase c) {
  final (label, tone) = switch (c.status) {
    'pending_user' => (l.supportStatusPendingUser, Tone.warning),
    'resolved' => (l.supportStatusResolved, Tone.success),
    'closed' => (l.supportStatusClosed, Tone.neutral),
    _ => (l.supportStatusOpen, Tone.info),
  };
  return ((c.statusLabel?.isNotEmpty ?? false) ? c.statusLabel! : label, tone);
}

/// Help & support: the user's cases, newest activity first.
class SupportScreen extends ConsumerWidget {
  const SupportScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final value = ref.watch(supportCasesProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.supportTitle)),
      floatingActionButton:
          value.hasError
              ? null
              : FloatingActionButton.extended(
                onPressed: () => context.push(Routes.helpNew),
                icon: const Icon(LucideIcons.messageSquarePlus),
                label: Text(l.supportNew),
              ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(supportCasesProvider);
          try {
            await ref.read(supportCasesProvider.future);
          } catch (_) {}
        },
        child: FeatureAsyncBody<List<SupportCase>>(
          value: value,
          onRetry: () => ref.invalidate(supportCasesProvider),
          data:
              (items) => ListView(
                padding: const EdgeInsets.fromLTRB(KsSpace.page, KsSpace.page, KsSpace.page, 96),
                children: [
                  Card(
                    child: MenuTile(
                      icon: LucideIcons.bookOpen,
                      title: l.helpCenterTitle,
                      subtitle: l.helpCenterSubtitle,
                      onTap: () => context.push(Routes.helpCenter),
                    ),
                  ),
                  if (ref.watch(sessionProvider.select((s) => s.mode)) != AppMode.supervisor)
                    Card(
                      key: const Key('support_safety'),
                      child: MenuTile(
                        icon: LucideIcons.shieldAlert,
                        title: l.safetyTitle,
                        subtitle: l.safetyMenuSubtitle,
                        onTap: () => context.push(Routes.helpSafety),
                      ),
                    ),
                  const SizedBox(height: KsSpace.s2),
                  if (items.isEmpty) EmptyState(icon: LucideIcons.lifeBuoy, message: l.supportEmpty),
                  for (final c in items)
                    Card(
                      child: InkWell(
                        borderRadius: BorderRadius.circular(KsRadius.lg),
                        onTap: () => context.push(Routes.helpCase(c.id)),
                        child: Padding(
                          padding: const EdgeInsets.all(KsSpace.s4),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(child: Text(c.subject, style: t.titleSmall)),
                                  const SizedBox(width: KsSpace.s2),
                                  Builder(
                                    builder: (_) {
                                      final (label, tone) = supportStatus(l, c);
                                      return StatusBadge(label: label, tone: tone);
                                    },
                                  ),
                                ],
                              ),
                              const SizedBox(height: KsSpace.s1),
                              Text(
                                [
                                  if (c.number.isNotEmpty) c.number,
                                  supportCategoryLabel(l, c.category),
                                  if (c.createdAt != null) formatBsDateTime(c.createdAt, lang),
                                ].join(' · '),
                                style: t.bodySmall,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                ],
              ),
        ),
      ),
    );
  }
}

class NewSupportCaseScreen extends ConsumerStatefulWidget {
  const NewSupportCaseScreen({super.key});

  @override
  ConsumerState<NewSupportCaseScreen> createState() => _NewSupportCaseScreenState();
}

class _NewSupportCaseScreenState extends ConsumerState<NewSupportCaseScreen> {
  String _category = 'payment';
  final _subject = TextEditingController();
  final _desc = TextEditingController();
  final _form = GlobalKey<FormState>();
  bool _busy = false;

  @override
  void dispose() {
    _subject.dispose();
    _desc.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    final l = context.l10n;
    setState(() => _busy = true);
    try {
      final created = await ref
          .read(supportRepositoryProvider)
          .create(category: _category, subject: _subject.text, description: _desc.text);
      ref.invalidate(supportCasesProvider);
      if (!mounted) return;
      showSnack(context, l.supportSent);
      if (created != null) {
        context.pushReplacement(Routes.helpCase(created.id));
      } else {
        context.pop();
      }
    } catch (e) {
      if (mounted) showSnack(context, errorText(context, e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    String? req(String? v) => (v?.trim().isEmpty ?? true) ? l.ecoRequired : null;
    return Scaffold(
      appBar: AppBar(title: Text(l.supportNew)),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.all(KsSpace.page),
          children: [
            Text(l.supportCategory, style: t.titleSmall),
            const SizedBox(height: KsSpace.s2),
            Wrap(
              spacing: KsSpace.s2,
              runSpacing: KsSpace.s2,
              children: [
                for (final c in SupportCategory.all)
                  ChoiceChip(
                    key: Key('support_cat_$c'),
                    label: Text(supportCategoryLabel(l, c)),
                    selected: _category == c,
                    onSelected: (_) => setState(() => _category = c),
                  ),
              ],
            ),
            const SizedBox(height: KsSpace.s4),
            TextFormField(
              key: const Key('support_subject'),
              controller: _subject,
              maxLength: 120,
              decoration: InputDecoration(labelText: l.supportSubject),
              validator: req,
            ),
            const SizedBox(height: KsSpace.s2),
            TextFormField(
              key: const Key('support_description'),
              controller: _desc,
              minLines: 4,
              maxLines: 8,
              maxLength: 2000,
              decoration: InputDecoration(labelText: l.supportDescription, alignLabelWithHint: true),
              validator: req,
            ),
            const SizedBox(height: KsSpace.s4),
            FilledButton(
              key: const Key('support_submit'),
              onPressed: _busy ? null : _submit,
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

/// One case: the original request, then the conversation with the team.
/// Internal staff notes are never shown.
class SupportThreadScreen extends ConsumerStatefulWidget {
  const SupportThreadScreen({super.key, required this.id});
  final String id;

  @override
  ConsumerState<SupportThreadScreen> createState() => _SupportThreadScreenState();
}

class _SupportThreadScreenState extends ConsumerState<SupportThreadScreen> {
  final _reply = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _reply.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _reply.text.trim();
    if (text.isEmpty) return;
    setState(() => _busy = true);
    try {
      await ref.read(supportRepositoryProvider).send(widget.id, text);
      _reply.clear();
      ref.invalidate(caseMessagesProvider(widget.id));
      ref.invalidate(supportCasesProvider);
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
    final kase = ref.watch(supportCaseProvider(widget.id)).value;
    final value = ref.watch(caseMessagesProvider(widget.id));
    final closed = kase?.isClosed ?? false;
    return Scaffold(
      appBar: AppBar(title: Text(kase?.number.isNotEmpty ?? false ? kase!.number : l.supportTitle)),
      body: Column(
        children: [
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(caseMessagesProvider(widget.id));
                ref.invalidate(supportCasesProvider);
                try {
                  await ref.read(caseMessagesProvider(widget.id).future);
                } catch (_) {}
              },
              child: FeatureAsyncBody<List<CaseMessage>>(
                value: value,
                onRetry: () => ref.invalidate(caseMessagesProvider(widget.id)),
                data: (raw) {
                  final messages = visibleMessages(raw);
                  return ListView(
                    padding: const EdgeInsets.all(KsSpace.page),
                    children: [
                      if (kase != null)
                        SectionCard(
                          title: kase.subject,
                          trailing: Builder(
                            builder: (_) {
                              final (label, tone) = supportStatus(l, kase);
                              return StatusBadge(label: label, tone: tone);
                            },
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                [
                                  supportCategoryLabel(l, kase.category),
                                  if (kase.createdAt != null) formatBsDateTime(kase.createdAt, lang),
                                ].join(' · '),
                                style: t.bodySmall,
                              ),
                              if (kase.description.isNotEmpty) ...[
                                const SizedBox(height: KsSpace.s2),
                                Text(kase.description, style: t.bodyMedium),
                              ],
                            ],
                          ),
                        ),
                      const SizedBox(height: KsSpace.s3),
                      if (messages.isEmpty)
                        Padding(
                          padding: const EdgeInsets.all(KsSpace.s4),
                          child: Text(l.supportNoMessages, style: t.bodyMedium, textAlign: TextAlign.center),
                        ),
                      for (final m in messages) _Bubble(message: m),
                      if (closed)
                        Padding(
                          padding: const EdgeInsets.all(KsSpace.s4),
                          child: Text(l.supportClosedNote, style: t.bodySmall, textAlign: TextAlign.center),
                        ),
                    ],
                  );
                },
              ),
            ),
          ),
          if (!closed && !value.hasError)
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(KsSpace.page, KsSpace.s2, KsSpace.s2, KsSpace.s2),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        key: const Key('support_reply'),
                        controller: _reply,
                        minLines: 1,
                        maxLines: 4,
                        textInputAction: TextInputAction.newline,
                        decoration: InputDecoration(hintText: l.supportReplyHint),
                      ),
                    ),
                    IconButton(
                      key: const Key('support_send'),
                      tooltip: l.supportSend,
                      onPressed: _busy ? null : _send,
                      icon: const Icon(LucideIcons.send),
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

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message});
  final CaseMessage message;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    final c = context.statusColors;
    final mine = message.mine;
    final who =
        mine
            ? l.supportYou
            : message.fromStaff
            ? l.supportTeam
            : (message.authorName ?? l.supportTeam);
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.8),
        child: Container(
          margin: const EdgeInsets.only(bottom: KsSpace.s2),
          padding: const EdgeInsets.all(KsSpace.s3),
          decoration: BoxDecoration(
            color: mine ? scheme.primaryContainer : c.neutralBg,
            borderRadius: BorderRadius.circular(KsRadius.lg),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(who, style: t.labelSmall?.copyWith(color: c.textSecondary)),
              const SizedBox(height: 2),
              Text(message.body, style: t.bodyMedium),
              if (message.createdAt != null) ...[
                const SizedBox(height: 2),
                Text(
                  '${formatBsDateTime(message.createdAt, lang)} · ${formatTime(message.createdAt!.toLocal(), lang)}',
                  style: t.bodySmall?.copyWith(color: c.textSecondary),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
