import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';
import '../../theme/tokens.dart';
import 'brush_stroke.dart';

/// Fine spray-paint grain: a regular dot grid (12px, r 1.2) like the
/// `radial-gradient` texture in the approved mockups.
class DotTexturePainter extends CustomPainter {
  const DotTexturePainter({this.color = KsMural.dot, this.spacing = 12, this.radius = 1.2});

  final Color color;
  final double spacing;
  final double radius;

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()..color = color;
    for (var y = spacing / 2; y < size.height; y += spacing) {
      for (var x = spacing / 2; x < size.width; x += spacing) {
        canvas.drawCircle(Offset(x, y), radius, p);
      }
    }
  }

  @override
  bool shouldRepaint(DotTexturePainter old) => old.color != color || old.spacing != spacing || old.radius != radius;
}

/// Hand-lettered Devanagari word (काम, सीप, साथी) in mural yellow with an
/// offset coral shadow, slightly rotated (DIRECTION.md signature 2).
///
/// Purely decorative: excluded from semantics and never the only carrier of
/// meaning. Max one per view.
class MuralLettering extends StatelessWidget {
  const MuralLettering(
    this.word, {
    super.key,
    this.fontSize = 56,
    this.angle = -0.14,
    this.color = KsMural.lettering,
    this.shadowColor = KsMural.letteringShadow,
    this.shadowOffset = 4,
  });

  final String word;
  final double fontSize;

  /// Radians; about −8° by default.
  final double angle;
  final Color color;
  final Color shadowColor;
  final double shadowOffset;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: Transform.rotate(
        angle: angle,
        child: Text(
          word,
          maxLines: 1,
          softWrap: false,
          textScaler: TextScaler.noScaling, // decoration, not content
          style: TextStyle(
            fontFamily: kDevanagariFamily,
            fontSize: fontSize,
            height: 1.1,
            fontWeight: FontWeight.w700,
            color: color,
            shadows: [Shadow(color: shadowColor, offset: Offset(shadowOffset, shadowOffset))],
          ),
        ),
      ),
    );
  }
}

/// Blue mural band for worker screens: dot texture, one brush stroke and an
/// optional [lettering] word, with [child] in white on top.
///
/// [overlap] adds extra bottom padding so the next card can pull up over the
/// band (the "today's hajiri" card on Home). Everything decorative is
/// excluded from semantics; only [child] / [trailing] are read out.
class MuralHeader extends StatelessWidget {
  const MuralHeader({
    super.key,
    required this.child,
    this.trailing,
    this.lettering,
    this.overlap = 0,
    this.padding = const EdgeInsets.fromLTRB(20, 16, 16, 20),
  });

  final Widget child;
  final Widget? trailing;
  final String? lettering;
  final double overlap;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Container(
      key: const Key('mural_header'),
      color: KsMural.ground,
      child: Stack(
        clipBehavior: Clip.hardEdge,
        children: [
          const Positioned.fill(child: ExcludeSemantics(child: CustomPaint(painter: DotTexturePainter()))),
          const Positioned(
            right: -16,
            top: 20,
            child: BrushStroke(width: 170, height: 98, dotColor: KsMural.strokeCoral),
          ),
          if (lettering != null)
            Positioned(right: 14, bottom: overlap + 2, child: MuralLettering(lettering!, fontSize: 46)),
          SafeArea(
            bottom: false,
            child: Padding(
              padding: padding.copyWith(bottom: padding.bottom + overlap),
              child: IconTheme.merge(
                data: const IconThemeData(color: KsMural.onGround),
                child: DefaultTextStyle.merge(
                  style: t.bodyLarge?.copyWith(color: KsMural.onGround),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Padding(
                          // Keep text clear of the lettering in the corner.
                          padding: EdgeInsets.only(right: lettering == null ? 0 : 56),
                          child: child,
                        ),
                      ),
                      if (trailing != null) trailing!,
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
