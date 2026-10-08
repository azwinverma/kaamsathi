import 'package:flutter/material.dart';

/// Design tokens from docs/DESIGN.md. Keep in sync with the web theme.
abstract final class KsColors {
  static const primary50 = Color(0xFFEEF3FF);
  static const primary100 = Color(0xFFDCE6FF);
  static const primary200 = Color(0xFFB9CCFF);
  static const primary300 = Color(0xFF8AA8FA);
  static const primary400 = Color(0xFF5B80F0);
  static const primary500 = Color(0xFF3A5FE0);
  static const primary600 = Color(0xFF2647C4); // brand
  static const primary700 = Color(0xFF1F399D);
  static const primary800 = Color(0xFF1D327D);
  static const primary900 = Color(0xFF1B2C63);

  static const accent50 = Color(0xFFFFF0F3);
  static const accent500 = Color(0xFFDC2B4B);
  static const accent600 = Color(0xFFC21D3D);

  static const neutral0 = Color(0xFFFFFFFF);
  static const neutral25 = Color(0xFFFBFBFC);
  static const neutral50 = Color(0xFFF6F7F9);
  static const neutral100 = Color(0xFFEDEFF3);
  static const neutral200 = Color(0xFFDDE1E8);
  static const neutral300 = Color(0xFFC4CAD4);
  static const neutral400 = Color(0xFF959DAB);
  static const neutral500 = Color(0xFF5F6776);
  static const neutral600 = Color(0xFF4D5465);
  static const neutral700 = Color(0xFF373D4C);
  static const neutral900 = Color(0xFF161A26);

  static const success50 = Color(0xFFE8F7F0);
  static const success600 = Color(0xFF0F7352);
  static const warning50 = Color(0xFFFFF4E5);
  static const warning600 = Color(0xFF9A5107);
  static const danger50 = Color(0xFFFDECEC);
  static const danger600 = Color(0xFFC8302B);

  // Dark mode
  static const darkBackground = Color(0xFF0D1018);
  static const darkSurface = Color(0xFF161A26);
  static const darkBorder = Color(0xFF2A3040);
  static const darkText = Color(0xFFE6E9EF);
  static const darkTextSecondary = Color(0xFF9AA3B2);
}

abstract final class KsRadius {
  static const sm = 6.0;
  static const md = 8.0;
  static const lg = 12.0;
  static const xl = 16.0;
}

abstract final class KsSpace {
  static const page = 16.0;
  static const s1 = 4.0;
  static const s2 = 8.0;
  static const s3 = 12.0;
  static const s4 = 16.0;
  static const s6 = 24.0;
  static const s8 = 32.0;
}

/// Semantic status palette (bg-50 + fg-600), adapted for dark mode.
@immutable
class StatusColors extends ThemeExtension<StatusColors> {
  const StatusColors({
    required this.successBg,
    required this.successFg,
    required this.warningBg,
    required this.warningFg,
    required this.dangerBg,
    required this.dangerFg,
    required this.infoBg,
    required this.infoFg,
    required this.neutralBg,
    required this.neutralFg,
    required this.border,
    required this.textSecondary,
  });

  final Color successBg;
  final Color successFg;
  final Color warningBg;
  final Color warningFg;
  final Color dangerBg;
  final Color dangerFg;
  final Color infoBg;
  final Color infoFg;
  final Color neutralBg;
  final Color neutralFg;
  final Color border;
  final Color textSecondary;

  static const light = StatusColors(
    successBg: KsColors.success50,
    successFg: KsColors.success600,
    warningBg: KsColors.warning50,
    warningFg: KsColors.warning600,
    dangerBg: KsColors.danger50,
    dangerFg: KsColors.danger600,
    infoBg: KsColors.primary50,
    infoFg: KsColors.primary600,
    neutralBg: KsColors.neutral100,
    neutralFg: KsColors.neutral600,
    border: KsColors.neutral200,
    textSecondary: KsColors.neutral500,
  );

  static const dark = StatusColors(
    successBg: Color(0xFF0F2E24),
    successFg: Color(0xFF4CC79A),
    warningBg: Color(0xFF33240F),
    warningFg: Color(0xFFF0A54A),
    dangerBg: Color(0xFF3A1716),
    dangerFg: Color(0xFFF07A75),
    infoBg: Color(0xFF1A2550),
    infoFg: KsColors.primary300,
    neutralBg: Color(0xFF222838),
    neutralFg: KsColors.darkTextSecondary,
    border: KsColors.darkBorder,
    textSecondary: KsColors.darkTextSecondary,
  );

  @override
  StatusColors copyWith() => this;

  @override
  StatusColors lerp(ThemeExtension<StatusColors>? other, double t) {
    if (other is! StatusColors) return this;
    Color l(Color a, Color b) => Color.lerp(a, b, t)!;
    return StatusColors(
      successBg: l(successBg, other.successBg),
      successFg: l(successFg, other.successFg),
      warningBg: l(warningBg, other.warningBg),
      warningFg: l(warningFg, other.warningFg),
      dangerBg: l(dangerBg, other.dangerBg),
      dangerFg: l(dangerFg, other.dangerFg),
      infoBg: l(infoBg, other.infoBg),
      infoFg: l(infoFg, other.infoFg),
      neutralBg: l(neutralBg, other.neutralBg),
      neutralFg: l(neutralFg, other.neutralFg),
      border: l(border, other.border),
      textSecondary: l(textSecondary, other.textSecondary),
    );
  }
}

extension StatusColorsX on BuildContext {
  StatusColors get statusColors =>
      Theme.of(this).extension<StatusColors>() ?? StatusColors.light;
}
