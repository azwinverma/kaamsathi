import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../api/api_activity.dart';
import '../l10n/l10n.dart';
import '../providers.dart';
import '../theme/tokens.dart';

/// App-wide, non-blocking network hint drawn over every route (mounted from
/// `MaterialApp.builder`). Quiet on a good connection; only when a request
/// has been in flight longer than [slowAfter] does a thin progress line run
/// along the top with a small "Slow connection…" pill. A request that could
/// not reach the server shows a "No internet connection" pill for
/// [offlineFor] (or until the next request succeeds).
class NetworkActivityIndicator extends ConsumerStatefulWidget {
  const NetworkActivityIndicator({super.key, required this.child});

  final Widget child;

  static const slowAfter = Duration(milliseconds: 1500);
  static const offlineFor = Duration(seconds: 5);

  @override
  ConsumerState<NetworkActivityIndicator> createState() => _NetworkActivityIndicatorState();
}

enum _Hint { none, slow, offline }

class _NetworkActivityIndicatorState extends ConsumerState<NetworkActivityIndicator> {
  ApiActivity? _activity;
  Timer? _timer;
  _Hint _hint = _Hint.none;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final a = ref.read(apiActivityProvider);
    if (!identical(a, _activity)) {
      _activity?.removeListener(_update);
      _activity = a..addListener(_update);
      _update();
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _activity?.removeListener(_update);
    super.dispose();
  }

  /// Recomputes the hint and, if it will change by itself later (a request
  /// turning slow, the offline pill expiring), schedules one re-check.
  void _update() {
    final a = _activity;
    if (a == null) return;
    _timer?.cancel();
    _timer = null;
    final now = a.now();
    var next = _Hint.none;
    Duration? recheck;
    final offlineAt = a.offlineAt;
    final oldest = a.oldestStart;
    if (offlineAt != null && now.difference(offlineAt) < NetworkActivityIndicator.offlineFor) {
      next = _Hint.offline;
      recheck = NetworkActivityIndicator.offlineFor - now.difference(offlineAt);
    } else if (oldest != null) {
      final waited = now.difference(oldest);
      if (waited >= NetworkActivityIndicator.slowAfter) {
        next = _Hint.slow;
      } else {
        recheck = NetworkActivityIndicator.slowAfter - waited;
      }
    }
    if (recheck != null) _timer = Timer(recheck, _update);
    if (next != _hint && mounted) setState(() => _hint = next);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.ks;
    final reduced = KsMotion.reduced(context);
    final top = MediaQuery.paddingOf(context).top;
    final slow = _hint == _Hint.slow;
    final duration = KsMotion.of(context, KsMotion.slow);
    return Stack(
      children: [
        widget.child,
        // Thin line at the very top while a request is slow (not under
        // reduced motion: the pill alone carries the message).
        if (slow && !reduced)
          Positioned(
            top: top,
            left: 0,
            right: 0,
            child: IgnorePointer(
              child: LinearProgressIndicator(
                minHeight: 3,
                backgroundColor: Colors.transparent,
                // Yellow brush stroke on the worker mural, plain blue on the
                // supervisor ledger.
                color: context.expressive ? c.yellow : c.actionPrimary,
              ),
            ),
          ),
        Positioned(
          top: top + kToolbarHeight + KsSpace.s2,
          left: KsSpace.page,
          right: KsSpace.page,
          child: IgnorePointer(
            child: Center(
              child: AnimatedSwitcher(
                duration: duration,
                switchInCurve: KsMotion.easing,
                switchOutCurve: KsMotion.easing,
                transitionBuilder:
                    (child, anim) => FadeTransition(
                      opacity: anim,
                      child: SlideTransition(
                        position: Tween(begin: const Offset(0, -0.4), end: Offset.zero).animate(anim),
                        child: child,
                      ),
                    ),
                child: switch (_hint) {
                  _Hint.none => const SizedBox.shrink(key: ValueKey('none')),
                  _Hint.slow => _Pill(
                    key: const ValueKey('slow'),
                    icon: LucideIcons.wifiLow,
                    label: context.l10n.commonSlowNetwork,
                    background: c.surface,
                    foreground: c.textSecondary,
                    border: c.border,
                  ),
                  _Hint.offline => _Pill(
                    key: const ValueKey('offline'),
                    icon: LucideIcons.wifiOff,
                    label: context.l10n.commonNoConnection,
                    background: c.warningSoft,
                    foreground: c.warningText,
                    border: c.warningSoft,
                  ),
                },
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({
    super.key,
    required this.icon,
    required this.label,
    required this.background,
    required this.foreground,
    required this.border,
  });

  final IconData icon;
  final String label;
  final Color background;
  final Color foreground;
  final Color border;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      child: Material(
        type: MaterialType.transparency,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: KsSpace.s3, vertical: KsSpace.s2),
          decoration: BoxDecoration(
            color: background,
            border: Border.all(color: border),
            borderRadius: BorderRadius.circular(KsRadius.pill),
            boxShadow: KsShadow.floating,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              ExcludeSemantics(child: Icon(icon, size: 16, color: foreground)),
              const SizedBox(width: KsSpace.s2),
              Flexible(child: Text(label, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: foreground))),
            ],
          ),
        ),
      ),
    );
  }
}
