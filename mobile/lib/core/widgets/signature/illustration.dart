import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../theme/tokens.dart';
import 'brush_stroke.dart';

/// Motifs for the in-app illustration kit. One geometric style (thick
/// rounded shapes, real tools, no faces) and the mural palette, so empty
/// states and photo-slot fallbacks look like one hand. There are no shared
/// SVGs in `design/illustrations/` yet, so these are drawn in code.
enum KsMotif {
  /// Workbench with a wrench and a hard hat — training / workshop.
  workshop,

  /// Rising steps with a flag — career path.
  career,

  /// Phone with a QR code beside a hard hat — first-run welcome.
  welcome,
}

/// Paints a [KsMotif] scene on a tinted paper ground.
class KsIllustrationPainter extends CustomPainter {
  KsIllustrationPainter({required this.motif, required this.ink, required this.paper});

  final KsMotif motif;

  /// Line/outline colour (text.primary of the theme).
  final Color ink;

  /// Background tint.
  final Color paper;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    canvas.drawRect(Offset.zero & size, Paint()..color = paper);
    // Ground brush stroke shared by every scene.
    BrushStrokePainter(
      color: KsMural.strokeTeal,
      shape: BrushShape.arc,
      strokeWidth: h * 0.07,
    ).paint(canvas, Size(w, h * 1.05));

    final line =
        Paint()
          ..color = ink
          ..style = PaintingStyle.stroke
          ..strokeWidth = math.max(2, w * 0.018)
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round;
    Paint fill(Color c) => Paint()..color = c;

    switch (motif) {
      case KsMotif.workshop:
        // Bench.
        final bench = Rect.fromLTWH(w * 0.12, h * 0.58, w * 0.76, h * 0.08);
        canvas.drawRRect(RRect.fromRectAndRadius(bench, Radius.circular(h * 0.02)), fill(KsMural.ground));
        canvas.drawLine(Offset(w * 0.2, h * 0.66), Offset(w * 0.2, h * 0.86), line);
        canvas.drawLine(Offset(w * 0.8, h * 0.66), Offset(w * 0.8, h * 0.86), line);
        // Hard hat on the bench.
        _hardHat(canvas, Offset(w * 0.34, h * 0.58), w * 0.26, KsMural.strokeYellow, line);
        // Wrench, angled.
        canvas.save();
        canvas.translate(w * 0.66, h * 0.44);
        canvas.rotate(-0.6);
        final handle = RRect.fromRectAndRadius(
          Rect.fromCenter(center: Offset.zero, width: w * 0.06, height: h * 0.30),
          Radius.circular(w * 0.03),
        );
        canvas.drawRRect(handle, fill(KsMural.strokeCoral));
        canvas.drawCircle(Offset(0, -h * 0.16), w * 0.07, fill(KsMural.strokeCoral));
        canvas.drawCircle(Offset(0, -h * 0.18), w * 0.03, fill(paper));
        canvas.restore();
      case KsMotif.career:
        // Five rising steps (echoes the skill ladder) and a flag on top.
        final step = w * 0.13;
        for (var i = 0; i < 5; i++) {
          final rh = h * (0.12 + i * 0.1);
          final r = Rect.fromLTWH(w * 0.14 + i * (step + w * 0.02), h * 0.78 - rh, step, rh);
          canvas.drawRRect(RRect.fromRectAndRadius(r, Radius.circular(w * 0.02)), fill(KsMural.rungs[i]));
          if (i == 0) canvas.drawRRect(RRect.fromRectAndRadius(r, Radius.circular(w * 0.02)), line);
        }
        final top = Offset(w * 0.14 + 4 * (step + w * 0.02) + step / 2, h * 0.78 - h * 0.52);
        canvas.drawLine(top, top.translate(0, -h * 0.2), line);
        final flag =
            Path()
              ..moveTo(top.dx, top.dy - h * 0.2)
              ..lineTo(top.dx + w * 0.12, top.dy - h * 0.16)
              ..lineTo(top.dx, top.dy - h * 0.11)
              ..close();
        canvas.drawPath(flag, fill(KsMural.strokeCoral));
      case KsMotif.welcome:
        // Phone with a QR code.
        final phone = RRect.fromRectAndRadius(
          Rect.fromLTWH(w * 0.18, h * 0.18, w * 0.34, h * 0.62),
          Radius.circular(w * 0.05),
        );
        canvas.drawRRect(phone, fill(KsMural.paper));
        canvas.drawRRect(phone, line);
        final q = w * 0.055;
        final ox = w * 0.235;
        final oy = h * 0.3;
        const on = [
          [1, 1, 0, 1],
          [1, 0, 1, 0],
          [0, 1, 1, 1],
          [1, 0, 1, 1],
        ];
        for (var r = 0; r < 4; r++) {
          for (var col = 0; col < 4; col++) {
            if (on[r][col] == 1) {
              canvas.drawRect(Rect.fromLTWH(ox + col * q, oy + r * q, q * 0.86, q * 0.86), fill(ink));
            }
          }
        }
        _hardHat(canvas, Offset(w * 0.56, h * 0.72), w * 0.3, KsMural.strokeYellow, line);
    }
  }

  void _hardHat(Canvas canvas, Offset baseLeft, double width, Color color, Paint line) {
    final r = width / 2;
    final centre = baseLeft.translate(r, 0);
    final dome = Rect.fromCircle(center: centre, radius: r * 0.8);
    canvas.drawArc(dome, math.pi, math.pi, true, Paint()..color = color);
    final brim = RRect.fromRectAndRadius(
      Rect.fromLTWH(baseLeft.dx - r * 0.1, baseLeft.dy - r * 0.08, width * 1.1, r * 0.2),
      Radius.circular(r * 0.1),
    );
    canvas.drawRRect(brim, Paint()..color = color);
    canvas.drawLine(centre.translate(0, -r * 0.8), centre.translate(0, -r * 0.1), line);
  }

  @override
  bool shouldRepaint(KsIllustrationPainter old) => old.motif != motif || old.ink != ink || old.paper != paper;
}

/// A [KsMotif] scene. Decorative unless [semanticLabel] is given.
class KsIllustration extends StatelessWidget {
  const KsIllustration({super.key, required this.motif, this.semanticLabel});

  final KsMotif motif;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    // Fixed light paper + ink in both themes: it is a printed illustration.
    final paint = CustomPaint(
      painter: KsIllustrationPainter(motif: motif, ink: KsPalette.textPrimary, paper: KsPalette.accentYellowSubtle),
      child: const SizedBox.expand(),
    );
    if (semanticLabel == null) return ExcludeSemantics(child: paint);
    return Semantics(image: true, label: semanticLabel, child: ExcludeSemantics(child: paint));
  }
}

/// Illustrated stand-in for an empty state: the state's icon on a tilted
/// sheet of tinted paper with a short teal brush stroke and spray dots.
/// Used on worker (mural) surfaces; supervisor screens keep a plain icon.
class IllustratedIcon extends StatelessWidget {
  const IllustratedIcon({super.key, required this.icon, this.size = 112});

  final IconData icon;
  final double size;

  @override
  Widget build(BuildContext context) {
    final c = context.ks;
    return ExcludeSemantics(
      child: SizedBox(
        width: size * 1.3,
        height: size,
        child: Stack(
          alignment: Alignment.center,
          children: [
            Transform.rotate(
              angle: -0.07,
              child: Container(
                width: size * 0.82,
                height: size * 0.82,
                decoration: BoxDecoration(color: c.yellowSubtle, borderRadius: BorderRadius.circular(KsRadius.sm)),
              ),
            ),
            Positioned(
              bottom: size * 0.04,
              child: BrushStroke(
                width: size * 0.9,
                height: size * 0.22,
                color: c.teal,
                shape: BrushShape.underline,
                strokeWidth: size * 0.07,
              ),
            ),
            Positioned(
              top: size * 0.06,
              right: size * 0.12,
              child: Row(
                children: [
                  _dot(size * 0.06, c.coral),
                  SizedBox(width: size * 0.03),
                  Padding(padding: EdgeInsets.only(top: size * 0.06), child: _dot(size * 0.035, c.coral)),
                ],
              ),
            ),
            Icon(icon, size: size * 0.42, color: c.textPrimary),
          ],
        ),
      ),
    );
  }

  Widget _dot(double d, Color color) =>
      Container(width: d, height: d, decoration: BoxDecoration(color: color, shape: BoxShape.circle));
}
