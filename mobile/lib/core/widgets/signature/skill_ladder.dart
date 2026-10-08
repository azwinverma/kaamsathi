import 'package:flutter/material.dart';

import '../../format.dart';
import '../../l10n/l10n.dart';
import '../../theme/tokens.dart';

/// Number of rungs on the skill ladder (सीपको सीढी).
const kLadderRungs = 5;

/// Verification level (0–5, `verification_level`) → earned rungs.
///
/// Rungs: Phone → Identity → Work → Certificate → Highly trusted. Level 0
/// (phone verified by OTP) is the first rung; "skills assessed" (3) and
/// "certificate verified" (4) both stand on the certificate rung.
int ladderRungsForLevel(int level) => switch (level) {
  <= 0 => 1,
  1 => 2,
  2 => 3,
  3 || 4 => 4,
  _ => 5,
};

/// Localised rung labels, lowest first.
List<String> ladderLabels(AppLocalizations l) => [
  l.ladderRungPhone,
  l.ladderRungIdentity,
  l.ladderRungWork,
  l.ladderRungCertificate,
  l.ladderRungTrusted,
];

/// The skill ladder: five rising rungs (DIRECTION.md signature 1).
///
/// Earned rungs are filled canvas → teal-subtle → teal → blue → yellow;
/// rungs not yet earned are dashed outlines, never greyed-out failure. The
/// rungs grow in once (content motion, brand easing) the first time the
/// ladder is shown and are drawn instantly under reduced motion. Assistive
/// technology hears one summary ("3 of 5 steps") plus each step's state.
class SkillLadder extends StatefulWidget {
  const SkillLadder({super.key, required this.earned, this.height = 76, this.showLabels = true, this.compact = false});

  /// Rungs earned, 0–5.
  final int earned;
  final double height;
  final bool showLabels;

  /// Small inline variant (no labels, thinner gaps) for chips and cards.
  final bool compact;

  @override
  State<SkillLadder> createState() => _SkillLadderState();
}

class _SkillLadderState extends State<SkillLadder> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: KsMotion.content * 2);
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    // Animate once; under reduced motion jump straight to the end state.
    if (KsMotion.reduced(context)) {
      _c.value = 1;
    } else {
      _c.forward();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final c = context.ks;
    final labels = ladderLabels(l);
    final earned = widget.earned.clamp(0, kLadderRungs);
    final summary = [
      l.ladderSummary(localizeDigits('$earned', lang), localizeDigits('$kLadderRungs', lang)),
      for (var i = 0; i < kLadderRungs; i++) i < earned ? l.ladderStepDone(labels[i]) : l.ladderStepOpen(labels[i]),
    ].join('. ');
    final gap = widget.compact ? 3.0 : 6.0;

    return Semantics(
      key: const Key('skill_ladder'),
      container: true,
      label: summary,
      child: ExcludeSemantics(
        child: AnimatedBuilder(
          animation: _c,
          builder: (context, _) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(
                  height: widget.height,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      for (var i = 0; i < kLadderRungs; i++) ...[
                        if (i > 0) SizedBox(width: gap),
                        Expanded(
                          child: _Rung(
                            key: Key('ladder_rung_${i + 1}_${i < earned ? 'earned' : 'open'}'),
                            index: i,
                            earned: i < earned,
                            // Staggered growth: each rung starts a little later.
                            grow: KsMotion.easing.transform(((_c.value - i * 0.1) / 0.6).clamp(0.0, 1.0)),
                            fullHeight: widget.height,
                            radius: widget.compact ? 3 : 8,
                            border: c.borderStrong,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                if (widget.showLabels && !widget.compact) ...[
                  const SizedBox(height: KsSpace.s1),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (var i = 0; i < kLadderRungs; i++) ...[
                        if (i > 0) SizedBox(width: gap),
                        Expanded(
                          child: Text(
                            labels[i],
                            textAlign: TextAlign.center,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: i < earned ? c.textSecondary : c.textMuted,
                              fontWeight: i < earned ? FontWeight.w600 : FontWeight.w400,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

class _Rung extends StatelessWidget {
  const _Rung({
    super.key,
    required this.index,
    required this.earned,
    required this.grow,
    required this.fullHeight,
    required this.radius,
    required this.border,
  });

  final int index;
  final bool earned;
  final double grow;
  final double fullHeight;
  final double radius;
  final Color border;

  static const _heights = [0.30, 0.46, 0.62, 0.80, 1.0];

  @override
  Widget build(BuildContext context) {
    final target = fullHeight * _heights[index];
    // Unearned rungs are outlines at full size (nothing to "grow"); earned
    // rungs rise from a sliver to their height.
    final h = earned ? (target * (0.15 + 0.85 * grow)) : target;
    final shape = BorderRadius.vertical(top: Radius.circular(radius), bottom: Radius.circular(radius / 4));
    if (!earned) {
      return SizedBox(height: h, child: CustomPaint(painter: _DashedRungPainter(color: border, radius: radius)));
    }
    return Container(
      height: h,
      decoration: BoxDecoration(
        color: KsMural.rungs[index],
        borderRadius: shape,
        // The lowest rung is a pale fill; a solid edge keeps it visible on
        // white and distinct from the dashed "not yet" outline.
        border: index == 0 ? Border.all(color: border, width: 1.5) : null,
      ),
    );
  }
}

/// Dashed rounded outline for a rung that is not earned yet.
class _DashedRungPainter extends CustomPainter {
  _DashedRungPainter({required this.color, required this.radius});
  final Color color;
  final double radius;

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 2.0;
    final rect = (Offset.zero & size).deflate(stroke / 2);
    final rrect = RRect.fromRectAndCorners(
      rect,
      topLeft: Radius.circular(radius),
      topRight: Radius.circular(radius),
      bottomLeft: Radius.circular(radius / 4),
      bottomRight: Radius.circular(radius / 4),
    );
    final paint =
        Paint()
          ..color = color
          ..style = PaintingStyle.stroke
          ..strokeWidth = stroke;
    final path = Path()..addRRect(rrect);
    for (final m in path.computeMetrics()) {
      var d = 0.0;
      while (d < m.length) {
        canvas.drawPath(m.extractPath(d, (d + 5).clamp(0, m.length)), paint);
        d += 9;
      }
    }
  }

  @override
  bool shouldRepaint(_DashedRungPainter old) => old.color != color || old.radius != radius;
}
