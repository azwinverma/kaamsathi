import 'package:flutter/material.dart';

import '../../theme/tokens.dart';

/// White-bordered "cut paper" frame, slightly rotated, with a strip of
/// coloured tape (DIRECTION.md signature 4).
///
/// Only for a worker's own verified photo, a commissioned portrait of a
/// consenting worker, or a clearly illustrated placeholder — never stock or
/// generated people. The frame itself is decorative; the [child] carries
/// the semantic label.
class CutPaperFrame extends StatelessWidget {
  const CutPaperFrame({
    super.key,
    required this.child,
    this.width = 78,
    this.aspectRatio = 78 / 94,
    this.angle = -0.07,
    this.tapeColor = KsMural.strokeYellow,
    this.showTape = true,
    this.border = 5,
  });

  final Widget child;
  final double width;

  /// width / height of the whole frame.
  final double aspectRatio;

  /// Radians; ±4–6° (≈ 0.07–0.1).
  final double angle;
  final Color tapeColor;
  final bool showTape;
  final double border;

  @override
  Widget build(BuildContext context) {
    final height = width / aspectRatio;
    return SizedBox(
      width: width + 8,
      height: height + 12,
      child: Center(
        child: Transform.rotate(
          angle: angle,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: width,
                height: height,
                padding: EdgeInsets.all(border),
                decoration: const BoxDecoration(color: KsMural.paper, boxShadow: KsShadow.floating),
                child: ClipRect(child: child),
              ),
              if (showTape)
                Positioned(
                  top: -7,
                  left: width / 2 - 20,
                  child: ExcludeSemantics(
                    child: Transform.rotate(
                      angle: 0.12,
                      child: Container(width: 40, height: 14, color: tapeColor.withValues(alpha: 0.85)),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
