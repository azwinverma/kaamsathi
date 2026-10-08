import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/eco.dart';
import '../../data/worker_models.dart';
import '../../data/worker_repository.dart';

/// Localised name of a spoken-language code (falls back to the server label).
String spokenLanguageName(AppLocalizations l, String code, {String? fallback}) => switch (code) {
  'ne' => l.langNameNe,
  'en' => l.langNameEn,
  'hi' => l.langNameHi,
  'mai' => l.langNameMai,
  'bho' => l.langNameBho,
  'new' => l.langNameNew,
  'tha' => l.langNameTha,
  'tam' => l.langNameTam,
  'mgp' => l.langNameMgp,
  'gvr' => l.langNameGvr,
  'lim' => l.langNameLim,
  'bap' => l.langNameBap,
  'xsr' => l.langNameXsr,
  'dty' => l.langNameDty,
  'awa' => l.langNameAwa,
  'ur' => l.langNameUr,
  'ar' => l.langNameAr,
  'ms' => l.langNameMs,
  'ja' => l.langNameJa,
  'ko' => l.langNameKo,
  'zh' => l.langNameZh,
  _ => fallback ?? code,
};

String proficiencyLabel(AppLocalizations l, String p) => switch (p) {
  'basic' => l.profBasic,
  'fluent' => l.profFluent,
  'native' => l.profNative,
  _ => l.profConversational,
};

/// "Languages I speak": add / remove / set proficiency, then save the whole
/// list (`PATCH /me/worker {languages: [...]}` replaces it).
class LanguagesScreen extends ConsumerWidget {
  const LanguagesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final value = ref.watch(workerProfileProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.langTitle)),
      body: FeatureAsyncBody<WorkerProfile>(
        value: value,
        onRetry: () => ref.invalidate(workerProfileProvider),
        data: (p) => _Editor(initial: p.languages),
      ),
    );
  }
}

class _Editor extends ConsumerStatefulWidget {
  const _Editor({required this.initial});
  final List<SpokenLanguage> initial;

  @override
  ConsumerState<_Editor> createState() => _EditorState();
}

class _EditorState extends ConsumerState<_Editor> {
  late final List<SpokenLanguage> _list = [...widget.initial];
  bool _busy = false;

  Future<void> _add() async {
    final l = context.l10n;
    if (_list.length >= SpokenLanguageCodes.max) {
      showSnack(context, l.langMax, error: true);
      return;
    }
    final taken = _list.map((x) => x.code).toSet();
    final code = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder:
          (ctx) => SafeArea(
            child: ConstrainedBox(
              constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(ctx).height * 0.75),
              child: ListView(
                shrinkWrap: true,
                children: [
                  ListTile(title: Text(l.langPick, style: Theme.of(ctx).textTheme.titleMedium)),
                  for (final c in SpokenLanguageCodes.all)
                    if (!taken.contains(c))
                      ListTile(
                        key: Key('lang_pick_$c'),
                        title: Text(spokenLanguageName(l, c)),
                        onTap: () => Navigator.pop(ctx, c),
                      ),
                ],
              ),
            ),
          ),
    );
    if (code != null && mounted) setState(() => _list.add(SpokenLanguage(code: code)));
  }

  Future<void> _save() async {
    final l = context.l10n;
    setState(() => _busy = true);
    try {
      await ref.read(workerRepositoryProvider).updateProfile(languagesPatch(_list));
      ref.invalidate(workerProfileProvider);
      if (!mounted) return;
      showSnack(context, l.langSaved);
      await Navigator.of(context).maybePop();
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
    return ListView(
      padding: const EdgeInsets.all(KsSpace.page),
      children: [
        Text(l.langMenuSubtitle, style: t.bodyMedium),
        const SizedBox(height: KsSpace.s3),
        if (_list.isEmpty) EmptyState(icon: LucideIcons.languages, message: l.langEmpty),
        for (final (i, x) in _list.indexed)
          Card(
            key: Key('lang_row_${x.code}'),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(KsSpace.s4, KsSpace.s2, KsSpace.s2, KsSpace.s3),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(child: Text(spokenLanguageName(l, x.code, fallback: x.label), style: t.titleSmall)),
                      IconButton(
                        key: Key('lang_remove_${x.code}'),
                        tooltip: l.ecoRemove,
                        onPressed: () => setState(() => _list.removeAt(i)),
                        icon: const Icon(LucideIcons.trash2),
                      ),
                    ],
                  ),
                  Text(l.langProficiency, style: t.bodySmall),
                  const SizedBox(height: KsSpace.s1),
                  Wrap(
                    spacing: KsSpace.s2,
                    runSpacing: KsSpace.s1,
                    children: [
                      for (final p in SpokenLanguageCodes.proficiencies)
                        ChoiceChip(
                          key: Key('prof_${x.code}_$p'),
                          label: Text(proficiencyLabel(l, p)),
                          selected: x.proficiency == p,
                          onSelected: (_) => setState(() => _list[i] = x.withProficiency(p)),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        const SizedBox(height: KsSpace.s2),
        OutlinedButton.icon(
          key: const Key('lang_add'),
          onPressed: _busy ? null : _add,
          icon: const Icon(LucideIcons.plus),
          label: Text(l.langAdd),
        ),
        const SizedBox(height: KsSpace.s4),
        FilledButton(
          key: const Key('lang_save'),
          onPressed: _busy ? null : _save,
          child:
              _busy
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : Text(l.commonSave),
        ),
      ],
    );
  }
}
