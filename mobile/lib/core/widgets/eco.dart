import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';

import '../api/cached.dart';
import '../format.dart';
import '../l10n/l10n.dart';
import '../providers.dart';
import '../theme/app_theme.dart';
import '../theme/tokens.dart';
import 'common.dart';
import 'motion.dart';

/// Like [AsyncBody], but an endpoint that is not switched on yet (404/501)
/// shows a calm "coming soon" state instead of an error, and the whole body
/// stays scrollable so pull-to-refresh works on every state.
class FeatureAsyncBody<T> extends StatelessWidget {
  const FeatureAsyncBody({
    super.key,
    required this.value,
    required this.data,
    this.onRetry,
    this.unavailableIcon = LucideIcons.hourglass,
    this.unavailableMessage,
  });

  final AsyncValue<T> value;
  final Widget Function(T data) data;
  final VoidCallback? onRetry;
  final IconData unavailableIcon;
  final String? unavailableMessage;

  @override
  Widget build(BuildContext context) {
    final v = value;
    if (v.hasValue) return data(v.requireValue);
    if (v.hasError) {
      final Widget child =
          isFeatureUnavailable(v.error)
              ? EmptyState(icon: unavailableIcon, message: unavailableMessage ?? context.l10n.ecoComingSoon)
              : ErrorView(error: v.error, onRetry: onRetry);
      return ListView(children: [child]);
    }
    return const Center(child: CircularProgressIndicator());
  }
}

/// Thin notice shown above data that came from the offline cache.
class CachedNotice extends StatelessWidget {
  const CachedNotice({super.key});

  @override
  Widget build(BuildContext context) {
    final c = context.ks;
    return Container(
      margin: const EdgeInsets.only(bottom: KsSpace.s3),
      padding: const EdgeInsets.symmetric(horizontal: KsSpace.s3, vertical: KsSpace.s2),
      decoration: BoxDecoration(color: c.warningSoft, borderRadius: BorderRadius.circular(KsRadius.dense)),
      child: Row(
        children: [
          Icon(LucideIcons.wifiOff, size: 16, color: c.warningText),
          const SizedBox(width: KsSpace.s2),
          Expanded(
            child: Text(
              context.l10n.ecoOfflineCached,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: c.warningText),
            ),
          ),
        ],
      ),
    );
  }
}

/// Circular 0–100 score with the number in the middle.
class ScoreRing extends StatelessWidget {
  const ScoreRing({super.key, required this.score, this.size = 88});

  /// null = not enough history yet (shows "–").
  final int? score;
  final double size;

  @override
  Widget build(BuildContext context) {
    final c = context.ks;
    final s = score;
    final color =
        s == null
            ? c.neutralText
            : s >= 75
            ? c.successText
            : s >= 50
            ? c.warningText
            : c.errorText;
    return SizedBox(
      width: size,
      height: size,
      child: KsAnimatedFraction(
        value: (s ?? 0) / 100,
        builder:
            (context, f) => CustomPaint(
              painter: _RingPainter(fraction: f, color: color, track: c.neutralSoft),
              child: Center(
                child: Text(
                  s == null ? '–' : localizeDigits('$s', context.lang),
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    color: color,
                    fontWeight: FontWeight.w700,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              ),
            ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.fraction, required this.color, required this.track});
  final double fraction;
  final Color color;
  final Color track;

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 8.0;
    final rect = Offset.zero & size;
    final r = rect.deflate(stroke / 2);
    final base =
        Paint()
          ..color = track
          ..style = PaintingStyle.stroke
          ..strokeWidth = stroke;
    canvas.drawArc(r, 0, math.pi * 2, false, base);
    final fg =
        Paint()
          ..color = color
          ..style = PaintingStyle.stroke
          ..strokeWidth = stroke
          ..strokeCap = StrokeCap.round;
    canvas.drawArc(r, -math.pi / 2, math.pi * 2 * fraction.clamp(0, 1), false, fg);
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.fraction != fraction || old.color != color || old.track != track;
}

/// Label + horizontal bar for a 0–1 value, with the percent on the right.
class FractionBar extends StatelessWidget {
  const FractionBar({super.key, required this.label, required this.value, this.trailing});

  final String label;
  final double value;
  final String? trailing;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final c = context.ks;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: Text(label, style: t.bodyMedium)),
              Text(
                trailing ?? formatPercent(value, context.lang),
                style: t.labelMedium?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
              ),
            ],
          ),
          const SizedBox(height: 4),
          ClipRRect(
            borderRadius: BorderRadius.circular(KsRadius.pill),
            child: KsAnimatedFraction(
              value: value,
              builder: (context, v) => LinearProgressIndicator(value: v, minHeight: 8, backgroundColor: c.neutralSoft),
            ),
          ),
        ],
      ),
    );
  }
}

/// 1–5 star picker with 48px touch targets.
class StarInput extends StatelessWidget {
  const StarInput({super.key, required this.value, required this.onChanged, required this.semanticLabel});

  final int value;
  final ValueChanged<int> onChanged;
  final String semanticLabel;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: semanticLabel,
      value: '$value / 5',
      child: Row(
        children: [
          for (var i = 1; i <= 5; i++)
            IconButton(
              key: Key('star_${semanticLabel}_$i'),
              constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
              onPressed: () => onChanged(i),
              icon: Icon(
                LucideIcons.star,
                size: 30,
                color: i <= value ? context.ks.ratingStar : context.ks.border,
                fill: i <= value ? 1 : 0,
              ),
            ),
        ],
      ),
    );
  }
}

/// Section heading used to group menu cards on profile/money screens.
class GroupLabel extends StatelessWidget {
  const GroupLabel(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, KsSpace.s4, 4, KsSpace.s2),
      child: Text(text, style: Theme.of(context).textTheme.labelLarge?.copyWith(color: context.ks.textMuted)),
    );
  }
}

/// A navigation row inside a menu card.
class MenuTile extends StatelessWidget {
  const MenuTile({super.key, required this.icon, required this.title, this.subtitle, required this.onTap});

  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon),
      title: Text(title),
      subtitle: subtitle == null ? null : Text(subtitle!),
      trailing: const Icon(LucideIcons.chevronRight),
      onTap: onTap,
    );
  }
}

/// Downloads an authenticated PDF (or other file) to the temp dir and opens
/// it with the system viewer. Shows a friendly snack on failure. [apiPath]
/// may also be an absolute (signed) URL; [mimeType] picks the viewer.
Future<void> downloadAndOpen(
  BuildContext context,
  WidgetRef ref, {
  required String apiPath,
  required String fileName,
  String mimeType = 'application/pdf',
}) async {
  final l = context.l10n;
  try {
    final dir = await getTemporaryDirectory();
    final path = '${dir.path}${Platform.pathSeparator}$fileName';
    final api = ref.read(apiClientProvider);
    if (mimeType == 'application/pdf') {
      await api.download(apiPath, path);
    } else {
      await api.downloadFile(apiPath, path);
    }
    final r = await OpenFilex.open(path, type: mimeType);
    if (r.type != ResultType.done && context.mounted) {
      showSnack(context, l.talabPdfError, error: true);
    }
  } catch (e) {
    if (!context.mounted) return;
    showSnack(context, isFeatureUnavailable(e) ? l.ecoPdfNotReady : errorText(context, e), error: true);
  }
}

/// Copies [text] and confirms with a snack.
Future<void> copyText(BuildContext context, String text) async {
  await Clipboard.setData(ClipboardData(text: text));
  if (context.mounted) showSnack(context, context.l10n.ecoCopied);
}

/// Standard confirm dialog; returns true when confirmed.
Future<bool> confirmDialog(
  BuildContext context, {
  required String title,
  String? body,
  required String confirmLabel,
  bool danger = false,
}) async {
  final l = context.l10n;
  final ok = await showDialog<bool>(
    context: context,
    builder:
        (ctx) => AlertDialog(
          title: Text(title),
          content: body == null ? null : Text(body),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l.commonCancel)),
            FilledButton(
              style: danger ? destructiveFilledStyle(ctx) : null,
              onPressed: () => Navigator.pop(ctx, true),
              child: Text(confirmLabel),
            ),
          ],
        ),
  );
  return ok ?? false;
}

/// "Verified employer" pill for job and employment cards (KYB passed).
class EmployerVerifiedBadge extends StatelessWidget {
  const EmployerVerifiedBadge({super.key});

  @override
  Widget build(BuildContext context) => StatusBadge(
    key: const Key('employer_verified'),
    label: context.l10n.employerVerified,
    tone: Tone.success,
    icon: LucideIcons.badgeCheck,
  );
}

/// Calm info box (icon + text) used for notes such as "KaamSathi reviews
/// your interest first".
class InfoNote extends StatelessWidget {
  const InfoNote({super.key, required this.text, this.icon = LucideIcons.info, this.tone = Tone.info});
  final String text;
  final IconData icon;
  final Tone tone;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = toneColors(context, tone);
    return Container(
      padding: const EdgeInsets.all(KsSpace.s3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(KsRadius.dense)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: fg),
          const SizedBox(width: KsSpace.s2),
          Expanded(child: Text(text, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: fg))),
        ],
      ),
    );
  }
}

/// Non-scrolling variant of [FeatureAsyncBody] for a section inside a list,
/// so content above it (e.g. safety guidance) stays visible in every state.
class FeatureAsyncSection<T> extends StatelessWidget {
  const FeatureAsyncSection({super.key, required this.value, required this.data, this.onRetry});

  final AsyncValue<T> value;
  final Widget Function(T data) data;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final v = value;
    if (v.hasValue) return data(v.requireValue);
    if (v.hasError) {
      return isFeatureUnavailable(v.error)
          ? EmptyState(icon: LucideIcons.hourglass, message: context.l10n.ecoComingSoon)
          : ErrorView(error: v.error, onRetry: onRetry);
    }
    return const Padding(padding: EdgeInsets.all(KsSpace.s8), child: Center(child: CircularProgressIndicator()));
  }
}
