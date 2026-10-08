import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kaamsathi/core/theme/app_theme.dart';
import 'package:kaamsathi/core/theme/tokens.dart';
import 'package:kaamsathi/core/widgets/common.dart';

/// WCAG 2.x relative luminance of an opaque colour.
double luminance(Color c) {
  double ch(double v) => v <= 0.03928 ? v / 12.92 : math.pow((v + 0.055) / 1.055, 2.4).toDouble();
  return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
}

/// WCAG contrast ratio between two opaque colours (1–21).
double contrast(Color a, Color b) {
  final la = luminance(a);
  final lb = luminance(b);
  final hi = math.max(la, lb);
  final lo = math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

void main() {
  test('contrast() matches known WCAG values', () {
    expect(contrast(Colors.black, Colors.white), closeTo(21, 0.01));
    // #2563EB on white is the documented 5.17:1.
    expect(contrast(KsPalette.actionPrimary, Colors.white), closeTo(5.17, 0.02));
  });

  for (final (name, ks) in [('light', KsColors.light), ('dark', KsColors.dark)]) {
    group('KsColors.$name', () {
      const statusPairs = ['success', 'warning', 'error', 'info', 'verified', 'neutral'];

      test('every status *.text on *.soft meets 4.5:1', () {
        for (final key in statusPairs) {
          final (fg, bg) = ks.textPairs[key]!;
          expect(contrast(fg, bg), greaterThanOrEqualTo(4.5), reason: '$name $key text/soft');
        }
      });

      test('every declared text pair meets 4.5:1', () {
        ks.textPairs.forEach((key, pair) {
          final (fg, bg) = pair;
          expect(contrast(fg, bg), greaterThanOrEqualTo(4.5), reason: '$name $key');
        });
      });

      test('status fills clear 3:1 as UI indicators on the surface', () {
        for (final fill in [ks.success, ks.warning, ks.error, ks.info, ks.verified, ks.ratingStar]) {
          expect(contrast(fill, ks.surface), greaterThanOrEqualTo(3.0), reason: '$name $fill');
        }
      });
    });
  }

  test('theme exposes KsColors and maps brand tokens', () {
    for (final b in Brightness.values) {
      final theme = buildTheme(b, useGoogleFonts: false);
      final ks = theme.extension<KsColors>()!;
      expect(ks, b == Brightness.dark ? KsColors.dark : KsColors.light);
      expect(theme.colorScheme.primary, ks.actionPrimary);
      expect(theme.scaffoldBackgroundColor, ks.canvas);
      expect(theme.textTheme.bodyMedium!.fontSize, greaterThanOrEqualTo(KsSize.minBody));
      expect(theme.textTheme.bodyLarge!.fontFamilyFallback, contains(kDevanagariFamily));
      final sheet = theme.bottomSheetTheme.shape! as RoundedRectangleBorder;
      expect(sheet.borderRadius, const BorderRadius.vertical(top: Radius.circular(KsRadius.sheet)));
      expect(theme.inputDecorationTheme.constraints!.minHeight, greaterThanOrEqualTo(KsSize.touchTarget));
    }
    // Brand §19 destructive / on-colour pairs stay AA.
    final light = buildTheme(Brightness.light, useGoogleFonts: false).colorScheme;
    expect(contrast(light.onError, light.error), greaterThanOrEqualTo(4.5));
    expect(contrast(light.onSecondary, light.secondary), greaterThanOrEqualTo(4.5));
    expect(contrast(light.onTertiary, light.tertiary), greaterThanOrEqualTo(4.5));
    final dark = buildTheme(Brightness.dark, useGoogleFonts: false).colorScheme;
    expect(contrast(dark.onError, dark.error), greaterThanOrEqualTo(4.5));
    expect(contrast(dark.onSecondary, dark.secondary), greaterThanOrEqualTo(4.5));
    expect(contrast(dark.onTertiary, dark.tertiary), greaterThanOrEqualTo(4.5));
  });

  group('KsMotion', () {
    Future<Duration> resolve(WidgetTester tester, {required bool reduce}) async {
      late Duration d;
      await tester.pumpWidget(
        MediaQuery(
          data: MediaQueryData(disableAnimations: reduce),
          child: Builder(
            builder: (context) {
              d = KsMotion.of(context, KsMotion.base);
              return const SizedBox();
            },
          ),
        ),
      );
      return d;
    }

    testWidgets('keeps durations normally', (tester) async {
      expect(await resolve(tester, reduce: false), const Duration(milliseconds: 200));
    });

    testWidgets('zeroes durations under reduced motion', (tester) async {
      expect(await resolve(tester, reduce: true), Duration.zero);
    });
  });

  testWidgets('status badge pairs an icon with the label in *.text on *.soft', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: buildTheme(Brightness.light, useGoogleFonts: false),
        home: const Scaffold(body: StatusBadge(label: 'Verified', tone: Tone.verified)),
      ),
    );
    final icon = tester.widget<Icon>(find.byType(Icon));
    expect(icon.color, KsColors.light.verifiedText);
    final text = tester.widget<Text>(find.text('Verified'));
    expect(text.style!.color, KsColors.light.verifiedText);
  });

  group('street mural tokens (worker surfaces)', () {
    test('white text on the mural ground and the whole passport gradient meets 4.5:1', () {
      expect(contrast(KsMural.onGround, KsMural.ground), greaterThanOrEqualTo(4.5));
      for (final stop in KsMural.passportGradient) {
        expect(contrast(KsMural.onGround, stop), greaterThanOrEqualTo(4.5), reason: '$stop');
      }
    });

    test('ink text on yellow chips and paper meets 4.5:1', () {
      expect(contrast(KsPalette.accentOnFill, KsMural.strokeYellow), greaterThanOrEqualTo(4.5));
      expect(contrast(KsPalette.accentOnFill, KsMural.paper), greaterThanOrEqualTo(4.5));
    });

    test('ladder has five rungs; the palest earned rung has a visible edge on white', () {
      expect(KsMural.rungs, hasLength(5));
      expect(contrast(KsPalette.borderStrong, KsPalette.surfaceDefault), greaterThan(1.4));
    });

    test('supervisor ledger theme: dense cards, not expressive', () {
      final ledger = buildTheme(Brightness.light, useGoogleFonts: false, ledger: true);
      final mural = buildTheme(Brightness.light, useGoogleFonts: false);
      expect(ledger.extension<KsSurfaceStyle>()!.expressive, isFalse);
      expect(mural.extension<KsSurfaceStyle>()!.expressive, isTrue);
      final shape = ledger.cardTheme.shape! as RoundedRectangleBorder;
      expect(shape.borderRadius, BorderRadius.circular(KsRadius.dense));
    });
  });
}
