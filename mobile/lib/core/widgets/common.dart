import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../format.dart';
import '../l10n/l10n.dart';
import '../theme/tokens.dart';

enum Tone { success, warning, danger, info, neutral }

(Color, Color) toneColors(BuildContext context, Tone tone) {
  final c = context.statusColors;
  return switch (tone) {
    Tone.success => (c.successBg, c.successFg),
    Tone.warning => (c.warningBg, c.warningFg),
    Tone.danger => (c.dangerBg, c.dangerFg),
    Tone.info => (c.infoBg, c.infoFg),
    Tone.neutral => (c.neutralBg, c.neutralFg),
  };
}

/// Pill badge: 12px/600, tinted bg-50 + text-600 (DESIGN.md).
class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.label, this.tone = Tone.neutral, this.icon});

  final String label;
  final Tone tone;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = toneColors(context, tone);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[Icon(icon, size: 14, color: fg), const SizedBox(width: 4)],
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
        style: TextStyle(
          color: scheme.onPrimaryContainer,
          fontWeight: FontWeight.w600,
          fontSize: size * 0.36,
        ),
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

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.message, this.action});

  final IconData icon;
  final String message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final c = context.statusColors;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(KsSpace.s8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 40, color: c.textSecondary),
            const SizedBox(height: KsSpace.s3),
            Text(
              message,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: c.textSecondary),
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
      message: errorText(context, error),
      action: onRetry == null
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
          Text(value, style: style, textAlign: TextAlign.right),
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
      SnackBar(
        content: Text(message),
        backgroundColor: error ? Theme.of(context).colorScheme.error : null,
      ),
    );
}
