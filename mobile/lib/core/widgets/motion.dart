import 'package:flutter/widgets.dart';

import '../theme/tokens.dart';

/// Animates a 0–1 progress value towards [value] using the content motion
/// token and brand easing. Under reduced motion the value snaps instantly.
class KsAnimatedFraction extends StatelessWidget {
  const KsAnimatedFraction({super.key, required this.value, required this.builder, this.duration = KsMotion.content});

  final double value;
  final Duration duration;
  final Widget Function(BuildContext context, double value) builder;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: value.clamp(0, 1).toDouble()),
      duration: KsMotion.of(context, duration),
      curve: KsMotion.easing,
      builder: (context, v, _) => builder(context, v),
    );
  }
}
