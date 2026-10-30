import 'package:flutter/material.dart';

import '../l10n/l10n.dart';
import '../theme/tokens.dart';

// Skeleton placeholders shown while content loads, in place of a bare
// spinner: the page keeps its shape, so the data "fills in" instead of
// popping in. Blocks use the muted surface token and a soft sweep of the
// surface highlight; under reduced motion they are static.
//
// Screen readers hear one "Loading…" (live region); the blocks themselves
// are excluded from semantics.

/// Drives a slow highlight sweep across every [SkeletonBlock] below it. One
/// controller per skeleton and the gradient is laid out in this widget's
/// coordinates, so all blocks shimmer as a single band (card frames and
/// backgrounds are not tinted).
class KsShimmer extends StatefulWidget {
  const KsShimmer({super.key, required this.child});

  final Widget child;

  /// One full sweep. Slow on purpose: calm, not flashy.
  static const period = Duration(milliseconds: 1500);

  @override
  State<KsShimmer> createState() => _KsShimmerState();
}

class _KsShimmerState extends State<KsShimmer> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: KsShimmer.period);
  bool _active = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Reduced motion: static blocks, no ticker at all.
    _active = !KsMotion.reduced(context);
    if (!_active) {
      _c.stop();
    } else if (!_c.isAnimating) {
      _c.repeat();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => _ShimmerScope(state: this, active: _active, child: widget.child);
}

class _ShimmerScope extends InheritedWidget {
  const _ShimmerScope({required this.state, required this.active, required super.child});

  final _KsShimmerState state;
  final bool active;

  static _ShimmerScope? maybeOf(BuildContext context) => context.dependOnInheritedWidgetOfExactType<_ShimmerScope>();

  @override
  bool updateShouldNotify(_ShimmerScope old) => active != old.active;
}

/// Moves the gradient horizontally by [slide] × its width.
class _SlideGradient extends GradientTransform {
  const _SlideGradient(this.slide);

  final double slide;

  @override
  Matrix4 transform(Rect bounds, {TextDirection? textDirection}) =>
      Matrix4.translationValues(bounds.width * slide, 0, 0);
}

/// A single rounded placeholder block in the muted surface colour.
class SkeletonBlock extends StatelessWidget {
  const SkeletonBlock({super.key, this.width, this.height = 14, this.radius = KsRadius.xs, this.circle = false});

  /// A circular block (avatar / icon) of [size].
  const SkeletonBlock.circle({super.key, double size = KsSpace.s10})
    : width = size,
      height = size,
      radius = 0,
      circle = true;

  final double? width;
  final double height;
  final double radius;
  final bool circle;

  @override
  Widget build(BuildContext context) {
    final c = context.ks;
    final block = Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: c.surfaceMuted,
        shape: circle ? BoxShape.circle : BoxShape.rectangle,
        borderRadius: circle ? null : BorderRadius.circular(radius),
      ),
    );
    final scope = _ShimmerScope.maybeOf(context);
    if (scope == null || !scope.active) return block;
    final dark = Theme.of(context).brightness == Brightness.dark;
    // Worker (mural) surfaces get a faint blue-wall tint in the sweep; the
    // supervisor ledger stays neutral.
    final highlight = dark ? c.borderStrong : (context.expressive ? c.actionPrimarySubtle : c.surface);
    final anim = scope.state._c;
    return AnimatedBuilder(
      animation: anim,
      child: block,
      builder:
          (context, child) => ShaderMask(
            blendMode: BlendMode.srcATop,
            shaderCallback: (bounds) {
              final root = scope.state.context.findRenderObject() as RenderBox?;
              final me = context.findRenderObject() as RenderBox?;
              if (root == null || me == null || !root.hasSize || !me.attached) {
                return LinearGradient(colors: [c.surfaceMuted, c.surfaceMuted]).createShader(bounds);
              }
              final at = me.localToGlobal(Offset.zero, ancestor: root);
              return LinearGradient(
                begin: const Alignment(-1, -0.3),
                end: const Alignment(1, 0.3),
                colors: [c.surfaceMuted, highlight, c.surfaceMuted],
                stops: const [0.3, 0.5, 0.7],
                transform: _SlideGradient(anim.value * 2 - 1),
              ).createShader(Rect.fromLTWH(-at.dx, -at.dy, root.size.width, root.size.height));
            },
            child: child,
          ),
    );
  }
}

/// Shared frame for the ready-made layouts: the localized live-region label,
/// the shimmer, and a non-scrolling, clipped body that fits both bounded
/// (Scaffold body) and unbounded (inside a list) parents.
class Skeleton extends StatelessWidget {
  const Skeleton({super.key, required this.child, this.padding = const EdgeInsets.all(KsSpace.page)});

  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final body = Padding(padding: padding, child: child);
    return Semantics(
      label: context.l10n.commonLoading,
      liveRegion: true,
      container: true,
      child: ExcludeSemantics(
        child: KsShimmer(
          child: LayoutBuilder(
            builder: (context, constraints) {
              if (!constraints.hasBoundedHeight) return body;
              return ClipRect(
                child: SingleChildScrollView(
                  primary: false,
                  physics: const NeverScrollableScrollPhysics(),
                  child: body,
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

/// A list of cards, each an avatar and two lines — the default loading state
/// for list screens (and for [AsyncBody]).
class SkeletonList extends StatelessWidget {
  const SkeletonList({
    super.key,
    this.count = 6,
    this.avatar = true,
    this.padding = const EdgeInsets.all(KsSpace.page),
  });

  final int count;
  final bool avatar;

  /// Page padding; pass [EdgeInsets.zero] inside an already padded list.
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Skeleton(
      padding: padding,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < count; i++) ...[
            if (i > 0) const SizedBox(height: KsSpace.s3),
            _SkeletonCard(avatar: avatar, wide: i.isEven),
          ],
        ],
      ),
    );
  }
}

class _SkeletonCard extends StatelessWidget {
  const _SkeletonCard({required this.avatar, required this.wide});

  final bool avatar;
  final bool wide;

  @override
  Widget build(BuildContext context) {
    final c = context.ks;
    return Container(
      padding: const EdgeInsets.all(KsSpace.s4),
      decoration: BoxDecoration(
        color: c.surface,
        border: Border.all(color: c.border),
        borderRadius: BorderRadius.circular(context.expressive ? KsRadius.card : KsRadius.dense),
      ),
      child: Row(
        children: [
          if (avatar) ...[const SkeletonBlock.circle(), const SizedBox(width: KsSpace.s3)],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                FractionallySizedBox(widthFactor: wide ? 0.7 : 0.55, child: const SkeletonBlock(height: 14)),
                const SizedBox(height: KsSpace.s2),
                FractionallySizedBox(widthFactor: wide ? 0.45 : 0.6, child: const SkeletonBlock(height: 12)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A detail page: a header block, a title, then paragraph lines and a
/// couple of field rows.
class SkeletonDetail extends StatelessWidget {
  const SkeletonDetail({super.key, this.padding = const EdgeInsets.all(KsSpace.page)});

  /// Page padding; pass [EdgeInsets.zero] inside an already padded list.
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Skeleton(
      padding: padding,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SkeletonBlock(height: 140, radius: KsRadius.card),
          const SizedBox(height: KsSpace.s6),
          const FractionallySizedBox(widthFactor: 0.6, child: SkeletonBlock(height: 22)),
          const SizedBox(height: KsSpace.s3),
          const FractionallySizedBox(widthFactor: 0.35, child: SkeletonBlock(height: 14)),
          const SizedBox(height: KsSpace.s6),
          for (final f in const [1.0, 0.92, 0.97, 0.7]) ...[
            FractionallySizedBox(widthFactor: f, child: const SkeletonBlock(height: 12)),
            const SizedBox(height: KsSpace.s2),
          ],
          const SizedBox(height: KsSpace.s4),
          for (var i = 0; i < 3; i++) ...[
            const Row(
              children: [
                Expanded(flex: 2, child: SkeletonBlock(height: 12)),
                SizedBox(width: KsSpace.s8),
                Expanded(flex: 3, child: SkeletonBlock(height: 12)),
              ],
            ),
            const SizedBox(height: KsSpace.s4),
          ],
        ],
      ),
    );
  }
}

/// A compact block for a section inside a scrolling page: a title and a few
/// short lines, no page padding of its own beyond a small inset.
class SkeletonSection extends StatelessWidget {
  const SkeletonSection({super.key, this.lines = 3});

  final int lines;

  @override
  Widget build(BuildContext context) {
    return Skeleton(
      padding: const EdgeInsets.symmetric(vertical: KsSpace.s3),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const FractionallySizedBox(widthFactor: 0.4, child: SkeletonBlock(height: 16)),
          for (var i = 0; i < lines; i++) ...[
            const SizedBox(height: KsSpace.s3),
            FractionallySizedBox(widthFactor: i.isEven ? 0.9 : 0.65, child: const SkeletonBlock(height: 12)),
          ],
        ],
      ),
    );
  }
}

/// Cross-fades from a loading skeleton to the content (or error) that
/// replaces it, so data eases in rather than popping. Content-to-content
/// changes (refreshes, error → data) swap instantly; reduced motion makes
/// every change instant.
class SkeletonSwitcher extends StatelessWidget {
  const SkeletonSwitcher({super.key, required this.loading, required this.child});

  final bool loading;
  final Widget child;

  static const _loadingKey = ValueKey('ks-skeleton-loading');
  static const _contentKey = ValueKey('ks-skeleton-content');

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: KsMotion.of(context, KsMotion.base),
      switchInCurve: KsMotion.easing,
      switchOutCurve: KsMotion.easing,
      layoutBuilder:
          (current, previous) => Stack(
            fit: StackFit.passthrough,
            alignment: Alignment.topCenter,
            children: [
              // Only a fading-out skeleton lingers; old content never does.
              ...previous.where((w) => w.key == _loadingKey),
              if (current != null) current,
            ],
          ),
      child: KeyedSubtree(key: loading ? _loadingKey : _contentKey, child: child),
    );
  }
}
