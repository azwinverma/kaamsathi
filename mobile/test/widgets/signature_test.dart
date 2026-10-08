import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kaamsathi/core/l10n/l10n.dart';
import 'package:kaamsathi/core/theme/app_theme.dart';
import 'package:kaamsathi/core/widgets/common.dart';
import 'package:kaamsathi/core/widgets/signature/signature.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

/// Pumps [child] in a themed, localised app at phone width. [reduceMotion]
/// sets MediaQuery.disableAnimations (the platform "remove animations").
Future<void> _pump(
  WidgetTester tester,
  Widget child, {
  String lang = 'en',
  bool reduceMotion = false,
  bool ledger = false,
  bool settle = true,
}) async {
  tester.view.physicalSize = const Size(360, 1200);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    MaterialApp(
      locale: Locale(lang),
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      theme: buildTheme(Brightness.light, lang: lang, useGoogleFonts: false, ledger: ledger),
      builder:
          (context, w) => MediaQuery(data: MediaQuery.of(context).copyWith(disableAnimations: reduceMotion), child: w!),
      home: Scaffold(body: SingleChildScrollView(child: child)),
    ),
  );
  if (settle) {
    await tester.pumpAndSettle();
  } else {
    await tester.pump();
  }
}

double _height(WidgetTester tester, String key) => tester.getSize(find.byKey(Key(key))).height;

void main() {
  group('SkillLadder', () {
    test('verification level maps onto five rungs', () {
      expect([for (var l = 0; l <= 5; l++) ladderRungsForLevel(l)], [1, 2, 3, 4, 4, 5]);
      expect(ladderRungsForLevel(-1), 1);
      expect(ladderRungsForLevel(9), 5);
    });

    testWidgets('earned rungs are filled, the rest are dashed outlines', (tester) async {
      await _pump(tester, const SkillLadder(earned: 3));
      for (final i in [1, 2, 3]) {
        expect(find.byKey(Key('ladder_rung_${i}_earned')), findsOneWidget);
      }
      for (final i in [4, 5]) {
        expect(find.byKey(Key('ladder_rung_${i}_open')), findsOneWidget);
      }
      // Rungs rise left to right.
      expect(_height(tester, 'ladder_rung_1_earned'), lessThan(_height(tester, 'ladder_rung_3_earned')));
      expect(_height(tester, 'ladder_rung_4_open'), lessThan(_height(tester, 'ladder_rung_5_open')));
      // Visible labels.
      expect(find.text('Phone'), findsOneWidget);
      expect(find.text('Highly trusted'), findsOneWidget);
    });

    testWidgets('one summary for screen readers, with each step state', (tester) async {
      final handle = tester.ensureSemantics();
      await _pump(tester, const SkillLadder(earned: 2));
      final label = tester.getSemantics(find.byKey(const Key('skill_ladder'))).label;
      expect(label, contains('Skill ladder: 2 of 5 steps'));
      expect(label, contains('Phone: done'));
      expect(label, contains('Identity: done'));
      expect(label, contains('Work: not yet'));
      expect(label, contains('Highly trusted: not yet'));
      // The painted labels are not read twice.
      expect(find.bySemanticsLabel('Phone'), findsNothing);
      handle.dispose();
    });

    testWidgets('Nepali summary uses Devanagari digits', (tester) async {
      final handle = tester.ensureSemantics();
      await _pump(tester, const SkillLadder(earned: 4), lang: 'ne');
      final label = tester.getSemantics(find.byKey(const Key('skill_ladder'))).label;
      expect(label, contains('सीपको सीढी: ५ मध्ये ४ चरण'));
      expect(label, contains('अति भरपर्दो: बाँकी'));
      handle.dispose();
    });

    testWidgets('grows in once with motion, instantly under reduced motion', (tester) async {
      // With motion: the first frame shows a short rung that then grows.
      await _pump(tester, const SkillLadder(earned: 5), settle: false);
      final first = _height(tester, 'ladder_rung_5_earned');
      await tester.pumpAndSettle();
      final settled = _height(tester, 'ladder_rung_5_earned');
      expect(first, lessThan(settled));
      expect(settled, closeTo(76, 0.01));

      // Reduced motion: already at full height on the first frame.
      await _pump(tester, const SkillLadder(earned: 5, key: ValueKey('rm')), reduceMotion: true, settle: false);
      expect(_height(tester, 'ladder_rung_5_earned'), closeTo(76, 0.01));
      await tester.pump(const Duration(milliseconds: 100));
      expect(_height(tester, 'ladder_rung_5_earned'), closeTo(76, 0.01));
    });
  });

  group('MuralHeader', () {
    testWidgets('lettering, brush strokes and dots are hidden from semantics', (tester) async {
      final handle = tester.ensureSemantics();
      await _pump(tester, const MuralHeader(lettering: 'काम', child: Text('Namaste, Ram')));
      // Painted on screen…
      expect(find.text('काम'), findsOneWidget);
      expect(find.byType(BrushStroke), findsOneWidget);
      // …but only the real content is read out.
      expect(find.bySemanticsLabel('काम'), findsNothing);
      expect(find.bySemanticsLabel('Namaste, Ram'), findsOneWidget);
      handle.dispose();
    });

    testWidgets('renders at 360px in Nepali without overflow', (tester) async {
      await _pump(
        tester,
        const MuralHeader(
          lettering: 'सीप',
          overlap: 36,
          trailing: SizedBox(width: 44, height: 44),
          child: Text('नमस्ते, राम बहादुर थापा मगर'),
        ),
        lang: 'ne',
      );
      expect(tester.takeException(), isNull);
    });
  });

  group('Celebration', () {
    testWidgets('reduced motion: no burst, the message still shows', (tester) async {
      await _pump(tester, const SizedBox(), reduceMotion: true);
      final context = tester.element(find.byType(SizedBox).first);
      final animated = celebrate(context, 'Your profile is complete.');
      await tester.pump();
      expect(animated, isFalse);
      expect(find.byType(CelebrationBurst), findsNothing);
      expect(find.byType(Celebration), findsNothing);
      expect(find.text('Your profile is complete.'), findsOneWidget); // snack bar
    });

    testWidgets('with motion: a short burst that removes itself', (tester) async {
      await _pump(tester, const SizedBox());
      final context = tester.element(find.byType(SizedBox).first);
      final animated = celebrate(context, 'Training completed. Well done.', haptic: false);
      await tester.pump();
      expect(animated, isTrue);
      expect(find.byType(CelebrationBurst), findsOneWidget);
      expect(find.text('Training completed. Well done.'), findsOneWidget);
      await tester.pumpAndSettle();
      expect(find.byType(Celebration), findsNothing);
    });

    test('only real milestones have a message', () {
      expect(Milestone.values, hasLength(4));
    });
  });

  group('ImageSlot and illustrations', () {
    testWidgets('missing photo falls back to the illustration with alt text', (tester) async {
      final handle = tester.ensureSemantics();
      await _pump(
        tester,
        const SizedBox(
          width: 120,
          child: CutPaperFrame(
            width: 100,
            child: ImageSlot(slot: PhotoSlot.learnWorkshop, semanticLabel: 'Training at a workshop bench'),
          ),
        ),
      );
      expect(find.byKey(const Key('slot_fallback_mobile-learn-workshop')), findsOneWidget);
      expect(find.bySemanticsLabel('Training at a workshop bench'), findsOneWidget);
      handle.dispose();
    });

    test('every slot has a unique id under assets/photos', () {
      final ids = PhotoSlot.all.map((s) => s.id).toSet();
      expect(ids, hasLength(PhotoSlot.all.length));
      for (final s in PhotoSlot.all) {
        expect(s.assetPath, 'assets/photos/${s.id}.webp');
      }
    });

    testWidgets('empty states: illustrated on worker surfaces, plain on the ledger', (tester) async {
      const empty = EmptyState(icon: LucideIcons.briefcase, message: 'No jobs yet');
      await _pump(tester, empty);
      expect(find.byType(IllustratedIcon), findsOneWidget);
      await _pump(tester, empty, ledger: true);
      expect(find.byType(IllustratedIcon), findsNothing);
      expect(find.byIcon(LucideIcons.briefcase), findsOneWidget);
      // Errors are never decorated.
      await _pump(tester, const ErrorView(error: null));
      expect(find.byType(IllustratedIcon), findsNothing);
    });
  });
}
