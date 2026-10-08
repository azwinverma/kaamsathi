import 'package:flutter/material.dart';

/// KaamSathi design tokens for Flutter.
///
/// Source of truth: `design/tokens.json` (semantic tokens, v2). Web maps the
/// same file to CSS variables; keep the two in step. Feature code must not
/// hard-code colours: read semantic colours from [KsColors] via
/// `context.ks`, or from `Theme.of(context).colorScheme`.
///
/// Rules carried over from tokens.json:
/// - Text on a status soft background uses `*.text`, never the raw fill.
/// - Coral / yellow / teal are accents for fills and highlights; text on them
///   is [KsColors.onAccentFill], never white.
/// - Status is never colour-only: pair with an icon and a label.

/// Raw hex values from design/tokens.json. Only the theme layer
/// ([KsColors.light] / [KsColors.dark] and app_theme.dart) should read these.
abstract final class KsPalette {
  // ── Light ────────────────────────────────────────────────────────────────
  static const actionPrimary = Color(0xFF2563EB);
  static const actionPrimaryHover = Color(0xFF1D4ED8);
  static const actionPrimaryFg = Color(0xFFFFFFFF);
  static const actionPrimarySubtle = Color(0xFFEFF6FF);
  static const actionPrimarySubtleFg = Color(0xFF1D4ED8);
  static const brandIndigo = Color(0xFF4F46E5);
  static const brandIndigoSubtle = Color(0xFFEEF2FF);
  static const accentCoral = Color(0xFFFF6B6B);
  static const accentCoralText = Color(0xFFC2410C);
  static const accentCoralSubtle = Color(0xFFFFF1F1);
  static const accentYellow = Color(0xFFFBBF24);
  static const accentYellowSubtle = Color(0xFFFEF9E7);
  static const accentTeal = Color(0xFF14B8A6);
  static const accentTealText = Color(0xFF0F766E);
  static const accentTealSubtle = Color(0xFFF0FDFA);
  static const accentOnFill = Color(0xFF0F172A);
  static const textPrimary = Color(0xFF0F172A);
  static const textSecondary = Color(0xFF334155);
  static const textMuted = Color(0xFF5A6679);
  static const textInverse = Color(0xFFFFFFFF);
  static const surfaceCanvas = Color(0xFFF8FAFC);
  static const surfaceDefault = Color(0xFFFFFFFF);
  static const surfaceMuted = Color(0xFFF1F5F9);
  static const borderDefault = Color(0xFFE2E8F0);
  static const borderStrong = Color(0xFFCBD5E1);
  static const focusRing = Color(0xFF2563EB);
  static const success = Color(0xFF16A34A);
  static const successText = Color(0xFF15803D);
  static const successSoft = Color(0xFFDCFCE7);
  static const warning = Color(0xFFD97706);
  static const warningText = Color(0xFFA14A07);
  static const warningSoft = Color(0xFFFEF3C7);
  static const error = Color(0xFFDC2626);
  static const errorText = Color(0xFFB91C1C);
  static const errorSoft = Color(0xFFFEE2E2);
  static const info = Color(0xFF0284C7);
  static const infoText = Color(0xFF0369A1);
  static const infoSoft = Color(0xFFE0F2FE);
  static const verified = Color(0xFF0F766E);
  static const verifiedText = Color(0xFF0F766E);
  static const verifiedSoft = Color(0xFFCCFBF1);
  static const neutral = Color(0xFF64748B); // Slate 500

  // ── Dark (tokens.json "dark"; brand §24: Slate 950/900, desaturated) ─────
  static const darkActionPrimary = Color(0xFF3B82F6);
  static const darkActionPrimaryHover = Color(0xFF60A5FA);
  static const darkActionPrimaryFg = Color(0xFF0B1220);
  static const darkActionPrimarySubtle = Color(0xFF172554);
  static const darkActionPrimarySubtleFg = Color(0xFFBFDBFE);
  static const darkTextPrimary = Color(0xFFF1F5F9);
  static const darkTextSecondary = Color(0xFFCBD5E1);
  static const darkTextMuted = Color(0xFF94A3B8);
  static const darkSurfaceCanvas = Color(0xFF020617);
  static const darkSurfaceDefault = Color(0xFF0F172A);
  static const darkSurfaceMuted = Color(0xFF1E293B);
  static const darkBorderDefault = Color(0xFF1E293B);
  static const darkBorderStrong = Color(0xFF334155);
  static const darkSuccessText = Color(0xFF4ADE80);
  static const darkWarningText = Color(0xFFFBBF24);
  static const darkErrorText = Color(0xFFF87171);
  static const darkInfoText = Color(0xFF38BDF8);
  static const darkVerifiedText = Color(0xFF2DD4BF);

  // Dark values tokens.json leaves open (soft tints, accents). Tailwind
  // 950/300-ish steps of the same hues; AA re-verified in
  // test/core/theme_tokens_test.dart.
  static const darkSuccessSoft = Color(0xFF052E16);
  static const darkWarningSoft = Color(0xFF451A03);
  static const darkErrorSoft = Color(0xFF450A0A);
  static const darkInfoSoft = Color(0xFF082F49);
  static const darkVerifiedSoft = Color(0xFF042F2E);
  static const darkIndigo = Color(0xFFA5B4FC);
  static const darkIndigoSubtle = Color(0xFF1E1B4B);
  static const darkCoral = Color(0xFFF87171);
  static const darkCoralText = Color(0xFFFCA5A5);
  static const darkCoralSubtle = Color(0xFF3B1515);
  static const darkYellow = Color(0xFFFACC15);
  static const darkYellowSubtle = Color(0xFF3A2E0A);
  static const darkTeal = Color(0xFF2DD4BF);
  static const darkTealText = Color(0xFF5EEAD4);
  static const darkTealSubtle = Color(0xFF042F2E);
}

/// Semantic colour tokens as a [ThemeExtension] (light + dark).
///
/// Read with `context.ks`. Every `*Text` / `*Soft` pair meets WCAG AA 4.5:1.
@immutable
class KsColors extends ThemeExtension<KsColors> {
  const KsColors({
    required this.actionPrimary,
    required this.actionPrimaryHover,
    required this.onActionPrimary,
    required this.actionPrimarySubtle,
    required this.onActionPrimarySubtle,
    required this.indigo,
    required this.indigoSubtle,
    required this.coral,
    required this.coralText,
    required this.coralSubtle,
    required this.yellow,
    required this.yellowSubtle,
    required this.teal,
    required this.tealText,
    required this.tealSubtle,
    required this.onAccentFill,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
    required this.textInverse,
    required this.canvas,
    required this.surface,
    required this.surfaceMuted,
    required this.border,
    required this.borderStrong,
    required this.focusRing,
    required this.success,
    required this.successText,
    required this.successSoft,
    required this.warning,
    required this.warningText,
    required this.warningSoft,
    required this.error,
    required this.errorText,
    required this.errorSoft,
    required this.info,
    required this.infoText,
    required this.infoSoft,
    required this.verified,
    required this.verifiedText,
    required this.verifiedSoft,
    required this.neutral,
    required this.neutralText,
    required this.neutralSoft,
    required this.media,
    required this.onMedia,
  });

  // Action
  final Color actionPrimary;
  final Color actionPrimaryHover;
  final Color onActionPrimary;
  final Color actionPrimarySubtle;
  final Color onActionPrimarySubtle;

  // Brand / accents (fills, highlights — not body text unless `*Text`).
  final Color indigo;
  final Color indigoSubtle;
  final Color coral;
  final Color coralText;
  final Color coralSubtle;
  final Color yellow;
  final Color yellowSubtle;
  final Color teal;
  final Color tealText;
  final Color tealSubtle;
  final Color onAccentFill;

  // Text
  final Color textPrimary;
  final Color textSecondary;
  final Color textMuted;
  final Color textInverse;

  // Surfaces / lines
  final Color canvas;
  final Color surface;
  final Color surfaceMuted;
  final Color border;
  final Color borderStrong;
  final Color focusRing;

  // Status: raw fill (icons/indicators ≥3:1), AA text, soft background.
  final Color success;
  final Color successText;
  final Color successSoft;
  final Color warning;
  final Color warningText;
  final Color warningSoft;
  final Color error;
  final Color errorText;
  final Color errorSoft;
  final Color info;
  final Color infoText;
  final Color infoSoft;
  final Color verified;
  final Color verifiedText;
  final Color verifiedSoft;
  final Color neutral;
  final Color neutralText;
  final Color neutralSoft;

  /// Full-bleed camera / media backdrop (Slate 950 — never pure black) and
  /// the foreground drawn over it. Same in both modes.
  final Color media;
  final Color onMedia;

  /// Rating stars: a status fill that clears 3:1 as a UI indicator.
  Color get ratingStar => warning;

  /// Every (text, background) pair that must meet 4.5:1, by name.
  Map<String, (Color, Color)> get textPairs => {
    'success': (successText, successSoft),
    'warning': (warningText, warningSoft),
    'error': (errorText, errorSoft),
    'info': (infoText, infoSoft),
    'verified': (verifiedText, verifiedSoft),
    'neutral': (neutralText, neutralSoft),
    'coral': (coralText, coralSubtle),
    'teal': (tealText, tealSubtle),
    'indigo': (indigo, indigoSubtle),
    'actionSubtle': (onActionPrimarySubtle, actionPrimarySubtle),
    'action': (onActionPrimary, actionPrimary),
    'textPrimary': (textPrimary, surface),
    'textSecondary': (textSecondary, surface),
    'textMuted': (textMuted, canvas),
    'textMutedOnSurface': (textMuted, surface),
    'onCoral': (onAccentFill, coral),
    'onYellow': (onAccentFill, yellow),
    'onTeal': (onAccentFill, teal),
    'onMedia': (onMedia, media),
  };

  static const light = KsColors(
    actionPrimary: KsPalette.actionPrimary,
    actionPrimaryHover: KsPalette.actionPrimaryHover,
    onActionPrimary: KsPalette.actionPrimaryFg,
    actionPrimarySubtle: KsPalette.actionPrimarySubtle,
    onActionPrimarySubtle: KsPalette.actionPrimarySubtleFg,
    indigo: KsPalette.brandIndigo,
    indigoSubtle: KsPalette.brandIndigoSubtle,
    coral: KsPalette.accentCoral,
    coralText: KsPalette.accentCoralText,
    coralSubtle: KsPalette.accentCoralSubtle,
    yellow: KsPalette.accentYellow,
    yellowSubtle: KsPalette.accentYellowSubtle,
    teal: KsPalette.accentTeal,
    tealText: KsPalette.accentTealText,
    tealSubtle: KsPalette.accentTealSubtle,
    onAccentFill: KsPalette.accentOnFill,
    textPrimary: KsPalette.textPrimary,
    textSecondary: KsPalette.textSecondary,
    textMuted: KsPalette.textMuted,
    textInverse: KsPalette.textInverse,
    canvas: KsPalette.surfaceCanvas,
    surface: KsPalette.surfaceDefault,
    surfaceMuted: KsPalette.surfaceMuted,
    border: KsPalette.borderDefault,
    borderStrong: KsPalette.borderStrong,
    focusRing: KsPalette.focusRing,
    success: KsPalette.success,
    successText: KsPalette.successText,
    successSoft: KsPalette.successSoft,
    warning: KsPalette.warning,
    warningText: KsPalette.warningText,
    warningSoft: KsPalette.warningSoft,
    error: KsPalette.error,
    errorText: KsPalette.errorText,
    errorSoft: KsPalette.errorSoft,
    info: KsPalette.info,
    infoText: KsPalette.infoText,
    infoSoft: KsPalette.infoSoft,
    verified: KsPalette.verified,
    verifiedText: KsPalette.verifiedText,
    verifiedSoft: KsPalette.verifiedSoft,
    neutral: KsPalette.neutral,
    neutralText: KsPalette.textSecondary,
    neutralSoft: KsPalette.surfaceMuted,
    media: KsPalette.darkSurfaceCanvas,
    onMedia: KsPalette.textInverse,
  );

  static const dark = KsColors(
    actionPrimary: KsPalette.darkActionPrimary,
    actionPrimaryHover: KsPalette.darkActionPrimaryHover,
    onActionPrimary: KsPalette.darkActionPrimaryFg,
    actionPrimarySubtle: KsPalette.darkActionPrimarySubtle,
    onActionPrimarySubtle: KsPalette.darkActionPrimarySubtleFg,
    indigo: KsPalette.darkIndigo,
    indigoSubtle: KsPalette.darkIndigoSubtle,
    coral: KsPalette.darkCoral,
    coralText: KsPalette.darkCoralText,
    coralSubtle: KsPalette.darkCoralSubtle,
    yellow: KsPalette.darkYellow,
    yellowSubtle: KsPalette.darkYellowSubtle,
    teal: KsPalette.darkTeal,
    tealText: KsPalette.darkTealText,
    tealSubtle: KsPalette.darkTealSubtle,
    onAccentFill: KsPalette.accentOnFill,
    textPrimary: KsPalette.darkTextPrimary,
    textSecondary: KsPalette.darkTextSecondary,
    textMuted: KsPalette.darkTextMuted,
    textInverse: KsPalette.textPrimary,
    canvas: KsPalette.darkSurfaceCanvas,
    surface: KsPalette.darkSurfaceDefault,
    surfaceMuted: KsPalette.darkSurfaceMuted,
    border: KsPalette.darkBorderDefault,
    borderStrong: KsPalette.darkBorderStrong,
    focusRing: KsPalette.darkActionPrimary,
    success: KsPalette.darkSuccessText,
    successText: KsPalette.darkSuccessText,
    successSoft: KsPalette.darkSuccessSoft,
    warning: KsPalette.darkWarningText,
    warningText: KsPalette.darkWarningText,
    warningSoft: KsPalette.darkWarningSoft,
    error: KsPalette.darkErrorText,
    errorText: KsPalette.darkErrorText,
    errorSoft: KsPalette.darkErrorSoft,
    info: KsPalette.darkInfoText,
    infoText: KsPalette.darkInfoText,
    infoSoft: KsPalette.darkInfoSoft,
    verified: KsPalette.darkVerifiedText,
    verifiedText: KsPalette.darkVerifiedText,
    verifiedSoft: KsPalette.darkVerifiedSoft,
    neutral: KsPalette.darkTextMuted,
    neutralText: KsPalette.darkTextSecondary,
    neutralSoft: KsPalette.darkSurfaceMuted,
    media: KsPalette.darkSurfaceCanvas,
    onMedia: KsPalette.textInverse,
  );

  @override
  KsColors copyWith() => this;

  @override
  KsColors lerp(ThemeExtension<KsColors>? other, double t) {
    if (other is! KsColors) return this;
    Color l(Color a, Color b) => Color.lerp(a, b, t)!;
    return KsColors(
      actionPrimary: l(actionPrimary, other.actionPrimary),
      actionPrimaryHover: l(actionPrimaryHover, other.actionPrimaryHover),
      onActionPrimary: l(onActionPrimary, other.onActionPrimary),
      actionPrimarySubtle: l(actionPrimarySubtle, other.actionPrimarySubtle),
      onActionPrimarySubtle: l(onActionPrimarySubtle, other.onActionPrimarySubtle),
      indigo: l(indigo, other.indigo),
      indigoSubtle: l(indigoSubtle, other.indigoSubtle),
      coral: l(coral, other.coral),
      coralText: l(coralText, other.coralText),
      coralSubtle: l(coralSubtle, other.coralSubtle),
      yellow: l(yellow, other.yellow),
      yellowSubtle: l(yellowSubtle, other.yellowSubtle),
      teal: l(teal, other.teal),
      tealText: l(tealText, other.tealText),
      tealSubtle: l(tealSubtle, other.tealSubtle),
      onAccentFill: l(onAccentFill, other.onAccentFill),
      textPrimary: l(textPrimary, other.textPrimary),
      textSecondary: l(textSecondary, other.textSecondary),
      textMuted: l(textMuted, other.textMuted),
      textInverse: l(textInverse, other.textInverse),
      canvas: l(canvas, other.canvas),
      surface: l(surface, other.surface),
      surfaceMuted: l(surfaceMuted, other.surfaceMuted),
      border: l(border, other.border),
      borderStrong: l(borderStrong, other.borderStrong),
      focusRing: l(focusRing, other.focusRing),
      success: l(success, other.success),
      successText: l(successText, other.successText),
      successSoft: l(successSoft, other.successSoft),
      warning: l(warning, other.warning),
      warningText: l(warningText, other.warningText),
      warningSoft: l(warningSoft, other.warningSoft),
      error: l(error, other.error),
      errorText: l(errorText, other.errorText),
      errorSoft: l(errorSoft, other.errorSoft),
      info: l(info, other.info),
      infoText: l(infoText, other.infoText),
      infoSoft: l(infoSoft, other.infoSoft),
      verified: l(verified, other.verified),
      verifiedText: l(verifiedText, other.verifiedText),
      verifiedSoft: l(verifiedSoft, other.verifiedSoft),
      neutral: l(neutral, other.neutral),
      neutralText: l(neutralText, other.neutralText),
      neutralSoft: l(neutralSoft, other.neutralSoft),
      media: l(media, other.media),
      onMedia: l(onMedia, other.onMedia),
    );
  }
}

extension KsColorsX on BuildContext {
  /// Semantic colours for the current theme brightness.
  KsColors get ks => Theme.of(this).extension<KsColors>() ?? KsColors.light;
}

/// Corner radii (tokens.json `radius`). Use the role names in feature code.
abstract final class KsRadius {
  static const xs = 6.0;
  static const sm = 10.0;
  static const md = 14.0;
  static const lg = 18.0;
  static const xl = 24.0;
  static const pill = 999.0;

  /// Buttons, inputs, toggles, segmented controls.
  static const control = 12.0;

  /// Standard product cards.
  static const card = 16.0;

  /// Dense cards, inline notices, grid cells in operational views.
  static const dense = 10.0;

  /// Bottom sheets and dialogs.
  static const sheet = 22.0;
}

/// 8pt spacing scale (tokens.json `space`: 4 8 12 16 24 32 40 48 64 80 96).
abstract final class KsSpace {
  static const s1 = 4.0;
  static const s2 = 8.0;
  static const s3 = 12.0;
  static const s4 = 16.0;
  static const s6 = 24.0;
  static const s8 = 32.0;
  static const s10 = 40.0;
  static const s12 = 48.0;
  static const s16 = 64.0;
  static const s20 = 80.0;
  static const s24 = 96.0;

  /// Mobile page side padding.
  static const page = 16.0;
}

/// Elevation (tokens.json `shadow`). Prefer borders; use these sparingly.
abstract final class KsShadow {
  static const card = [
    BoxShadow(color: Color(0x0F0F172A), offset: Offset(0, 1), blurRadius: 2),
    BoxShadow(color: Color(0x0F0F172A), offset: Offset(0, 6), blurRadius: 18),
  ];
  static const floating = [BoxShadow(color: Color(0x1F0F172A), offset: Offset(0, 12), blurRadius: 32)];
}

/// Sizes that are accessibility floors, not style.
abstract final class KsSize {
  /// Minimum touch target (tokens.json `touchTargetMin`).
  static const touchTarget = 44.0;

  /// Smallest font size for primary information.
  static const minBody = 14.0;
}

/// Motion tokens (tokens.json `motion`) plus reduced-motion handling.
abstract final class KsMotion {
  /// Control feedback (toggles, chips, pressed states).
  static const control = Duration(milliseconds: 150);

  /// Normal transitions.
  static const base = Duration(milliseconds: 200);

  /// Larger state changes.
  static const slow = Duration(milliseconds: 280);

  /// Content transitions (page/route, progress fills).
  static const content = Duration(milliseconds: 360);

  /// cubic-bezier(0.2, 0.0, 0.0, 1.0) — soft ease-out.
  static const easing = Cubic(0.2, 0.0, 0.0, 1.0);

  /// True when the platform asks for reduced motion.
  static bool reduced(BuildContext context) => MediaQuery.maybeDisableAnimationsOf(context) ?? false;

  /// [d], or [Duration.zero] when the user has asked for reduced motion.
  static Duration of(BuildContext context, Duration d) => reduced(context) ? Duration.zero : d;
}

/// Street-mural palette (DIRECTION.md, worker surfaces only). The mural is a
/// painted surface, so it keeps the same light-mode hues in dark mode; the
/// foreground on it is always [onGround] (white), AA-checked in
/// test/core/theme_tokens_test.dart.
abstract final class KsMural {
  /// Blue wall the mural is painted on (action.primary, 5.17:1 with white).
  static const ground = KsPalette.actionPrimary;

  /// Text and icons on [ground] and on [passportGradient].
  static const onGround = KsPalette.textInverse;

  /// Spray-paint grain over [ground].
  static const dot = Color(0x24FFFFFF);

  /// Brush strokes and spray dots.
  static const strokeYellow = KsPalette.accentYellow;
  static const strokeTeal = KsPalette.accentTeal;
  static const strokeCoral = KsPalette.accentCoral;

  /// Hand-lettered words and their offset shadow.
  static const lettering = KsPalette.accentYellow;
  static const letteringShadow = KsPalette.accentCoral;

  /// Skill gradient for the Passport card. tokens.json `gradient.skill` runs
  /// teal → blue; we use the AA `*.text` steps of the same hues so white text
  /// on any point of the card clears 4.5:1.
  static const passportGradient = [KsPalette.accentTealText, KsPalette.actionPrimaryHover];

  /// Paper white for cut-paper frames (same in both modes — it is paper).
  static const paper = KsPalette.surfaceDefault;

  /// Skill-ladder rung fills, lowest to highest (DIRECTION.md: canvas →
  /// teal-subtle → teal → blue → yellow). Rung 1 sits on white, so it uses
  /// the muted surface with a strong border to stay visible.
  static const rungs = [
    KsPalette.surfaceMuted,
    KsPalette.verifiedSoft,
    KsPalette.accentTeal,
    KsPalette.actionPrimary,
    KsPalette.accentYellow,
  ];
}

/// How expressive the current surface is allowed to be. Worker mode is the
/// "street mural" (illustrated empty states, mural headers); supervisor mode
/// is the calm "documentary ledger" (plain icons, dense cards, no murals).
@immutable
class KsSurfaceStyle extends ThemeExtension<KsSurfaceStyle> {
  const KsSurfaceStyle({required this.expressive});

  final bool expressive;

  static const mural = KsSurfaceStyle(expressive: true);
  static const ledger = KsSurfaceStyle(expressive: false);

  @override
  KsSurfaceStyle copyWith({bool? expressive}) => KsSurfaceStyle(expressive: expressive ?? this.expressive);

  @override
  KsSurfaceStyle lerp(ThemeExtension<KsSurfaceStyle>? other, double t) =>
      other is KsSurfaceStyle && t >= 0.5 ? other : this;
}

extension KsSurfaceStyleX on BuildContext {
  /// True on worker (street mural) surfaces.
  bool get expressive => (Theme.of(this).extension<KsSurfaceStyle>() ?? KsSurfaceStyle.mural).expressive;
}
