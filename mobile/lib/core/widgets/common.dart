import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../format.dart';
import '../l10n/l10n.dart';
import '../theme/tokens.dart';
import 'signature/illustration.dart';

enum Tone { success, warning, danger, info, verified, neutral }

/// (soft background, AA text colour) for a [Tone] — text always uses the
/// `*.text` token on the `*.soft` background (design/tokens.json).
(Color, Color) toneColors(BuildContext context, Tone tone) {
  final c = context.ks;
  return switch (tone) {
    Tone.success => (c.successSoft, c.successText),
    Tone.warning => (c.warningSoft, c.warningText),
    Tone.danger => (c.errorSoft, c.errorText),
    Tone.info => (c.infoSoft, c.infoText),
    Tone.verified => (c.verifiedSoft, c.verifiedText),
    Tone.neutral => (c.neutralSoft, c.neutralText),
  };
}

/// Default icon per tone so status is never colour-only. Neutral badges are
/// labels/categories rather than states and carry no icon by default.
IconData? toneIcon(Tone tone) => switch (tone) {
  Tone.success => LucideIcons.circleCheck,
  Tone.warning => LucideIcons.triangleAlert,
  Tone.danger => LucideIcons.circleAlert,
  Tone.info => LucideIcons.info,
  Tone.verified => LucideIcons.badgeCheck,
  Tone.neutral => null,
};

/// Status chip: pill, 12/16 semibold label in `*.text` on `*.soft`, with an
/// icon (the tone default unless [icon] is given or [showIcon] is false).
class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.label, this.tone = Tone.neutral, this.icon, this.showIcon = true});

  final String label;
  final Tone tone;
  final IconData? icon;
  final bool showIcon;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = toneColors(context, tone);
    final glyph = showIcon ? (icon ?? toneIcon(tone)) : null;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(KsRadius.pill)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (glyph != null) ...[ExcludeSemantics(child: Icon(glyph, size: 14, color: fg)), const SizedBox(width: 4)],
          Flexible(
            child: Text(
              label,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(color: fg),
            ),
          ),
        ],
      ),
    );
  }
}

class WorkerAvatar extends StatelessWidget {
  const WorkerAvatar({super.key, required this.name, this.photo, this.size = 44});

  final String name;
  final String? photo;
  final double size;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final fallback = CircleAvatar(
      radius: size / 2,
      backgroundColor: scheme.primaryContainer,
      child: Text(
        initials(name),
        style: TextStyle(color: scheme.onPrimaryContainer, fontWeight: FontWeight.w600, fontSize: size * 0.36),
      ),
    );
    if (photo == null || photo!.isEmpty) return fallback;
    return ClipOval(
      child: CachedNetworkImage(
        imageUrl: photo!,
        width: size,
        height: size,
        fit: BoxFit.cover,
        placeholder: (_, _) => fallback,
        errorWidget: (_, _, _) => fallback,
      ),
    );
  }
}

/// Square worker photo for cut-paper frames: the worker's own verified
/// photo, or their initials on plain paper (never a stock face).
class WorkerPhoto extends StatelessWidget {
  const WorkerPhoto({super.key, required this.name, this.url, this.missingLabel});

  final String name;
  final String? url;

  /// Read out when there is no photo (e.g. "No photo yet").
  final String? missingLabel;

  @override
  Widget build(BuildContext context) {
    final fallback = Semantics(
      label: missingLabel,
      child: Container(
        color: KsPalette.surfaceMuted,
        alignment: Alignment.center,
        child: ExcludeSemantics(
          child: Text(
            initials(name),
            style: Theme.of(context).textTheme.titleLarge?.copyWith(color: KsPalette.textPrimary),
          ),
        ),
      ),
    );
    final u = url;
    if (u == null || u.isEmpty) return fallback;
    return CachedNetworkImage(
      imageUrl: u,
      fit: BoxFit.cover,
      placeholder: (_, _) => fallback,
      errorWidget: (_, _, _) => fallback,
    );
  }
}

/// Empty / unavailable state. On worker (street mural) surfaces it shows
/// [art], a scene from the shared illustration kit, or — for states without
/// a fitting scene — the icon drawn as a small illustration
/// ([IllustratedIcon]). Supervisor (ledger) screens and errors keep a plain
/// muted icon.
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.message,
    this.action,
    this.illustrated = true,
    this.art,
  });

  final IconData icon;
  final String message;
  final Widget? action;
  final bool illustrated;

  /// Kit scene for worker surfaces (decorative; [message] carries meaning).
  final KsArt? art;

  @override
  Widget build(BuildContext context) {
    final c = context.ks;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(KsSpace.s8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (illustrated && context.expressive && art != null)
              EmptyStateArt(art: art!)
            else if (illustrated && context.expressive)
              IllustratedIcon(icon: icon)
            else
              Icon(icon, size: 40, color: c.textMuted),
            const SizedBox(height: KsSpace.s3),
            Text(
              message,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: c.textMuted),
            ),
            if (action != null) ...[const SizedBox(height: KsSpace.s4), action!],
          ],
        ),
      ),
    );
  }
}

class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.error, this.onRetry});

  final Object? error;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return EmptyState(
      icon: LucideIcons.circleAlert,
      illustrated: false,
      message: errorText(context, error),
      action:
          onRetry == null
              ? null
              : OutlinedButton.icon(
                onPressed: onRetry,
                icon: const Icon(LucideIcons.refreshCw, size: 18),
                label: Text(context.l10n.commonRetry),
              ),
    );
  }
}

/// Renders an [AsyncValue] with consistent loading / error states.
class AsyncBody<T> extends StatelessWidget {
  const AsyncBody({super.key, required this.value, required this.data, this.onRetry});

  final AsyncValue<T> value;
  final Widget Function(T data) data;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final v = value;
    if (v.hasValue) return data(v.requireValue);
    if (v.hasError) return ErrorView(error: v.error, onRetry: onRetry);
    return const Center(child: CircularProgressIndicator());
  }
}

/// A bordered card section with an optional title.
class SectionCard extends StatelessWidget {
  const SectionCard({super.key, this.title, required this.child, this.padding, this.trailing});

  final String? title;
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: padding ?? const EdgeInsets.all(KsSpace.s4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (title != null) ...[
              Row(
                children: [
                  Expanded(child: Text(title!, style: Theme.of(context).textTheme.titleSmall)),
                  if (trailing != null) trailing!,
                ],
              ),
              const SizedBox(height: KsSpace.s3),
            ],
            child,
          ],
        ),
      ),
    );
  }
}

/// Label / value row used on payslips and profile.
class KeyValueRow extends StatelessWidget {
  const KeyValueRow({super.key, required this.label, required this.value, this.bold = false, this.valueColor});

  final String label;
  final String value;
  final bool bold;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final style = (bold ? t.titleSmall : t.bodyLarge)?.copyWith(
      fontFeatures: const [FontFeature.tabularFigures()],
      color: valueColor,
    );
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(child: Text(label, style: bold ? t.titleSmall : t.bodyLarge)),
          const SizedBox(width: KsSpace.s3),
          // Long values (site names, addresses) wrap instead of overflowing.
          Flexible(child: Text(value, style: style, textAlign: TextAlign.right)),
        ],
      ),
    );
  }
}

void showSnack(BuildContext context, String message, {bool error = false}) {
  final m = ScaffoldMessenger.maybeOf(context);
  if (m == null) return;
  m
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(content: Text(message), backgroundColor: error ? Theme.of(context).colorScheme.error : null),
    );
}
