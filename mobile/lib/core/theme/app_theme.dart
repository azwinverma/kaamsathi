import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'tokens.dart';

/// Builds the KaamSathi Material 3 theme from DESIGN.md tokens.
///
/// [lang] tweaks typography: Devanagari gets ~10% taller line-height and no
/// negative letter-spacing on headings. [useGoogleFonts] is disabled in
/// widget tests to avoid font loading.
ThemeData buildTheme(
  Brightness brightness, {
  String lang = 'en',
  bool useGoogleFonts = true,
}) {
  final dark = brightness == Brightness.dark;
  final ne = lang == 'ne';

  final scheme = dark
      ? const ColorScheme(
          brightness: Brightness.dark,
          primary: KsColors.primary400,
          onPrimary: Colors.white,
          primaryContainer: Color(0xFF1A2550),
          onPrimaryContainer: KsColors.primary100,
          secondary: KsColors.primary300,
          onSecondary: KsColors.neutral900,
          secondaryContainer: Color(0xFF222838),
          onSecondaryContainer: KsColors.darkText,
          tertiary: KsColors.accent500,
          onTertiary: Colors.white,
          error: Color(0xFFF07A75),
          onError: KsColors.neutral900,
          errorContainer: Color(0xFF3A1716),
          onErrorContainer: Color(0xFFF7B7B4),
          surface: KsColors.darkSurface,
          onSurface: KsColors.darkText,
          onSurfaceVariant: KsColors.darkTextSecondary,
          surfaceContainerLowest: KsColors.darkBackground,
          surfaceContainerLow: KsColors.darkBackground,
          surfaceContainer: KsColors.darkSurface,
          surfaceContainerHigh: Color(0xFF1C2130),
          surfaceContainerHighest: Color(0xFF222838),
          outline: KsColors.darkBorder,
          outlineVariant: KsColors.darkBorder,
          inverseSurface: KsColors.darkText,
          onInverseSurface: KsColors.neutral900,
          inversePrimary: KsColors.primary600,
          shadow: Colors.black,
          scrim: Colors.black,
        )
      : const ColorScheme(
          brightness: Brightness.light,
          primary: KsColors.primary600,
          onPrimary: Colors.white,
          primaryContainer: KsColors.primary50,
          onPrimaryContainer: KsColors.primary800,
          secondary: KsColors.primary700,
          onSecondary: Colors.white,
          secondaryContainer: KsColors.primary50,
          onSecondaryContainer: KsColors.primary800,
          tertiary: KsColors.accent500,
          onTertiary: Colors.white,
          error: KsColors.danger600,
          onError: Colors.white,
          errorContainer: KsColors.danger50,
          onErrorContainer: KsColors.danger600,
          surface: KsColors.neutral0,
          onSurface: KsColors.neutral900,
          onSurfaceVariant: KsColors.neutral500,
          surfaceContainerLowest: KsColors.neutral0,
          surfaceContainerLow: KsColors.neutral25,
          surfaceContainer: KsColors.neutral50,
          surfaceContainerHigh: KsColors.neutral100,
          surfaceContainerHighest: KsColors.neutral100,
          outline: KsColors.neutral300,
          outlineVariant: KsColors.neutral200,
          inverseSurface: KsColors.neutral900,
          onInverseSurface: KsColors.neutral0,
          inversePrimary: KsColors.primary300,
          shadow: Color(0x0F101828),
          scrim: Colors.black,
        );

  final background = dark ? KsColors.darkBackground : KsColors.neutral25;
  final border = dark ? KsColors.darkBorder : KsColors.neutral200;
  final bodyColor = dark ? KsColors.darkText : KsColors.neutral700;
  final headingColor = dark ? KsColors.darkText : KsColors.neutral900;
  final secondaryText = dark ? KsColors.darkTextSecondary : KsColors.neutral500;

  final lh = ne ? 1.1 : 1.0;
  TextStyle s(
    double size,
    double lineHeight,
    FontWeight w, {
    bool heading = false,
    Color? color,
  }) => TextStyle(
    fontSize: size,
    height: lineHeight / size * lh,
    fontWeight: w,
    letterSpacing: heading && !ne ? -0.02 * size : 0,
    color: color ?? (heading ? headingColor : bodyColor),
    fontFamilyFallback: const ['Mukta'],
  );

  var textTheme = TextTheme(
    displayLarge: s(48, 56, FontWeight.w600, heading: true),
    displayMedium: s(36, 44, FontWeight.w600, heading: true),
    displaySmall: s(30, 38, FontWeight.w600, heading: true),
    headlineLarge: s(28, 36, FontWeight.w600, heading: true),
    headlineMedium: s(24, 32, FontWeight.w600, heading: true),
    headlineSmall: s(20, 28, FontWeight.w600, heading: true),
    titleLarge: s(20, 28, FontWeight.w600, heading: true),
    titleMedium: s(18, 28, FontWeight.w600, heading: true),
    titleSmall: s(16, 24, FontWeight.w600, heading: true),
    bodyLarge: s(16, 24, FontWeight.w400),
    bodyMedium: s(14, 20, FontWeight.w400),
    bodySmall: s(12, 16, FontWeight.w400, color: secondaryText),
    labelLarge: s(16, 24, FontWeight.w600),
    labelMedium: s(14, 20, FontWeight.w500),
    labelSmall: s(12, 16, FontWeight.w600),
  );
  if (useGoogleFonts) {
    textTheme = GoogleFonts.interTextTheme(textTheme);
  }

  final buttonShape = RoundedRectangleBorder(
    borderRadius: BorderRadius.circular(KsRadius.md),
  );
  const buttonSize = Size(64, 48);
  final buttonText = textTheme.labelLarge!.copyWith(color: null);

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: background,
    canvasColor: background,
    textTheme: textTheme,
    fontFamilyFallback: const ['Mukta'],
    dividerColor: border,
    dividerTheme: DividerThemeData(color: border, thickness: 1, space: 1),
    materialTapTargetSize: MaterialTapTargetSize.padded,
    visualDensity: VisualDensity.standard,
    extensions: [dark ? StatusColors.dark : StatusColors.light],
    appBarTheme: AppBarTheme(
      backgroundColor: dark ? KsColors.darkSurface : KsColors.neutral0,
      foregroundColor: headingColor,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0.5,
      centerTitle: false,
      titleTextStyle: textTheme.titleLarge,
      shape: Border(bottom: BorderSide(color: border)),
    ),
    cardTheme: CardThemeData(
      color: dark ? KsColors.darkSurface : KsColors.neutral0,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(KsRadius.lg),
        side: BorderSide(color: border),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: buttonSize,
        shape: buttonShape,
        textStyle: buttonText,
        padding: const EdgeInsets.symmetric(horizontal: 20),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        minimumSize: buttonSize,
        shape: buttonShape,
        textStyle: buttonText,
        elevation: 0,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: buttonSize,
        shape: buttonShape,
        textStyle: buttonText,
        side: BorderSide(color: dark ? KsColors.darkBorder : KsColors.neutral300),
        foregroundColor: headingColor,
        padding: const EdgeInsets.symmetric(horizontal: 20),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        minimumSize: const Size(48, 48),
        shape: buttonShape,
        textStyle: buttonText,
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(minimumSize: const Size(48, 48)),
    ),
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: ButtonStyle(
        minimumSize: const WidgetStatePropertyAll(Size(44, 44)),
        shape: WidgetStatePropertyAll(buttonShape),
        side: WidgetStatePropertyAll(BorderSide(color: border)),
        textStyle: WidgetStatePropertyAll(textTheme.labelMedium),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: dark ? KsColors.darkSurface : KsColors.neutral0,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      hintStyle: TextStyle(color: dark ? KsColors.darkTextSecondary : KsColors.neutral400),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(KsRadius.md),
        borderSide: BorderSide(color: dark ? KsColors.darkBorder : KsColors.neutral300),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(KsRadius.md),
        borderSide: BorderSide(color: dark ? KsColors.darkBorder : KsColors.neutral300),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(KsRadius.md),
        borderSide: const BorderSide(color: KsColors.primary500, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(KsRadius.md),
        borderSide: BorderSide(color: scheme.error),
      ),
    ),
    chipTheme: ChipThemeData(
      shape: const StadiumBorder(),
      side: BorderSide(color: border),
      labelStyle: textTheme.labelMedium,
    ),
    listTileTheme: ListTileThemeData(
      minVerticalPadding: 12,
      iconColor: secondaryText,
      titleTextStyle: textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w500),
      subtitleTextStyle: textTheme.bodyMedium?.copyWith(color: secondaryText),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: dark ? KsColors.darkSurface : KsColors.neutral0,
      surfaceTintColor: Colors.transparent,
      indicatorColor: dark ? const Color(0xFF1A2550) : KsColors.primary50,
      elevation: 0,
      height: 68,
      labelTextStyle: WidgetStatePropertyAll(textTheme.labelSmall),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(KsRadius.md)),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      showDragHandle: true,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(KsRadius.xl)),
      ),
    ),
    dialogTheme: DialogThemeData(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(KsRadius.xl)),
    ),
    switchTheme: const SwitchThemeData(
      materialTapTargetSize: MaterialTapTargetSize.padded,
    ),
  );
}
