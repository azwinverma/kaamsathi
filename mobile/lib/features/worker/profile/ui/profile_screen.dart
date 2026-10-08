import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/auth/session.dart';
import '../../../../core/flags.dart';
import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/router/router.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/eco.dart';
import '../../../../core/widgets/language_toggle.dart';
import '../../../common/account_actions.dart';
import '../../../common/inbox/inbox_screen.dart';
import '../../data/worker_models.dart';
import '../../data/worker_repository.dart';
import 'completeness_card.dart';
import 'languages_screen.dart';
import 'payment_sheet.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final value = ref.watch(workerProfileProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.profileTitle), actions: const [InboxBell()]),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(workerProfileProvider);
          ref.invalidate(consentsProvider);
          try {
            await ref.read(workerProfileProvider.future);
          } catch (_) {}
        },
        child: ListView(
          padding: const EdgeInsets.all(KsSpace.page),
          children: [
            switch (value) {
              AsyncData(:final value) => _ProfileBody(profile: value),
              AsyncError(:final error) => ErrorView(error: error, onRetry: () => ref.invalidate(workerProfileProvider)),
              _ => const Padding(padding: EdgeInsets.all(48), child: Center(child: CircularProgressIndicator())),
            },
            const SizedBox(height: KsSpace.s4),
            const Card(child: Padding(padding: EdgeInsets.all(KsSpace.s4), child: LanguageSelector())),
            const _ProfileMenu(),
            const SizedBox(height: KsSpace.s4),
            const Card(child: ModeSwitchTile()),
            const SizedBox(height: KsSpace.s6),
            OutlinedButton.icon(
              onPressed: () => confirmLogout(context, ref),
              icon: const Icon(LucideIcons.logOut, size: 20),
              label: Text(l.logout),
            ),
            const SizedBox(height: KsSpace.s4),
          ],
        ),
      ),
    );
  }
}

class _ProfileBody extends ConsumerStatefulWidget {
  const _ProfileBody({required this.profile});
  final WorkerProfile profile;

  @override
  ConsumerState<_ProfileBody> createState() => _ProfileBodyState();
}

class _ProfileBodyState extends ConsumerState<_ProfileBody> {
  bool? _available;

  Future<void> _toggleAvailable(bool v) async {
    setState(() => _available = v);
    try {
      await ref.read(workerRepositoryProvider).updateProfile({'is_available': v});
      ref.invalidate(workerProfileProvider);
    } catch (e) {
      if (!mounted) return;
      setState(() => _available = !v);
      showSnack(context, errorText(context, e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final p = widget.profile;
    final me = ref.watch(sessionProvider).me;
    final ver = p.verificationStatus;
    final tone = switch (ver) {
      'verified' => Tone.success,
      'pending' => Tone.warning,
      'rejected' => Tone.danger,
      _ => Tone.neutral,
    };
    final district = lang == 'ne' ? (p.districtNameNe ?? p.districtName) : p.districtName;

    final showLanguages = ref.watch(flagOnProvider(FlagKeys.spokenLanguages));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (p.completeness case final c? when !c.isComplete) ...[
          CompletenessView(
            completeness: c,
            onItem: (key) {
              if (key != 'payment_details') return false;
              showPaymentSheet(context, p);
              return true;
            },
          ),
          const SizedBox(height: KsSpace.s4),
        ],
        Card(
          child: Padding(
            padding: const EdgeInsets.all(KsSpace.s4),
            child: Row(
              children: [
                WorkerAvatar(name: p.fullName, photo: p.photo, size: 64),
                const SizedBox(width: KsSpace.s4),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(p.displayName(lang), style: t.titleLarge),
                      Text(formatPhone(p.phone.isEmpty ? me?.phone : p.phone, lang: lang), style: t.bodyMedium),
                      const SizedBox(height: KsSpace.s2),
                      StatusBadge(
                        label: verificationLabel(l, ver),
                        tone: tone,
                        icon: ver == 'verified' ? LucideIcons.shieldCheck : null,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: KsSpace.s4),
        SectionCard(
          title: l.profilePersonal,
          child: Column(
            children: [
              KeyValueRow(label: l.profileName, value: p.fullName),
              if (p.fullNameNe != null && p.fullNameNe!.isNotEmpty)
                KeyValueRow(label: l.profileNameNe, value: p.fullNameNe!),
              if (district != null) KeyValueRow(label: l.termDistrict, value: district),
              if (p.ssfId != null && p.ssfId!.isNotEmpty) KeyValueRow(label: l.termSsfNo, value: p.ssfId!),
            ],
          ),
        ),
        if (showLanguages) ...[
          const SizedBox(height: KsSpace.s4),
          SectionCard(
            key: const Key('profile_languages'),
            title: l.langTitle,
            trailing: TextButton.icon(
              key: const Key('profile_languages_edit'),
              onPressed: () => context.push(Routes.workerLanguages),
              icon: Icon(p.languages.isEmpty ? LucideIcons.plus : LucideIcons.pencil, size: 16),
              label: Text(p.languages.isEmpty ? l.ecoAdd : l.commonEdit),
            ),
            child: Align(
              alignment: Alignment.centerLeft,
              child:
                  p.languages.isEmpty
                      ? Text(l.langEmpty, style: Theme.of(context).textTheme.bodyMedium)
                      : Wrap(
                        spacing: KsSpace.s2,
                        runSpacing: KsSpace.s2,
                        children: [
                          for (final x in p.languages)
                            StatusBadge(
                              label:
                                  '${spokenLanguageName(l, x.code, fallback: x.label)} · ${proficiencyLabel(l, x.proficiency)}',
                              tone: Tone.neutral,
                            ),
                        ],
                      ),
            ),
          ),
        ],
        const SizedBox(height: KsSpace.s4),
        SectionCard(
          title: l.profilePaymentMethod,
          trailing: TextButton.icon(
            onPressed: () => showPaymentSheet(context, p),
            icon: const Icon(LucideIcons.pencil, size: 16),
            label: Text(l.profileEditPayment),
          ),
          child: _PaymentSummary(profile: p),
        ),
        const SizedBox(height: KsSpace.s4),
        Card(
          child: SwitchListTile(
            value: _available ?? p.isAvailable,
            onChanged: _toggleAvailable,
            title: Text(l.profileAvailable),
            subtitle: Text(l.profileAvailableHint),
            secondary: const Icon(LucideIcons.userCheck),
          ),
        ),
        const SizedBox(height: KsSpace.s4),
        const _ConsentsCard(),
      ],
    );
  }
}

class _PaymentSummary extends StatelessWidget {
  const _PaymentSummary({required this.profile});
  final WorkerProfile profile;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final p = profile;
    final icon = switch (p.paymentMethod) {
      'bank' => LucideIcons.landmark,
      'esewa' || 'khalti' => LucideIcons.smartphone,
      _ => LucideIcons.banknote,
    };
    final detail = switch (p.paymentMethod) {
      'bank' => [
        p.bankName,
        p.bankAccountNo,
        p.bankAccountName,
      ].whereType<String>().where((s) => s.isNotEmpty).join(' · '),
      'esewa' || 'khalti' => p.walletId ?? '',
      _ => '',
    };
    return Row(
      children: [
        Icon(icon, color: Theme.of(context).colorScheme.primary),
        const SizedBox(width: KsSpace.s3),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(paymentMethodLabel(l, p.paymentMethod), style: Theme.of(context).textTheme.bodyLarge),
              if (detail.isNotEmpty) Text(detail, style: Theme.of(context).textTheme.bodySmall),
            ],
          ),
        ),
      ],
    );
  }
}

class _ConsentsCard extends ConsumerStatefulWidget {
  const _ConsentsCard();

  @override
  ConsumerState<_ConsentsCard> createState() => _ConsentsCardState();
}

class _ConsentsCardState extends ConsumerState<_ConsentsCard> {
  final Map<String, bool> _overrides = {};

  Future<void> _set(String scope, bool v) async {
    setState(() => _overrides[scope] = v);
    try {
      await ref.read(workerRepositoryProvider).setConsent(scope, v);
    } catch (e) {
      if (!mounted) return;
      setState(() => _overrides[scope] = !v);
      showSnack(context, errorText(context, e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final value = ref.watch(consentsProvider);
    final records = value.value ?? const <ConsentRecord>[];
    // Global consents (organization = null); the API returns latest rows.
    bool granted(String scope) {
      if (_overrides.containsKey(scope)) return _overrides[scope]!;
      final r = records.where((c) => c.scope == scope && c.organizationId == null).toList();
      return r.isEmpty ? false : r.last.granted;
    }

    final items = [
      (ConsentScope.dataProcessing, l.consentDataProcessing, l.consentDataProcessingHint, LucideIcons.clipboardCheck),
      (ConsentScope.profileShare, l.consentProfileShare, l.consentProfileShareHint, LucideIcons.idCard),
      (ConsentScope.historyShare, l.consentHistoryShare, l.consentHistoryShareHint, LucideIcons.briefcase),
    ];
    return SectionCard(
      title: l.profileConsents,
      padding: const EdgeInsets.fromLTRB(KsSpace.s4, KsSpace.s4, KsSpace.s4, KsSpace.s2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l.profileConsentsHint, style: Theme.of(context).textTheme.bodyMedium),
          if (value.isLoading && !value.hasValue) const LinearProgressIndicator(),
          if (value.hasError) Text(errorText(context, value.error)),
          for (final (scope, title, hint, icon) in items)
            SwitchListTile(
              key: Key('consent_$scope'),
              contentPadding: EdgeInsets.zero,
              secondary: Icon(icon),
              value: granted(scope),
              onChanged: value.hasValue ? (v) => _set(scope, v) : null,
              title: Text(title),
              subtitle: Text(hint),
            ),
        ],
      ),
    );
  }
}

/// Grouped entries for the worker's ecosystem features. Kept here (not in the
/// bottom nav) so the nav stays at four tabs on small phones.
class _ProfileMenu extends ConsumerWidget {
  const _ProfileMenu();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final ratings = ref.watch(flagOnProvider(FlagKeys.ratings));
    final corrections = ref.watch(flagOnProvider(FlagKeys.attendanceCorrections));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        GroupLabel(l.ecoGroupWork),
        Card(
          child: Column(
            children: [
              MenuTile(
                icon: LucideIcons.briefcase,
                title: l.historyTitle,
                subtitle: l.contractTitle,
                onTap: () => context.go(Routes.workerHistory),
              ),
              MenuTile(
                icon: LucideIcons.history,
                title: l.workHistTitle,
                subtitle: l.workHistMenuSubtitle,
                onTap: () => context.push(Routes.workerWorkHistory),
              ),
              MenuTile(
                icon: LucideIcons.briefcaseBusiness,
                title: l.jobsTitle,
                subtitle: l.jobsTabApplications,
                onTap: () => context.push(Routes.workerJobs),
              ),
              MenuTile(
                icon: LucideIcons.bellPlus,
                title: l.alertsTitle,
                subtitle: l.alertsMenuSubtitle,
                onTap: () => context.push(Routes.workerJobAlerts),
              ),
              MenuTile(
                icon: LucideIcons.mapPin,
                title: l.availTitle,
                subtitle: l.availMenuSubtitle,
                onTap: () => context.push(Routes.workerAvailability),
              ),
              MenuTile(
                icon: LucideIcons.calendarRange,
                title: l.shiftsTitle,
                onTap: () => context.push(Routes.workerShifts),
              ),
              MenuTile(
                icon: LucideIcons.clock,
                title: l.tsTitle,
                subtitle: l.tsMenuSubtitle,
                onTap: () => context.push(Routes.workerTimesheets),
              ),
              MenuTile(
                icon: LucideIcons.users,
                title: l.crewTitle,
                subtitle: l.crewMenuSubtitle,
                onTap: () => context.push(Routes.workerCrew),
              ),
              MenuTile(
                icon: LucideIcons.messageSquareWarning,
                title: l.disputesTitle,
                onTap: () => context.push(Routes.workerDisputes),
              ),
              if (ratings)
                MenuTile(
                  key: const Key('menu_ratings'),
                  icon: LucideIcons.star,
                  title: l.ratingsTitle,
                  subtitle: l.ratingsMenuSubtitle,
                  onTap: () => context.push(Routes.workerRatings),
                ),
              if (corrections)
                MenuTile(
                  key: const Key('menu_corrections'),
                  icon: LucideIcons.calendarCog,
                  title: l.corrTitle,
                  subtitle: l.corrMenuSubtitle,
                  onTap: () => context.push(Routes.workerCorrections),
                ),
            ],
          ),
        ),
        GroupLabel(l.ecoGroupSkills),
        Card(
          child: Column(
            children: [
              MenuTile(
                icon: LucideIcons.idCard,
                title: l.passportTitle,
                subtitle: l.passportMenuSubtitle,
                onTap: () => context.push(Routes.workerPassport),
              ),
              MenuTile(
                icon: LucideIcons.award,
                title: l.credTitle,
                subtitle: l.credMenuSubtitle,
                onTap: () => context.push(Routes.workerCredentials),
              ),
              MenuTile(
                icon: LucideIcons.graduationCap,
                title: l.trainTitle,
                subtitle: l.trainMenuSubtitle,
                onTap: () => context.push(Routes.workerTraining),
              ),
              MenuTile(
                icon: LucideIcons.trendingUp,
                title: l.careerTitle,
                subtitle: l.careerMenuSubtitle,
                onTap: () => context.push(Routes.workerCareer),
              ),
            ],
          ),
        ),
        GroupLabel(l.ecoGroupAbroad),
        Card(
          child: MenuTile(
            icon: LucideIcons.plane,
            title: l.mobTitle,
            subtitle: l.mobMenuSubtitle,
            onTap: () => context.push(Routes.workerMobility),
          ),
        ),
        GroupLabel(l.ecoGroupMoney),
        Card(
          child: MenuTile(
            icon: LucideIcons.handCoins,
            title: l.moneyTitle,
            subtitle: l.moneyMenuSubtitle,
            onTap: () => context.push(Routes.workerMoney),
          ),
        ),
        GroupLabel(l.ecoGroupPrivacy),
        Card(
          child: Column(
            children: [
              MenuTile(
                icon: LucideIcons.eye,
                title: l.profileViewsTitle,
                onTap: () => context.push(Routes.workerProfileViews),
              ),
              MenuTile(
                icon: LucideIcons.shieldCheck,
                title: l.privacyTitle,
                subtitle: l.privacyMenuSubtitle,
                onTap: () => context.push(Routes.workerPrivacy),
              ),
            ],
          ),
        ),
        GroupLabel(l.ecoGroupAccount),
        const Card(child: AccountHelpTiles()),
      ],
    );
  }
}
