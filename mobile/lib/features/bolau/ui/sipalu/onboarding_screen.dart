import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/api/api_exception.dart';
import '../../../../core/api/json.dart';
import '../../../../core/auth/session.dart';
import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/router/router.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/eco.dart';
import '../../../../core/widgets/photo_picker.dart';
import '../../../../core/widgets/signature/signature.dart';
import '../../../common/ref_data.dart';
import '../../../worker/credentials/ui/credentials_screen.dart' show nstbLabel;
import '../../../worker/data/worker_models.dart';
import '../../../worker/preferences/availability_screen.dart' show DistrictPickerScreen;
import '../../../worker/profile/ui/languages_screen.dart' show spokenLanguageName;
import '../../bolau_logic.dart';
import '../../bolau_models.dart';
import '../../bolau_repository.dart';
import 'sipalu_editors.dart';

String onboardingStepTitle(AppLocalizations l, String step) => switch (step) {
  OnboardingStep.basics => l.blStepBasics,
  OnboardingStep.skills => l.blStepSkills,
  OnboardingStep.languages => l.blStepLanguages,
  OnboardingStep.area => l.blStepArea,
  OnboardingStep.availability => l.blStepAvailability,
  OnboardingStep.services => l.blStepServices,
  OnboardingStep.payment => l.blStepPayment,
  OnboardingStep.identity => l.blStepIdentity,
  OnboardingStep.handle => l.blStepHandle,
  _ => step,
};

/// Not a server onboarding step: the profile screen also claims the handle
/// with `POST /me/sipalu/handle`.
const handleCall = '_handle';

/// Sipalu onboarding wizard (save-and-resume): every "Save and continue"
/// posts one or more `POST /me/sipalu/onboarding-step {step, data}` calls
/// (multipart when a photo / ID image is attached); the server answers with
/// the completed steps, the next step and the completeness meter.
class SipaluOnboardingScreen extends ConsumerWidget {
  const SipaluOnboardingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = ref.watch(mySipaluProvider);
    final l = context.l10n;
    // No worker yet (first time): start from scratch. Only a network error
    // blocks the wizard.
    final Widget body;
    if (value.hasValue) {
      body = _Wizard(initial: value.requireValue);
    } else if (value.hasError) {
      final e = value.error;
      body =
          e is ApiException && e.isNetwork
              ? ErrorView(error: e, onRetry: () => ref.invalidate(mySipaluProvider))
              : const _Wizard(initial: MySipalu());
    } else {
      body = const Center(child: CircularProgressIndicator());
    }
    return Scaffold(appBar: AppBar(title: Text(l.blBecomeSipalu)), body: body);
  }
}

class _Wizard extends ConsumerStatefulWidget {
  const _Wizard({required this.initial});
  final MySipalu initial;

  @override
  ConsumerState<_Wizard> createState() => _WizardState();
}

class _WizardState extends ConsumerState<_Wizard> {
  late int _index = OnboardingStep.resumeIndex(widget.initial.onboarding);
  late int _completeness = widget.initial.completeness;
  late final Set<String> _done = {...widget.initial.onboarding.completedSteps};
  final _stepKey = GlobalKey<_StepState>();
  bool _busy = false;

  String get _step => OnboardingStep.all[_index];

  Future<void> _next() async {
    final calls = await _stepKey.currentState?.collect();
    if (calls == null || !mounted) return;
    setState(() => _busy = true);
    final l = context.l10n;
    try {
      final before = _completeness;
      final repo = ref.read(bolauRepositoryProvider);
      var r = OnboardingState(completedSteps: _done.toList(), completeness: _completeness);
      for (final c in calls) {
        if (c.step == handleCall) {
          await repo.setHandle('${c.data['handle']}');
        } else {
          r = await repo.onboardingStep(c.step, c.data, files: c.files);
        }
      }
      final session = ref.read(sessionProvider.notifier);
      // The first step creates the Worker for a brand-new Sipalu.
      if (!(ref.read(sessionProvider).me?.isWorker ?? false)) {
        try {
          await session.refreshMe();
        } catch (_) {}
      }
      if (!mounted) return;
      setState(() {
        _done
          ..add(_step)
          ..addAll(r.completedSteps);
        _completeness = r.completeness ?? _completeness;
      });
      final last = _index == OnboardingStep.all.length - 1;
      if (_completeness >= 100 && before < 100) {
        celebrate(context, l.blCelebrateProfile);
      }
      if (last) {
        await _finish();
      } else {
        // Move on; skip ahead to the server's next step when it is later.
        final next = r.nextStep == null ? -1 : OnboardingStep.all.indexOf(OnboardingStep.forServerStep(r.nextStep!));
        setState(() => _index = next > _index ? next : _index + 1);
      }
    } catch (e) {
      if (mounted) showSnack(context, errorText(context, e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _finish() async {
    ref.invalidate(mySipaluProvider);
    final notifier = ref.read(sessionProvider.notifier);
    if (ref.read(sessionProvider).me?.isWorker ?? false) {
      await notifier.setMode(AppMode.worker);
    }
    if (!mounted) return;
    showSnack(context, context.l10n.blOnboardingDone);
    context.go(Routes.workerBolau);
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final total = OnboardingStep.all.length;
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(KsSpace.page, KsSpace.s2, KsSpace.page, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                l.blStepOf(localizeDigits('${_index + 1}', lang), localizeDigits('$total', lang)),
                style: t.labelLarge?.copyWith(color: context.ks.textMuted),
              ),
              Text(onboardingStepTitle(l, _step), key: const Key('onboarding_step_title'), style: t.titleLarge),
              FractionBar(key: const Key('completeness_meter'), label: l.blProfileComplete, value: _completeness / 100),
            ],
          ),
        ),
        const Divider(height: KsSpace.s4),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(KsSpace.page, 0, KsSpace.page, KsSpace.page),
            children: [_buildStep()],
          ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(KsSpace.page, KsSpace.s2, KsSpace.page, KsSpace.s3),
            child: Row(
              children: [
                if (_index > 0)
                  Expanded(
                    child: OutlinedButton(
                      key: const Key('onboarding_back'),
                      onPressed: _busy ? null : () => setState(() => _index--),
                      child: Text(l.blBack),
                    ),
                  ),
                if (_index > 0) const SizedBox(width: KsSpace.s2),
                Expanded(
                  flex: 2,
                  child: FilledButton(
                    key: const Key('onboarding_next'),
                    onPressed: _busy ? null : _next,
                    child:
                        _busy
                            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                            : Text(_index == total - 1 ? l.blFinish : l.blSaveContinue, textAlign: TextAlign.center),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildStep() {
    final p = widget.initial;
    return switch (_step) {
      OnboardingStep.basics => _BasicsStep(key: _stepKey, profile: p),
      OnboardingStep.skills => _SkillsStep(key: _stepKey, profile: p),
      OnboardingStep.languages => _LanguagesStep(key: _stepKey),
      OnboardingStep.area => _AreaStep(key: _stepKey, profile: p),
      OnboardingStep.availability => _AvailabilityStep(key: _stepKey, profile: p),
      OnboardingStep.services => _ServicesStep(key: _stepKey, profile: p),
      OnboardingStep.payment => _PaymentStep(key: _stepKey, profile: p),
      OnboardingStep.identity => _IdentityStep(key: _stepKey, profile: p),
      _ => _HandleStep(key: _stepKey, profile: p),
    };
  }
}

/// Every step's state can produce its server calls (null = invalid, with
/// the reason shown in the form).
abstract class _StepState<T extends ConsumerStatefulWidget> extends ConsumerState<T> {
  Future<List<StepCall>?> collect();
}

StepCall _call(String step, Json data, [Map<String, String> files = const {}]) => (
  step: step,
  data: data,
  files: files,
);

// ---- 1. Basics -------------------------------------------------------------

class _BasicsStep extends ConsumerStatefulWidget {
  const _BasicsStep({super.key, required this.profile});
  final MySipalu profile;
  @override
  ConsumerState<_BasicsStep> createState() => _BasicsState();
}

class _BasicsState extends _StepState<_BasicsStep> {
  late final _name = TextEditingController(
    text: widget.profile.fullName.isNotEmpty ? widget.profile.fullName : (ref.read(sessionProvider).me?.fullName ?? ''),
  );
  late final _nameNe = TextEditingController(text: widget.profile.fullNameNe ?? '');
  String? _photo;

  final _form = GlobalKey<FormState>();

  @override
  void dispose() {
    _name.dispose();
    _nameNe.dispose();
    super.dispose();
  }

  @override
  Future<List<StepCall>?> collect() async {
    if (!(_form.currentState?.validate() ?? false)) return null;
    final hasPhoto = widget.profile.photo?.isNotEmpty ?? false;
    if (_photo == null && !hasPhoto) {
      showSnack(context, context.l10n.blPhotoNeeded, error: true);
      return null;
    }
    return [
      _call(ServerStep.name, basicsStep(name: _name.text, nameNe: _nameNe.text)),
      if (_photo != null) _call(ServerStep.photo, const {}, {'photo': _photo!}),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final has = widget.profile.photo?.isNotEmpty ?? false;
    return Form(
      key: _form,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextFormField(
            key: const Key('ob_name'),
            controller: _name,
            textCapitalization: TextCapitalization.words,
            decoration: InputDecoration(labelText: l.profileName),
            validator: (v) => (v?.trim().length ?? 0) < 2 ? l.ecoRequired : null,
          ),
          const SizedBox(height: KsSpace.s3),
          TextFormField(
            key: const Key('ob_name_ne'),
            controller: _nameNe,
            decoration: InputDecoration(labelText: l.ecoOptional(l.profileNameNe)),
          ),
          const SizedBox(height: KsSpace.s4),
          if (has && _photo == null) ...[
            Row(
              children: [
                CutPaperFrame(
                  width: 72,
                  tapeColor: context.ks.teal,
                  child: WorkerPhoto(name: _name.text, url: widget.profile.photo),
                ),
                const SizedBox(width: KsSpace.s3),
                Expanded(child: Text(l.blPhotoOnFile)),
              ],
            ),
            const SizedBox(height: KsSpace.s2),
          ],
          DocumentPhotoPicker(
            label: has ? l.blChangePhoto : l.blYourPhoto,
            path: _photo,
            onChanged: (p) => setState(() => _photo = p),
            maxBytes: 5 * 1024 * 1024,
          ),
          const SizedBox(height: KsSpace.s2),
          Text(l.blPhotoHint, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}

// ---- 2. Skills -------------------------------------------------------------

const nstbLevels = ['none', 'elementary', 'level1', 'level2', 'level3'];

class _SkillsStep extends ConsumerStatefulWidget {
  const _SkillsStep({super.key, required this.profile});
  final MySipalu profile;
  @override
  ConsumerState<_SkillsStep> createState() => _SkillsState();
}

class _SkillsState extends _StepState<_SkillsStep> {
  late final List<SipaluSkill> _skills = [...widget.profile.skills.where((s) => s.trade.code.isNotEmpty)];

  @override
  Future<List<StepCall>?> collect() async {
    if (_skills.isEmpty) {
      showSnack(context, context.l10n.blAddOneSkill, error: true);
      return null;
    }
    return [_call(ServerStep.skills, skillsStep(_skills))];
  }

  void _toggle(Trade t) => setState(() {
    final i = _skills.indexWhere((s) => s.trade.code == t.code);
    if (i >= 0) {
      _skills.removeAt(i);
    } else {
      _skills.add(SipaluSkill(trade: t, years: 1));
    }
  });

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final trades = ref.watch(tradesProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(l.blSkillsHint, style: t.bodyMedium),
        const SizedBox(height: KsSpace.s2),
        FeatureAsyncSection<List<Trade>>(
          value: trades,
          onRetry: () => ref.invalidate(tradesProvider),
          data:
              (list) => Wrap(
                spacing: KsSpace.s2,
                runSpacing: KsSpace.s2,
                children: [
                  for (final tr in list)
                    FilterChip(
                      key: Key('skill_${tr.code}'),
                      label: Text(tr.name(lang)),
                      selected: _skills.any((s) => s.trade.code == tr.code),
                      onSelected: (_) => _toggle(tr),
                    ),
                ],
              ),
        ),
        for (var i = 0; i < _skills.length; i++) ...[
          const SizedBox(height: KsSpace.s3),
          SectionCard(
            title: '${_skills[i].trade.name(lang)}${i == 0 ? ' · ${l.blMainSkill}' : ''}',
            child: Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<int>(
                    key: Key('skill_years_$i'),
                    value: _skills[i].years.round().clamp(0, 30),
                    isExpanded: true,
                    decoration: InputDecoration(labelText: l.blYears),
                    items: [
                      for (final y in [0, 1, 2, 3, 5, 8, 10, 15, 20, 30])
                        DropdownMenuItem(value: y, child: Text(localizeDigits('$y', lang))),
                    ],
                    onChanged:
                        (v) => setState(
                          () =>
                              _skills[i] = SipaluSkill(
                                trade: _skills[i].trade,
                                years: v ?? 0,
                                nstbLevel: _skills[i].nstbLevel,
                              ),
                        ),
                  ),
                ),
                const SizedBox(width: KsSpace.s2),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    value: nstbLevels.contains(_skills[i].nstbLevel) ? _skills[i].nstbLevel : 'none',
                    isExpanded: true,
                    decoration: InputDecoration(labelText: l.blNstbLevel),
                    items: [
                      for (final n in nstbLevels)
                        DropdownMenuItem(
                          value: n,
                          child: Text(
                            n == 'none' ? l.blNstbNone : nstbLabel(l, n, lang),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                    ],
                    onChanged:
                        (v) => setState(
                          () =>
                              _skills[i] = SipaluSkill(
                                trade: _skills[i].trade,
                                years: _skills[i].years,
                                nstbLevel: v ?? 'none',
                              ),
                        ),
                  ),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: KsSpace.s2),
        Text(l.blNstbHint, style: t.bodySmall),
      ],
    );
  }
}

// ---- 3. Languages ----------------------------------------------------------

class _LanguagesStep extends ConsumerStatefulWidget {
  const _LanguagesStep({super.key});
  @override
  ConsumerState<_LanguagesStep> createState() => _LanguagesState();
}

class _LanguagesState extends _StepState<_LanguagesStep> {
  final Set<String> _codes = {'ne'};

  @override
  Future<List<StepCall>?> collect() async {
    if (_codes.isEmpty) {
      showSnack(context, context.l10n.blPickOneLanguage, error: true);
      return null;
    }
    return [
      _call(
        ServerStep.languages,
        languagesStep([
          for (final c in SpokenLanguageCodes.all.where(_codes.contains))
            (code: c, proficiency: c == 'ne' ? 'fluent' : 'conversational'),
        ]),
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(l.blLanguagesHint, style: Theme.of(context).textTheme.bodyMedium),
        const SizedBox(height: KsSpace.s2),
        Wrap(
          spacing: KsSpace.s2,
          runSpacing: KsSpace.s2,
          children: [
            for (final c in SpokenLanguageCodes.all.take(12))
              FilterChip(
                key: Key('lang_$c'),
                label: Text(spokenLanguageName(l, c)),
                selected: _codes.contains(c),
                onSelected: (v) => setState(() => v ? _codes.add(c) : _codes.remove(c)),
              ),
          ],
        ),
      ],
    );
  }
}

// ---- 4. Area ---------------------------------------------------------------

const sipaluRadiusChoices = [2, 5, 10, 25];

class _AreaStep extends ConsumerStatefulWidget {
  const _AreaStep({super.key, required this.profile});
  final MySipalu profile;
  @override
  ConsumerState<_AreaStep> createState() => _AreaState();
}

class _AreaState extends _StepState<_AreaStep> {
  late List<District> _districts = [
    ...widget.profile.serviceDistricts,
    if (widget.profile.serviceDistricts.isEmpty && widget.profile.district != null) widget.profile.district!,
  ];
  late int _radius = sipaluRadiusChoices.contains(widget.profile.serviceRadiusKm) ? widget.profile.serviceRadiusKm! : 5;

  @override
  Future<List<StepCall>?> collect() async {
    if (_districts.isEmpty) {
      showSnack(context, context.l10n.blPickOneDistrict, error: true);
      return null;
    }
    return [
      _call(
        ServerStep.serviceArea,
        areaStep(
          homeDistrict: widget.profile.district?.code,
          districtCodes: _districts.map((d) => d.code).toList(),
          radiusKm: _radius,
        ),
      ),
    ];
  }

  Future<void> _pick() async {
    final picked = await Navigator.of(context).push<List<District>>(
      MaterialPageRoute(fullscreenDialog: true, builder: (_) => DistrictPickerScreen(selected: _districts)),
    );
    if (picked != null) setState(() => _districts = picked);
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(l.blAreaHint, style: t.bodyMedium),
        const SizedBox(height: KsSpace.s3),
        Wrap(
          spacing: KsSpace.s2,
          runSpacing: KsSpace.s2,
          children: [
            for (final d in _districts)
              InputChip(label: Text(d.name(lang)), onDeleted: () => setState(() => _districts.remove(d))),
          ],
        ),
        const SizedBox(height: KsSpace.s2),
        OutlinedButton.icon(
          key: const Key('ob_pick_districts'),
          onPressed: _pick,
          icon: const Icon(LucideIcons.mapPin),
          label: Text(l.blPickDistricts),
        ),
        const SizedBox(height: KsSpace.s4),
        Text(l.blHowFar, style: t.titleSmall),
        const SizedBox(height: KsSpace.s2),
        Wrap(
          spacing: KsSpace.s2,
          children: [
            for (final r in sipaluRadiusChoices)
              ChoiceChip(
                key: Key('radius_$r'),
                label: Text(l.blKm(localizeDigits('$r', lang))),
                selected: _radius == r,
                onSelected: (_) => setState(() => _radius = r),
              ),
          ],
        ),
        const SizedBox(height: KsSpace.s3),
        InfoNote(icon: LucideIcons.eyeOff, text: l.blAreaPrivacy),
      ],
    );
  }
}

// ---- 5. Availability -------------------------------------------------------

class _AvailabilityStep extends ConsumerStatefulWidget {
  const _AvailabilityStep({super.key, required this.profile});
  final MySipalu profile;
  @override
  ConsumerState<_AvailabilityStep> createState() => _AvailabilityState();
}

class _AvailabilityState extends _StepState<_AvailabilityStep> {
  late List<AvailabilityRule> _rules =
      widget.profile.availability.isEmpty ? defaultWeek() : widget.profile.availability;
  late final List<TimeOff> _off = [...widget.profile.timeOff];

  @override
  Future<List<StepCall>?> collect() async {
    final l = context.l10n;
    if (_rules.isEmpty) {
      showSnack(context, l.blPickOneDay, error: true);
      return null;
    }
    if (!rulesValid(_rules)) {
      showSnack(context, l.blEndAfterStart, error: true);
      return null;
    }
    // Time off is its own resource; new entries are added after the rules.
    final repo = ref.read(bolauRepositoryProvider);
    for (final o in _off.where((o) => o.id.isEmpty)) {
      try {
        await repo.addTimeOff(o);
      } catch (_) {}
    }
    return [_call(ServerStep.availability, availabilityStep(_rules))];
  }

  Future<void> _addOff() async {
    final today = nepalToday();
    final r = await showDateRangePicker(context: context, firstDate: today, lastDate: DateTime(today.year + 1));
    if (r == null) return;
    setState(() => _off.add(TimeOff(from: isoDate(r.start), to: isoDate(r.end))));
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        WeeklyHoursEditor(rules: _rules, onChanged: (r) => setState(() => _rules = r)),
        const SizedBox(height: KsSpace.s4),
        Text(l.blTimeOff, style: Theme.of(context).textTheme.titleSmall),
        for (final o in _off)
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(LucideIcons.calendarOff),
            title: Text('${formatBsOrAd(null, o.from, lang)} – ${formatBsOrAd(null, o.to, lang)}'),
            trailing: IconButton(
              tooltip: l.ecoRemove,
              onPressed: () => setState(() => _off.remove(o)),
              icon: const Icon(LucideIcons.x),
            ),
          ),
        TextButton.icon(onPressed: _addOff, icon: const Icon(LucideIcons.plus), label: Text(l.blAddTimeOff)),
      ],
    );
  }
}

// ---- 6. Services -----------------------------------------------------------

class _ServicesStep extends ConsumerStatefulWidget {
  const _ServicesStep({super.key, required this.profile});
  final MySipalu profile;
  @override
  ConsumerState<_ServicesStep> createState() => _ServicesState();
}

class _ServicesState extends _StepState<_ServicesStep> {
  late final List<SipaluService> _services = [...widget.profile.services];

  List<Trade> get _trades => widget.profile.skills.map((s) => s.trade).where((t) => t.code.isNotEmpty).toList();

  @override
  Future<List<StepCall>?> collect() async {
    if (_services.isEmpty) {
      showSnack(context, context.l10n.blAddOneService, error: true);
      return null;
    }
    return [_call(ServerStep.services, servicesStep(_services))];
  }

  Future<void> _edit([int? i]) async {
    var trades = _trades;
    if (trades.isEmpty) {
      try {
        trades = await ref.read(tradesProvider.future);
      } catch (_) {}
    }
    if (!mounted) return;
    final s = await showServiceSheet(context, initial: i == null ? null : _services[i], trades: trades);
    if (s == null) return;
    setState(() => i == null ? _services.add(s) : _services[i] = s);
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(l.blServicesHint, style: Theme.of(context).textTheme.bodyMedium),
        const SizedBox(height: KsSpace.s2),
        for (var i = 0; i < _services.length; i++)
          ServiceTile(
            key: Key('ob_service_$i'),
            service: _services[i],
            onEdit: () => _edit(i),
            onDelete: () => setState(() => _services.removeAt(i)),
          ),
        OutlinedButton.icon(
          key: const Key('ob_add_service'),
          onPressed: _edit,
          icon: const Icon(LucideIcons.plus),
          label: Text(l.blAddService),
        ),
        const SizedBox(height: KsSpace.s3),
        const DirectPayNote(),
      ],
    );
  }
}

// ---- 7. Payment ------------------------------------------------------------

class _PaymentStep extends ConsumerStatefulWidget {
  const _PaymentStep({super.key, required this.profile});
  final MySipalu profile;
  @override
  ConsumerState<_PaymentStep> createState() => _PaymentState();
}

class _PaymentState extends _StepState<_PaymentStep> {
  late String _method =
      directPaymentMethods.contains(widget.profile.paymentMethod) ? widget.profile.paymentMethod! : 'esewa';
  late final _wallet = TextEditingController(text: widget.profile.walletId ?? '');
  late final _bank = TextEditingController(text: widget.profile.bankName ?? '');
  late final _account = TextEditingController(text: widget.profile.bankAccountNo ?? '');
  late final _accountName = TextEditingController(text: widget.profile.bankAccountName ?? widget.profile.fullName);
  final _form = GlobalKey<FormState>();

  @override
  void dispose() {
    for (final c in [_wallet, _bank, _account, _accountName]) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Future<List<StepCall>?> collect() async {
    if (!(_form.currentState?.validate() ?? false)) return null;
    return [
      _call(
        ServerStep.payment,
        paymentStep(
          method: _method,
          walletId: _wallet.text,
          bankName: _bank.text,
          bankAccountNo: _account.text,
          bankAccountName: _accountName.text,
        ),
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    String? req(String? v) => (v?.trim().isEmpty ?? true) ? l.ecoRequired : null;
    return Form(
      key: _form,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const DirectPayNote(),
          const SizedBox(height: KsSpace.s3),
          Wrap(
            spacing: KsSpace.s2,
            runSpacing: KsSpace.s2,
            children: [
              for (final m in directPaymentMethods)
                ChoiceChip(
                  key: Key('pay_$m'),
                  label: Text(paymentMethodLabel(l, m)),
                  selected: _method == m,
                  onSelected: (_) => setState(() => _method = m),
                ),
            ],
          ),
          const SizedBox(height: KsSpace.s3),
          if (_method == 'esewa' || _method == 'khalti')
            TextFormField(
              key: const Key('pay_wallet'),
              controller: _wallet,
              keyboardType: TextInputType.phone,
              decoration: InputDecoration(labelText: l.blWalletId(paymentMethodLabel(l, _method))),
              validator: req,
            ),
          if (_method == 'bank') ...[
            TextFormField(controller: _bank, decoration: InputDecoration(labelText: l.profileBankName), validator: req),
            const SizedBox(height: KsSpace.s2),
            TextFormField(
              controller: _account,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(labelText: l.profileAccountNo),
              validator: req,
            ),
            const SizedBox(height: KsSpace.s2),
            TextFormField(
              controller: _accountName,
              decoration: InputDecoration(labelText: l.profileAccountName),
              validator: req,
            ),
          ],
          const SizedBox(height: KsSpace.s2),
          Text(l.blOwnAccountOnly, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}

// ---- 8. Identity -----------------------------------------------------------

/// ID numbers the server takes (`citizenship_no` / `nid_no`).
const idTypes = ['citizenship', 'nid'];

class _IdentityStep extends ConsumerStatefulWidget {
  const _IdentityStep({super.key, required this.profile});
  final MySipalu profile;
  @override
  ConsumerState<_IdentityStep> createState() => _IdentityState();
}

class _IdentityState extends _StepState<_IdentityStep> {
  String _type = 'citizenship';
  final _number = TextEditingController();
  String? _front;
  String? _back;
  final _form = GlobalKey<FormState>();

  bool get _alreadySent =>
      widget.profile.verificationStatus == 'pending' || widget.profile.verificationStatus == 'verified';

  @override
  void dispose() {
    _number.dispose();
    super.dispose();
  }

  @override
  Future<List<StepCall>?> collect() async {
    final l = context.l10n;
    if (_alreadySent && _front == null) return const [];
    if (!(_form.currentState?.validate() ?? false)) return null;
    if (_front == null) {
      showSnack(context, l.blIdPhotoNeeded, error: true);
      return null;
    }
    return [
      _call(ServerStep.identity, identityStep(idType: _type, idNumber: _number.text), {
        'id_front': _front!,
        if (_back != null) 'id_back': _back!,
      }),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final status = widget.profile.verificationStatus;
    return Form(
      key: _form,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_alreadySent)
            InfoNote(
              key: const Key('id_already_sent'),
              tone: status == 'verified' ? Tone.verified : Tone.info,
              icon: status == 'verified' ? LucideIcons.badgeCheck : LucideIcons.hourglass,
              text: status == 'verified' ? l.blIdVerifiedNote : l.blIdPendingNote,
            )
          else
            InfoNote(icon: LucideIcons.lock, text: l.blIdWhy),
          const SizedBox(height: KsSpace.s3),
          Wrap(
            spacing: KsSpace.s2,
            runSpacing: KsSpace.s2,
            children: [
              for (final t in idTypes)
                ChoiceChip(
                  label: Text(t == 'nid' ? l.termNid : l.blCitizenship),
                  selected: _type == t,
                  onSelected: (_) => setState(() => _type = t),
                ),
            ],
          ),
          const SizedBox(height: KsSpace.s3),
          TextFormField(
            key: const Key('id_number'),
            controller: _number,
            decoration: InputDecoration(labelText: l.blIdNumber),
            validator: (v) => !_alreadySent && (v?.trim().isEmpty ?? true) ? l.ecoRequired : null,
          ),
          const SizedBox(height: KsSpace.s3),
          DocumentPhotoPicker(
            label: l.blIdFront,
            path: _front,
            onChanged: (p) => setState(() => _front = p),
            maxBytes: 8 * 1024 * 1024,
          ),
          const SizedBox(height: KsSpace.s3),
          DocumentPhotoPicker(
            label: l.ecoOptional(l.blIdBack),
            path: _back,
            onChanged: (p) => setState(() => _back = p),
            maxBytes: 8 * 1024 * 1024,
          ),
        ],
      ),
    );
  }
}

// ---- 9. Handle & headline --------------------------------------------------

class _HandleStep extends ConsumerStatefulWidget {
  const _HandleStep({super.key, required this.profile});
  final MySipalu profile;
  @override
  ConsumerState<_HandleStep> createState() => _HandleState();
}

class _HandleState extends _StepState<_HandleStep> {
  late final _handle = TextEditingController(
    text:
        widget.profile.handle ??
        suggestHandle(
          widget.profile.fullName.isEmpty ? (ref.read(sessionProvider).me?.fullName ?? '') : widget.profile.fullName,
        ),
  );
  late final _headline = TextEditingController(text: widget.profile.headline ?? '');
  late final _headlineNe = TextEditingController(text: widget.profile.headlineNe ?? '');
  bool _consent = false;
  final _form = GlobalKey<FormState>();

  @override
  void dispose() {
    for (final c in [_handle, _headline, _headlineNe]) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Future<List<StepCall>?> collect() async {
    final l = context.l10n;
    if (!(_form.currentState?.validate() ?? false)) return null;
    if (!_consent) {
      showSnack(context, l.blConsentNeeded, error: true);
      return null;
    }
    return [
      _call(ServerStep.headline, headlineStep(headline: _headline.text, headlineNe: _headlineNe.text)),
      _call(handleCall, {'handle': _handle.text.trim().toLowerCase()}),
      _call(ServerStep.consent, consentStep(publicProfile: true)),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    return Form(
      key: _form,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextFormField(
            key: const Key('ob_headline'),
            controller: _headline,
            maxLength: 80,
            decoration: InputDecoration(labelText: l.blHeadline, hintText: l.blHeadlineHint),
            validator: (v) => (v?.trim().isEmpty ?? true) ? l.ecoRequired : null,
          ),
          TextFormField(
            controller: _headlineNe,
            maxLength: 80,
            decoration: InputDecoration(labelText: l.ecoOptional(l.blHeadlineNe)),
          ),
          TextFormField(
            key: const Key('ob_handle'),
            controller: _handle,
            maxLength: 30,
            autocorrect: false,
            decoration: InputDecoration(
              labelText: l.blHandle,
              prefixText: 'kaamsathi.com/sipalu/',
              helperText: l.blHandleHint,
            ),
            validator: (v) => isValidHandle(v ?? '') ? null : l.blHandleInvalid,
          ),
          const SizedBox(height: KsSpace.s2),
          CheckboxListTile(
            key: const Key('ob_consent'),
            contentPadding: EdgeInsets.zero,
            controlAffinity: ListTileControlAffinity.leading,
            value: _consent,
            onChanged: (v) => setState(() => _consent = v ?? false),
            title: Text(l.blConsentPublic),
            subtitle: Text(l.blConsentPublicHint, style: t.bodySmall),
          ),
        ],
      ),
    );
  }
}
