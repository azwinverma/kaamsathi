import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'tokens.dart';

/// Devanagari family bundled under assets/fonts (see pubspec.yaml).
const kDevanagariFamily = 'Noto Sans Devanagari';

/// Inter first, then Noto Sans Devanagari for Nepali glyphs.
const kFontFallback = ['Inter', kDevanagariFamily];

/// Builds the KaamSathi Material 3 theme from design/tokens.json.
///
/// [lang] tweaks typography: Devanagari gets ~10% taller line-height
/// (tokens.json `devanagariLineHeightBoost`) and no negative letter-spacing on
/// headings. [useGoogleFonts] is disabled in widget tests to avoid font
/// loading.
///
/// [ledger] selects the supervisor "documentary ledger" surface (DIRECTION.md
/// direction A): dense 10px cards, neutral navigation indicator and no
/// expressive elements ([KsSurfaceStyle.ledger]). The default is the worker
/// "street mural" surface (direction B).
ThemeData buildTheme(Brightness brightness, {String lang = 'en', bool useGoogleFonts = true, bool ledger = false}) {
  final dark = brightness == Brightness.dark;
  final ne = lang == 'ne';
  final ks = dark ? KsColors.dark : KsColors.light;

  final scheme = ColorScheme(
    brightness: brightness,
    primary: ks.actionPrimary,
    onPrimary: ks.onActionPrimary,
    primaryContainer: ks.actionPrimarySubtle,
    onPrimaryContainer: ks.onActionPrimarySubtle,
    // Indigo = brand depth / secondary primary actions (brand §4).
    secondary: dark ? KsPalette.darkIndigo : KsPalette.brandIndigo,
    onSecondary: dark ? KsPalette.darkActionPrimaryFg : KsPalette.textInverse,
    secondaryContainer: ks.indigoSubtle,
    onSecondaryContainer: ks.indigo,
    // Teal = growth / skill accent.
    tertiary: ks.tealText,
    onTertiary: dark ? KsPalette.accentOnFill : KsPalette.textInverse,
    tertiaryContainer: ks.tealSubtle,
    onTertiaryContainer: ks.tealText,
    error: ks.error,
    onError: dark ? KsPalette.accentOnFill : KsPalette.textInverse,
    errorContainer: ks.errorSoft,
    onErrorContainer: ks.errorText,
    surface: ks.surface,
    onSurface: ks.textPrimary,
    onSurfaceVariant: ks.textMuted,
    surfaceContainerLowest: ks.surface,
    surfaceContainerLow: ks.canvas,
    surfaceContainer: ks.canvas,
    surfaceContainerHigh: ks.surfaceMuted,
    surfaceContainerHighest: ks.surfaceMuted,
    outline: ks.borderStrong,
    outlineVariant: ks.border,
    inverseSurface: ks.textPrimary,
    onInverseSurface: ks.surface,
    inversePrimary: dark ? KsPalette.actionPrimary : KsPalette.darkActionPrimarySubtleFg,
    shadow: KsPalette.textPrimary,
    scrim: KsPalette.textPrimary,
    surfaceTint: Colors.transparent,
  );

  final lh = ne ? 1.1 : 1.0;
  TextStyle s(double size, double lineHeight, FontWeight w, {bool heading = false, Color? color}) => TextStyle(
    fontSize: size,
    height: lineHeight / size * lh,
    fontWeight: w,
    letterSpacing: heading && !ne ? -0.01 * size : 0,
    color: color ?? (heading ? ks.textPrimary : ks.textSecondary),
    fontFamilyFallback: kFontFallback,
  );

  // Mobile type scale (tokens.json type.mobile): H1 30/38, H2 24/32,
  // H3 20/28, Body 16/24, Caption 12/16. Body S 14/20 and Body L 18/28 come
  // from the shared scale. Primary information never goes below 14.
  var textTheme = TextTheme(
    displayLarge: s(36, 44, FontWeight.w700, heading: true),
    displayMedium: s(30, 38, FontWeight.w700, heading: true),
    displaySmall: s(30, 38, FontWeight.w700, heading: true),
    headlineLarge: s(30, 38, FontWeight.w700, heading: true), // H1
    headlineMedium: s(24, 32, FontWeight.w600, heading: true), // H2
    headlineSmall: s(20, 28, FontWeight.w600, heading: true), // H3
    titleLarge: s(20, 28, FontWeight.w600, heading: true), // H3 / app bar
    titleMedium: s(18, 28, FontWeight.w600, heading: true), // Body L semibold
    titleSmall: s(16, 24, FontWeight.w600, heading: true), // card titles
    bodyLarge: s(16, 24, FontWeight.w400), // Body
    bodyMedium: s(14, 20, FontWeight.w400), // Body S
    bodySmall: s(12, 16, FontWeight.w400, color: ks.textMuted), // Caption
    labelLarge: s(16, 24, FontWeight.w600), // buttons
    labelMedium: s(14, 20, FontWeight.w500), // controls, chips
    labelSmall: s(12, 16, FontWeight.w600), // badges, nav labels
  );
  if (useGoogleFonts) {
    // google_fonts replaces the fallback list with just 'Inter'; restore the
    // Devanagari fallback so Nepali glyphs use Noto Sans Devanagari.
    textTheme = GoogleFonts.interTextTheme(textTheme).apply(fontFamilyFallback: kFontFallback);
  }

  final controlShape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(KsRadius.control));
  // ≥44 px touch height (tokens.json touchTargetMin); 48 for primary buttons.
  const buttonSize = Size(64, 48);
  final buttonText = textTheme.labelLarge!.copyWith(color: null);
  const buttonPadding = EdgeInsets.symmetric(horizontal: 20, vertical: 12);
  const duration = KsMotion.control;

  OutlineInputBorder inputBorder(Color c, [double w = 1]) => OutlineInputBorder(
    borderRadius: BorderRadius.circular(KsRadius.control),
    borderSide: BorderSide(color: c, width: w),
  );

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: ks.canvas,
    canvasColor: ks.canvas,
    textTheme: textTheme,
    fontFamilyFallback: kFontFallback,
    dividerColor: ks.border,
    dividerTheme: DividerThemeData(color: ks.border, thickness: 1, space: 1),
    materialTapTargetSize: MaterialTapTargetSize.padded,
    visualDensity: VisualDensity.standard,
    focusColor: ks.focusRing.withValues(alpha: 0.12),
    extensions: [ks, if (ledger) KsSurfaceStyle.ledger else KsSurfaceStyle.mural],
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {
        TargetPlatform.android: KsPageTransitionsBuilder(ZoomPageTransitionsBuilder()),
        TargetPlatform.iOS: KsPageTransitionsBuilder(CupertinoPageTransitionsBuilder()),
        TargetPlatform.macOS: KsPageTransitionsBuilder(CupertinoPageTransitionsBuilder()),
        TargetPlatform.linux: KsPageTransitionsBuilder(ZoomPageTransitionsBuilder()),
        TargetPlatform.windows: KsPageTransitionsBuilder(ZoomPageTransitionsBuilder()),
        TargetPlatform.fuchsia: KsPageTransitionsBuilder(ZoomPageTransitionsBuilder()),
      },
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: ks.surface,
      foregroundColor: ks.textPrimary,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0.5,
      centerTitle: false,
      titleTextStyle: textTheme.titleLarge,
      shape: Border(bottom: BorderSide(color: ks.border)),
    ),
    cardTheme: CardThemeData(
      color: ks.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ledger ? KsRadius.dense : KsRadius.card),
        side: BorderSide(color: ks.border),
      ),
    ),
    // Brand §19 — Primary: blue fill / white text.
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: ks.actionPrimary,
        foregroundColor: ks.onActionPrimary,
        minimumSize: buttonSize,
        shape: controlShape,
        textStyle: buttonText,
        padding: buttonPadding,
        animationDuration: duration,
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: ks.actionPrimary,
        foregroundColor: ks.onActionPrimary,
        minimumSize: buttonSize,
        shape: controlShape,
        textStyle: buttonText,
        padding: buttonPadding,
        elevation: 0,
        animationDuration: duration,
      ),
    ),
    // Secondary: surface / blue border / blue text.
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        backgroundColor: ks.surface,
        foregroundColor: ks.actionPrimary,
        minimumSize: buttonSize,
        shape: controlShape,
        textStyle: buttonText,
        side: BorderSide(color: ks.actionPrimary),
        padding: buttonPadding,
        animationDuration: duration,
      ),
    ),
    // Tertiary: text-only blue.
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: ks.actionPrimary,
        minimumSize: const Size(KsSize.touchTarget, KsSize.touchTarget + 4),
        shape: controlShape,
        textStyle: buttonText,
        animationDuration: duration,
      ),
    ),
    iconButtonTheme: IconButtonThemeData(style: IconButton.styleFrom(minimumSize: const Size(48, 48))),
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: ButtonStyle(
        minimumSize: const WidgetStatePropertyAll(Size(KsSize.touchTarget, KsSize.touchTarget)),
        shape: WidgetStatePropertyAll(controlShape),
        side: WidgetStatePropertyAll(BorderSide(color: ks.borderStrong)),
        textStyle: WidgetStatePropertyAll(textTheme.labelMedium),
      ),
    ),
    // Brand §19 — inputs: 44px+ high, label shown above the value (never
    // placeholder-only), helper text below, inline validation.
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: ks.surface,
      constraints: const BoxConstraints(minHeight: KsSize.touchTarget + 4),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      floatingLabelBehavior: FloatingLabelBehavior.always,
      floatingLabelAlignment: FloatingLabelAlignment.start,
      labelStyle: textTheme.labelMedium?.copyWith(color: ks.textSecondary),
      floatingLabelStyle: textTheme.labelMedium?.copyWith(color: ks.textSecondary),
      hintStyle: textTheme.bodyLarge?.copyWith(color: ks.textMuted),
      helperStyle: textTheme.bodySmall?.copyWith(color: ks.textMuted),
      errorStyle: textTheme.bodySmall?.copyWith(color: ks.errorText),
      helperMaxLines: 3,
      errorMaxLines: 3,
      border: inputBorder(ks.borderStrong),
      enabledBorder: inputBorder(ks.borderStrong),
      focusedBorder: inputBorder(ks.focusRing, 2),
      errorBorder: inputBorder(ks.error),
      focusedErrorBorder: inputBorder(ks.error, 2),
      disabledBorder: inputBorder(ks.border),
    ),
    chipTheme: ChipThemeData(
      shape: const StadiumBorder(),
      side: BorderSide(color: ks.borderStrong),
      backgroundColor: ks.surface,
      selectedColor: ks.actionPrimarySubtle,
      checkmarkColor: ks.onActionPrimarySubtle,
      labelStyle: textTheme.labelMedium?.copyWith(color: ks.textSecondary),
      secondaryLabelStyle: textTheme.labelMedium?.copyWith(color: ks.onActionPrimarySubtle),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
    ),
    listTileTheme: ListTileThemeData(
      minVerticalPadding: 12,
      minTileHeight: KsSize.touchTarget + 4,
      iconColor: ks.textMuted,
      titleTextStyle: textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w500, color: ks.textPrimary),
      subtitleTextStyle: textTheme.bodyMedium?.copyWith(color: ks.textMuted),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: ks.surface,
      surfaceTintColor: Colors.transparent,
      indicatorColor: ledger ? ks.surfaceMuted : ks.actionPrimarySubtle,
      indicatorShape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(KsRadius.control)),
      elevation: 0,
      height: 68,
      // Selected label: AA blue + bold (mural) / primary text (ledger), so
      // the state is not carried by the indicator colour alone.
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) =>
            states.contains(WidgetState.selected)
                ? textTheme.labelSmall?.copyWith(
                  color: ledger ? ks.textPrimary : ks.onActionPrimarySubtle,
                  fontWeight: FontWeight.w700,
                )
                : textTheme.labelSmall?.copyWith(color: ks.textMuted),
      ),
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(
          size: 24,
          color:
              states.contains(WidgetState.selected)
                  ? (ledger ? ks.textPrimary : ks.onActionPrimarySubtle)
                  : ks.textMuted,
        ),
      ),
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(
      color: ks.actionPrimary,
      linearTrackColor: ks.neutralSoft,
      circularTrackColor: Colors.transparent,
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(KsRadius.control)),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      showDragHandle: true,
      backgroundColor: ks.surface,
      surfaceTintColor: Colors.transparent,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(KsRadius.sheet))),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: ks.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(KsRadius.sheet)),
    ),
    switchTheme: const SwitchThemeData(materialTapTargetSize: MaterialTapTargetSize.padded),
  );
}

/// Brand §19 — destructive: red, only for destructive actions.
ButtonStyle destructiveFilledStyle(BuildContext context) {
  final scheme = Theme.of(context).colorScheme;
  return FilledButton.styleFrom(backgroundColor: scheme.error, foregroundColor: scheme.onError);
}

/// Text-only destructive action (AA-safe error text colour).
ButtonStyle destructiveTextStyle(BuildContext context) => TextButton.styleFrom(foregroundColor: context.ks.errorText);

/// Wraps a platform page transition and drops it when the user has asked for
/// reduced motion (MediaQuery.disableAnimations).
class KsPageTransitionsBuilder extends PageTransitionsBuilder {
  const KsPageTransitionsBuilder(this.inner);

  final PageTransitionsBuilder inner;

  @override
  Duration get transitionDuration => inner.transitionDuration;

  @override
  Duration get reverseTransitionDuration => inner.reverseTransitionDuration;

  @override
  DelegatedTransitionBuilder? get delegatedTransition {
    final d = inner.delegatedTransition;
    if (d == null) return null;
    return (context, animation, secondaryAnimation, allowSnapshotting, child) =>
        KsMotion.reduced(context) ? child : d(context, animation, secondaryAnimation, allowSnapshotting, child);
  }

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    if (KsMotion.reduced(context)) return child;
    return inner.buildTransitions(route, context, animation, secondaryAnimation, child);
  }
}
