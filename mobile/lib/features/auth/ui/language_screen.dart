import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../../../core/theme/tokens.dart';
import '../../../core/widgets/signature/signature.dart';

/// First-run language choice. Labels are shown in both scripts so anyone
/// can read them before a language is chosen.
class LanguageScreen extends ConsumerWidget {
  const LanguageScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = Theme.of(context).textTheme;
    Future<void> pick(String lang) => ref.read(languageProvider.notifier).set(lang);
    return Scaffold(
      body: SafeArea(
        child: LayoutBuilder(
          builder:
              (context, box) => SingleChildScrollView(
                padding: const EdgeInsets.all(KsSpace.s6),
                child: ConstrainedBox(
                  constraints: BoxConstraints(minHeight: box.maxHeight - KsSpace.s6 * 2),
                  child: IntrinsicHeight(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Spacer(),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(KsRadius.card),
                              child: Image.asset('assets/logo.png', width: 64, height: 64),
                            ),
                            const SizedBox(width: KsSpace.s6),
                            // Welcome photo slot (illustrated until the commissioned
                            // photo is bundled). Shown before a language is chosen, so
                            // the alt text is bilingual.
                            const CutPaperFrame(
                              width: 88,
                              aspectRatio: 4 / 5,
                              angle: 0.08,
                              child: ImageSlot(
                                slot: PhotoSlot.welcomeHajiri,
                                semanticLabel:
                                    'हाजिरीको QR स्क्यान गर्दै कामदार · A worker scanning the hajiri QR code',
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: KsSpace.s6),
                        Text('भाषा छान्नुहोस्', textAlign: TextAlign.center, style: t.headlineMedium),
                        const SizedBox(height: KsSpace.s1),
                        Text(
                          'Choose your language',
                          textAlign: TextAlign.center,
                          style: t.bodyLarge?.copyWith(color: context.ks.textMuted),
                        ),
                        const SizedBox(height: KsSpace.s8),
                        _LangButton(
                          key: const Key('lang_ne'),
                          title: 'नेपाली',
                          subtitle: 'Nepali',
                          onTap: () => pick('ne'),
                        ),
                        const SizedBox(height: KsSpace.s4),
                        _LangButton(
                          key: const Key('lang_en'),
                          title: 'English',
                          subtitle: 'अंग्रेजी',
                          onTap: () => pick('en'),
                        ),
                        const Spacer(flex: 2),
                      ],
                    ),
                  ),
                ),
              ),
        ),
      ),
    );
  }
}

class _LangButton extends StatelessWidget {
  const _LangButton({super.key, required this.title, required this.subtitle, required this.onTap});

  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: scheme.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(KsRadius.card),
        side: BorderSide(color: context.ks.border, width: 1.5),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(KsRadius.card),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: KsSpace.s6, vertical: KsSpace.s6),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: Theme.of(context).textTheme.headlineMedium),
                    Text(
                      subtitle,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: context.ks.textMuted),
                    ),
                  ],
                ),
              ),
              Icon(Icons.arrow_forward_rounded, color: scheme.primary, size: 28),
            ],
          ),
        ),
      ),
    );
  }
}
