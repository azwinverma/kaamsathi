import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/l10n.dart';
import '../providers.dart';

/// Compact EN / नेपाली switch for app bars.
class LanguageToggle extends ConsumerWidget {
  const LanguageToggle({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lang = ref.watch(langCodeProvider);
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: SegmentedButton<String>(
        showSelectedIcon: false,
        style: const ButtonStyle(visualDensity: VisualDensity.compact),
        segments: const [
          ButtonSegment(value: 'en', label: Text('EN')),
          ButtonSegment(value: 'ne', label: Text('ने')),
        ],
        selected: {lang},
        onSelectionChanged: (s) => ref.read(languageProvider.notifier).set(s.first),
      ),
    );
  }
}

/// Full-width language selector for profile/settings.
class LanguageSelector extends ConsumerWidget {
  const LanguageSelector({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lang = ref.watch(langCodeProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(context.l10n.languageLabel, style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 8),
        SegmentedButton<String>(
          showSelectedIcon: false,
          segments: const [
            ButtonSegment(value: 'en', label: Text('English')),
            ButtonSegment(value: 'ne', label: Text('नेपाली')),
          ],
          selected: {lang},
          onSelectionChanged: (s) => ref.read(languageProvider.notifier).set(s.first),
        ),
      ],
    );
  }
}
