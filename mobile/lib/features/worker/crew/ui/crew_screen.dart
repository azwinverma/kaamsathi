import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/api/cached.dart';
import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/digit_formatter.dart';
import '../../../../core/widgets/eco.dart';
import '../../../common/ref_data.dart';
import '../crew_data.dart';

(String, Tone) crewReferralStatus(AppLocalizations l, String status) => switch (status) {
  'eligible' => (l.crewRefEligible, Tone.info),
  'paid' => (l.crewRefPaid, Tone.success),
  'void' => (l.crewRefVoid, Tone.neutral),
  _ => (l.crewRefPending, Tone.warning),
};

/// Naike crew: members + referral rewards, or "Become a team lead".
class CrewScreen extends ConsumerWidget {
  const CrewScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final value = ref.watch(crewProvider);
    final crew = value.value;
    Future<void> refresh() async {
      ref.invalidate(crewProvider);
      ref.invalidate(crewReferralsProvider);
      try {
        await ref.read(crewProvider.future);
      } catch (_) {}
    }

    if (crew == null) {
      return Scaffold(
        appBar: AppBar(title: Text(l.crewTitle)),
        body: RefreshIndicator(
          onRefresh: refresh,
          child: FeatureAsyncBody<Crew?>(
            value: value,
            onRetry: () => ref.invalidate(crewProvider),
            data: (_) => const _BecomeLead(),
          ),
        ),
      );
    }
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: Text(crew.name.isEmpty ? l.crewTitle : crew.name),
          bottom: TabBar(tabs: [Tab(text: l.crewMembers), Tab(text: l.crewReferrals)]),
        ),
        floatingActionButton: FloatingActionButton.extended(
          onPressed:
              () => showModalBottomSheet<void>(
                context: context,
                isScrollControlled: true,
                builder: (_) => const _AddMemberSheet(),
              ),
          icon: const Icon(LucideIcons.userPlus),
          label: Text(l.crewAddMember),
        ),
        body: TabBarView(
          children: [
            RefreshIndicator(onRefresh: refresh, child: _Members(crew: crew)),
            RefreshIndicator(onRefresh: refresh, child: const _Referrals()),
          ],
        ),
      ),
    );
  }
}

class _BecomeLead extends ConsumerStatefulWidget {
  const _BecomeLead();

  @override
  ConsumerState<_BecomeLead> createState() => _BecomeLeadState();
}

class _BecomeLeadState extends ConsumerState<_BecomeLead> {
  final _name = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    final l = context.l10n;
    if (_name.text.trim().isEmpty) {
      showSnack(context, l.ecoRequired, error: true);
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(crewRepositoryProvider).create(_name.text);
      ref.invalidate(crewProvider);
      if (mounted) showSnack(context, l.crewCreated);
    } catch (e) {
      if (mounted) {
        showSnack(context, isFeatureUnavailable(e) ? l.ecoComingSoon : errorText(context, e), error: true);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    return ListView(
      padding: const EdgeInsets.all(KsSpace.page),
      children: [
        Icon(LucideIcons.users, size: 48, color: Theme.of(context).colorScheme.primary),
        const SizedBox(height: KsSpace.s3),
        Text(l.crewBecomeTitle, style: t.titleLarge, textAlign: TextAlign.center),
        const SizedBox(height: KsSpace.s3),
        Text(l.crewBecomeBody, style: t.bodyLarge),
        const SizedBox(height: KsSpace.s2),
        Text(l.crewWorkersNeverPay, style: t.bodySmall),
        const SizedBox(height: KsSpace.s4),
        TextField(
          key: const Key('crew_name'),
          controller: _name,
          decoration: InputDecoration(labelText: l.crewName, hintText: l.crewNameHint),
        ),
        const SizedBox(height: KsSpace.s4),
        FilledButton.icon(
          onPressed: _busy ? null : _create,
          icon: const Icon(LucideIcons.users),
          label: Text(l.crewCreate),
        ),
      ],
    );
  }
}

class _Members extends ConsumerWidget {
  const _Members({required this.crew});
  final Crew crew;

  Future<void> _remove(BuildContext context, WidgetRef ref, CrewMember m) async {
    final l = context.l10n;
    final ok = await confirmDialog(
      context,
      title: l.crewRemoveConfirm(m.fullName),
      confirmLabel: l.ecoRemove,
      danger: true,
    );
    if (!ok) return;
    try {
      await ref.read(crewRepositoryProvider).removeMember(m.id);
      ref.invalidate(crewProvider);
      if (context.mounted) showSnack(context, l.crewRemoved);
    } catch (e) {
      if (context.mounted) showSnack(context, errorText(context, e), error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final s = crew.stats;
    Widget stat(String label, String value) => Expanded(
      child: Column(
        children: [
          Text(value, style: t.titleLarge?.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
          Text(label, style: t.bodySmall, textAlign: TextAlign.center),
        ],
      ),
    );
    return ListView(
      padding: const EdgeInsets.fromLTRB(KsSpace.page, KsSpace.page, KsSpace.page, 96),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(KsSpace.s4),
            child: Row(
              children: [
                stat(l.crewMembers, formatNumber(s.members, lang: lang)),
                stat(l.crewPlaced, formatNumber(s.placed90d, lang: lang)),
                stat(l.crewEarned, formatMoney(s.earnedTotal, lang: lang)),
                stat(l.crewPending, formatMoney(s.pendingTotal, lang: lang)),
              ],
            ),
          ),
        ),
        const SizedBox(height: KsSpace.s3),
        if (crew.members.isEmpty) EmptyState(icon: LucideIcons.users, message: l.crewEmpty),
        for (final m in crew.members)
          Card(
            child: ListTile(
              leading: WorkerAvatar(name: m.fullName, photo: m.photo),
              title: Text(m.fullName),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (m.trades.isNotEmpty)
                    Text(
                      m.trades
                          .map((x) => '${x.trade.name(lang)} · ${l.ecoYears(localizeDigits('${x.years}', lang))}')
                          .join(', '),
                    ),
                  if (m.phoneMasked != null) Text(localizeDigits(m.phoneMasked!, lang)),
                  const SizedBox(height: 4),
                  StatusBadge(
                    label:
                        m.currentEmployer != null
                            ? l.crewWorkingAt(m.currentEmployer!)
                            : m.isAvailable
                            ? l.crewAvailable
                            : l.crewNotAvailable,
                    tone:
                        m.currentEmployer != null
                            ? Tone.info
                            : m.isAvailable
                            ? Tone.success
                            : Tone.neutral,
                  ),
                ],
              ),
              isThreeLine: true,
              trailing: IconButton(
                tooltip: l.ecoRemove,
                icon: const Icon(LucideIcons.userMinus),
                onPressed: () => _remove(context, ref, m),
              ),
            ),
          ),
      ],
    );
  }
}

class _Referrals extends ConsumerWidget {
  const _Referrals();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    return FeatureAsyncBody<List<CrewReferral>>(
      value: ref.watch(crewReferralsProvider),
      onRetry: () => ref.invalidate(crewReferralsProvider),
      data:
          (items) => ListView(
            padding: const EdgeInsets.fromLTRB(KsSpace.page, KsSpace.page, KsSpace.page, 96),
            children: [
              Text(l.crewWorkersNeverPay, style: t.bodySmall),
              const SizedBox(height: KsSpace.s3),
              if (items.isEmpty) EmptyState(icon: LucideIcons.gift, message: l.crewReferralsEmpty),
              for (final r in items)
                Card(
                  child: ListTile(
                    leading: const Icon(LucideIcons.gift),
                    title: Text(r.workerName),
                    subtitle: Text(
                      [
                        if (r.organizationName != null) r.organizationName!,
                        if (r.status == 'pending' && r.eligibleAt != null)
                          l.crewRefEligibleOn(formatBsDateTime(r.eligibleAt, lang)),
                        if (r.status == 'paid' && r.paidAt != null) l.ecoOn(formatBsDateTime(r.paidAt, lang)),
                        if (r.status == 'void' && (r.voidReason?.isNotEmpty ?? false)) r.voidReason!,
                      ].join('\n'),
                    ),
                    trailing: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(formatMoney(r.amount, lang: lang), style: t.titleSmall),
                        Builder(
                          builder: (_) {
                            final (label, tone) = crewReferralStatus(l, r.status);
                            return StatusBadge(label: label, tone: tone);
                          },
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

class _AddMemberSheet extends ConsumerStatefulWidget {
  const _AddMemberSheet();

  @override
  ConsumerState<_AddMemberSheet> createState() => _AddMemberSheetState();
}

class _AddMemberSheetState extends ConsumerState<_AddMemberSheet> {
  final _phone = TextEditingController();
  final _name = TextEditingController();
  final _years = TextEditingController();
  String? _trade;
  final _form = GlobalKey<FormState>();
  bool _busy = false;

  @override
  void dispose() {
    _phone.dispose();
    _name.dispose();
    _years.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    final l = context.l10n;
    setState(() => _busy = true);
    try {
      await ref
          .read(crewRepositoryProvider)
          .addMember(phone: _phone.text, fullName: _name.text, trade: _trade!, years: int.tryParse(_years.text));
      ref.invalidate(crewProvider);
      if (!mounted) return;
      Navigator.pop(context);
      showSnack(context, l.crewAdded);
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
    final trades = ref.watch(tradesProvider);
    return Padding(
      padding: EdgeInsets.only(
        left: KsSpace.page,
        right: KsSpace.page,
        bottom: MediaQuery.viewInsetsOf(context).bottom + KsSpace.page,
      ),
      child: Form(
        key: _form,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(l.crewAddMember, style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: KsSpace.s4),
              TextFormField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                inputFormatters: const [DigitsFormatter(10)],
                decoration: InputDecoration(labelText: l.loginPhoneLabel, hintText: l.loginPhoneHint),
                validator: (v) => isValidNepaliMobile(v ?? '') ? null : l.loginPhoneInvalid,
              ),
              const SizedBox(height: KsSpace.s3),
              TextFormField(
                controller: _name,
                textCapitalization: TextCapitalization.words,
                decoration: InputDecoration(labelText: l.crewMemberName),
                validator: (v) => (v?.trim().isEmpty ?? true) ? l.ecoRequired : null,
              ),
              const SizedBox(height: KsSpace.s3),
              switch (trades) {
                AsyncData(:final value) => DropdownButtonFormField<String>(
                  value: _trade,
                  isExpanded: true,
                  decoration: InputDecoration(labelText: l.crewTrade),
                  items: [for (final t in value) DropdownMenuItem(value: t.code, child: Text(t.name(lang)))],
                  onChanged: (v) => setState(() => _trade = v),
                  validator: (v) => v == null ? l.ecoRequired : null,
                ),
                AsyncError(:final error) => ErrorView(error: error, onRetry: () => ref.invalidate(tradesProvider)),
                _ => const LinearProgressIndicator(),
              },
              const SizedBox(height: KsSpace.s3),
              TextFormField(
                controller: _years,
                keyboardType: TextInputType.number,
                inputFormatters: const [DigitsFormatter(2)],
                decoration: InputDecoration(labelText: l.ecoOptional(l.crewYears)),
              ),
              const SizedBox(height: KsSpace.s2),
              Text(l.crewMemberConsentNote, style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: KsSpace.s4),
              FilledButton(
                onPressed: _busy ? null : _save,
                child:
                    _busy
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                        : Text(l.ecoAdd),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
