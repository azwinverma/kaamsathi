import 'dart:ui' show PathMetric;

import 'package:flutter/widgets.dart';

import '../../theme/tokens.dart';

/// Stroke paths in the street-mural kit (DIRECTION.md signature 3).
enum BrushShape {
  /// Long S-curve, the hero-band accent from the approved worker home.
  swoop,

  /// Short, slightly lifted underline under a word or number.
  underline,

  /// Low arc, used inside illustrated fallbacks.
  arc,
}

/// Thick rounded brush stroke with one or two spray dots at its end.
///
/// Decorative only: callers wrap it in [BrushStroke] (which excludes it from
/// semantics). [progress] (0–1) draws a leading part of the stroke so it can
/// "paint in"; the spray dots appear only once the stroke is complete.
class BrushStrokePainter extends CustomPainter {
  BrushStrokePainter({
    required this.color,
    this.dotColor,
    this.shape = BrushShape.swoop,
    this.progress = 1,
    this.strokeWidth,
  });

  final Color color;
  final Color? dotColor;
  final BrushShape shape;
  final double progress;
  final double? strokeWidth;

  Path _path(Size s) {
    final w = s.width;
    final h = s.height;
    return switch (shape) {
      // Mirrors the SVG in B-WorkerHome: M8 82c30-40 70-56 110-40s50 24 66-6
      // on a 190×110 box.
      BrushShape.swoop =>
        Path()
          ..moveTo(w * 0.04, h * 0.75)
          ..cubicTo(w * 0.20, h * 0.38, w * 0.41, h * 0.24, w * 0.62, h * 0.38)
          ..cubicTo(w * 0.78, h * 0.50, w * 0.85, h * 0.60, w * 0.97, h * 0.33),
      BrushShape.underline =>
        Path()
          ..moveTo(w * 0.03, h * 0.70)
          ..quadraticBezierTo(w * 0.50, h * 0.30, w * 0.97, h * 0.45),
      BrushShape.arc =>
        Path()
          ..moveTo(w * 0.05, h * 0.80)
          ..quadraticBezierTo(w * 0.50, h * 0.05, w * 0.95, h * 0.70),
    };
  }

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty || progress <= 0) return;
    final sw = strokeWidth ?? (size.height * 0.11).clamp(4.0, 14.0);
    final paint =
        Paint()
          ..color = color
          ..style = PaintingStyle.stroke
          ..strokeWidth = sw
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round;
    final full = _path(size);
    if (progress >= 1) {
      canvas.drawPath(full, paint);
    } else {
      final partial = Path();
      for (final PathMetric m in full.computeMetrics()) {
        partial.addPath(m.extractPath(0, m.length * progress), Offset.zero);
      }
      canvas.drawPath(partial, paint);
    }
    final dc = dotColor;
    if (dc != null && progress >= 1) {
      final dot = Paint()..color = dc;
      final w = size.width;
      final h = size.height;
      canvas.drawCircle(Offset(w * 0.90, h * 0.13), sw * 0.45, dot);
      canvas.drawCircle(Offset(w * 0.96, h * 0.24), sw * 0.28, dot);
    }
  }

  @override
  bool shouldRepaint(BrushStrokePainter old) =>
      old.color != color ||
      old.dotColor != dotColor ||
      old.shape != shape ||
      old.progress != progress ||
      old.strokeWidth != strokeWidth;
}

/// A decorative [BrushStrokePainter] at a fixed size, hidden from assistive
/// technology. Max two per view (DIRECTION.md).
class BrushStroke extends StatelessWidget {
  const BrushStroke({
    super.key,
    required this.width,
    required this.height,
    this.color = KsMural.strokeYellow,
    this.dotColor,
    this.shape = BrushShape.swoop,
    this.strokeWidth,
  });

  final double width;
  final double height;
  final Color color;
  final Color? dotColor;
  final BrushShape shape;
  final double? strokeWidth;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: CustomPaint(
        size: Size(width, height),
        painter: BrushStrokePainter(color: color, dotColor: dotColor, shape: shape, strokeWidth: strokeWidth),
      ),
    );
  }
}
