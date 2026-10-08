import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

import 'illustration.dart';

/// An art-directed photo position (DIRECTION.md imagery policy).
///
/// Each slot has a fixed aspect ratio and an illustrated fallback. The
/// commissioned photo drops in as `assets/photos/<id>.webp`; shot
/// descriptions live in docs/design/PHOTOGRAPHY_BRIEF_MOBILE.md.
class PhotoSlot {
  const PhotoSlot(this.id, {required this.aspectRatio, required this.fallback});

  final String id;

  /// width / height.
  final double aspectRatio;
  final KsMotif fallback;

  String get assetPath => 'assets/photos/$id.webp';

  /// Learn tab header: a trainer and trainees at a real workshop bench.
  static const learnWorkshop = PhotoSlot('mobile-learn-workshop', aspectRatio: 4 / 5, fallback: KsMotif.workshop);

  /// Home career card: a worker who moved up a trade level, at work.
  static const careerStep = PhotoSlot('mobile-career-step', aspectRatio: 1, fallback: KsMotif.career);

  /// First-run language screen: a worker scanning the site QR for hajiri.
  static const welcomeHajiri = PhotoSlot('mobile-welcome-hajiri', aspectRatio: 4 / 5, fallback: KsMotif.welcome);

  static const all = [learnWorkshop, careerStep, welcomeHajiri];
}

/// Shows a [PhotoSlot]'s bundled photo when it exists, otherwise its
/// illustrated fallback. [semanticLabel] (alt text) is required either way.
class ImageSlot extends StatelessWidget {
  const ImageSlot({super.key, required this.slot, required this.semanticLabel});

  final PhotoSlot slot;
  final String semanticLabel;

  static Future<Set<String>>? _bundled;

  /// Asset paths in the bundle (loaded once).
  static Future<Set<String>> bundledAssets(AssetBundle bundle) =>
      _bundled ??= AssetManifest.loadFromAssetBundle(
        bundle,
      ).then((m) => m.listAssets().toSet()).catchError((Object _) => <String>{});

  @override
  Widget build(BuildContext context) {
    final fallback = KsIllustration(motif: slot.fallback, semanticLabel: semanticLabel);
    return AspectRatio(
      aspectRatio: slot.aspectRatio,
      child: FutureBuilder<Set<String>>(
        future: bundledAssets(DefaultAssetBundle.of(context)),
        builder: (context, snap) {
          final has = snap.data?.contains(slot.assetPath) ?? false;
          if (!has) return KeyedSubtree(key: Key('slot_fallback_${slot.id}'), child: fallback);
          return Image.asset(
            slot.assetPath,
            key: Key('slot_photo_${slot.id}'),
            fit: BoxFit.cover,
            semanticLabel: semanticLabel,
            errorBuilder: (_, _, _) => fallback,
          );
        },
      ),
    );
  }
}
