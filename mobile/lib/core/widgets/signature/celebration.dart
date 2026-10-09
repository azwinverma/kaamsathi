import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../l10n/l10n.dart';
import '../../theme/tokens.dart';
import '../common.dart';

/// The only moments that earn a celebration (brand v3 "Delight must be
/// earned"; DIRECTION.md motion). Never for saves, logins or filters.
enum Milestone {
  firstVerifiedCredential,
  firstPlacement,
  profileComplete,
  trainingCompleted,

  /// Bolau: ID verified and taking bookings — Ghardhani can book this Sipalu.
  sipaluBookable,
}

String milestoneMessage(AppLocalizations l, Milestone m) => switch (m) {
  Milestone.firstVerifiedCredential => l.celebrateCredential,
  Milestone.firstPlacement => l.celebratePlacement,
  Milestone.profileComplete => l.celebrateProfile,
  Milestone.trainingCompleted => l.celebrateTraining,
  Milestone.sipaluBookable => l.blCelebrateBookable,
};

/// Shows a short check-burst celebration with [message] over the current
/// screen, with a light haptic tap.
///
/// Under reduced motion there is no burst and no overlay: the message is
/// shown as a plain snack bar so the information is not lost. Returns true
/// when the animated burst was shown.
bool celebrate(BuildContext context, String message, {bool haptic = true}) {
  final overlay = Overlay.maybeOf(context, rootOverlay: true);
  if (KsMotion.reduced(context) || overlay == null) {
    showSnack(context, message);
    return false;
  }
  if (haptic) HapticFeedback.lightImpact();
  late final OverlayEntry entry;
  var removed = false;
  entry = OverlayEntry(
    builder:
        (_) => Celebration(
          message: message,
          onDone: () {
            if (removed) return;
            removed = true;
            entry.remove();
          },
        ),
  );
  overlay.insert(entry);
  return true;
}

/// Bottom card with the [CelebrationBurst] and [message]. Plays once
/// (≈2.4 s in total), then calls [onDone]; tapping dismisses it early.
class Celebration extends StatefulWidget {
  const Celebration({super.key, required this.message, required this.onDone});

  final String message;
  final VoidCallback onDone;

  @override
  State<Celebration> createState() => _CelebrationState();
}

class _CelebrationState extends State<Celebration> with SingleTickerProviderStateMixin {
  late final AnimationController _c =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 2400))
        ..addStatusListener((s) {
          if (s == AnimationStatus.completed) widget.onDone();
        })
        ..forward();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.ks;
    final t = Theme.of(context).textTheme;
    return Align(
      alignment: Alignment.bottomCenter,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(KsSpace.page, 0, KsSpace.page, 88),
          child: AnimatedBuilder(
            animation: _c,
            builder: (context, child) {
              final v = _c.value;
              // In over the first 280 ms, out over the last 360 ms.
              final opacity = v < 0.12 ? v / 0.12 : (v > 0.85 ? (1 - v) / 0.15 : 1.0);
              return Opacity(
                opacity: opacity.clamp(0.0, 1.0),
                child: Transform.translate(
                  offset: Offset(0, 12 * (1 - KsMotion.easing.transform(math.min(1, v / 0.12)))),
                  child: child,
                ),
              );
            },
            child: Material(
              key: const Key('celebration'),
              color: c.surface,
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(KsRadius.card),
                side: BorderSide(color: c.border),
              ),
              shadowColor: Colors.transparent,
              child: InkWell(
                borderRadius: BorderRadius.circular(KsRadius.card),
                onTap: widget.onDone,
                child: Padding(
                  padding: const EdgeInsets.all(KsSpace.s3),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      AnimatedBuilder(
                        animation: _c,
                        // The burst plays over the first ~0.9 s.
                        builder: (_, _) => CelebrationBurst(progress: (_c.value / 0.38).clamp(0.0, 1.0)),
                      ),
                      const SizedBox(width: KsSpace.s3),
                      Flexible(child: Semantics(liveRegion: true, child: Text(widget.message, style: t.titleSmall))),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// A teal disc with a check that draws itself and a ring of short yellow /
/// coral rays — "subtle check burst". [progress] 0–1.
class CelebrationBurst extends StatelessWidget {
  const CelebrationBurst({super.key, required this.progress, this.size = 48});

  final double progress;
  final double size;

  @override
  Widget build(BuildContext context) {
    final c = context.ks;
    return ExcludeSemantics(
      child: CustomPaint(
        size: Size.square(size),
        painter: _BurstPainter(progress: progress, disc: c.verified, check: c.surface, rayA: c.yellow, rayB: c.coral),
      ),
    );
  }
}

class _BurstPainter extends CustomPainter {
  _BurstPainter({
    required this.progress,
    required this.disc,
    required this.check,
    required this.rayA,
    required this.rayB,
  });

  final double progress;
  final Color disc;
  final Color check;
  final Color rayA;
  final Color rayB;

  double _seg(double a, double b) => KsMotion.easing.transform(((progress - a) / (b - a)).clamp(0.0, 1.0));

  @override
  void paint(Canvas canvas, Size size) {
    final centre = size.center(Offset.zero);
    final r = size.width * 0.3;
    final grow = _seg(0, 0.45);
    canvas.drawCircle(centre, r * grow, Paint()..color = disc);

    final tick = _seg(0.3, 0.8);
    if (tick > 0) {
      final path =
          Path()
            ..moveTo(centre.dx - r * 0.45, centre.dy + r * 0.02)
            ..lineTo(centre.dx - r * 0.1, centre.dy + r * 0.36)
            ..lineTo(centre.dx + r * 0.5, centre.dy - r * 0.32);
      final p =
          Paint()
            ..color = check
            ..style = PaintingStyle.stroke
            ..strokeWidth = r * 0.22
            ..strokeCap = StrokeCap.round
            ..strokeJoin = StrokeJoin.round;
      for (final m in path.computeMetrics()) {
        canvas.drawPath(m.extractPath(0, m.length * tick), p);
      }
    }

    final rays = _seg(0.4, 1);
    if (rays > 0 && rays < 1) {
      for (var i = 0; i < 8; i++) {
        final a = i * math.pi / 4 - math.pi / 8;
        final dir = Offset(math.cos(a), math.sin(a));
        final from = centre + dir * (r * (1.15 + 0.35 * rays));
        final to = centre + dir * (r * (1.35 + 0.3 * rays));
        canvas.drawLine(
          from,
          to,
          Paint()
            ..color = (i.isEven ? rayA : rayB).withValues(alpha: 1 - rays)
            ..strokeWidth = 3
            ..strokeCap = StrokeCap.round,
        );
      }
    }
  }

  @override
  bool shouldRepaint(_BurstPainter old) => old.progress != progress || old.disc != disc;
}
