import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

import 'illustration.dart';

/// An art-directed photo position (DIRECTION.md imagery policy).
///
/// Each slot has a fixed aspect ratio and an illustrated fallback: a scene
/// from the shared kit ([KsArt]), cropped around [fallbackAlignment]. The
/// commissioned photo drops in as `assets/photos/<id>.webp`; shot
/// descriptions live in docs/design/PHOTOGRAPHY_BRIEF_MOBILE.md.
class PhotoSlot {
  const PhotoSlot(
    this.id, {
    required this.aspectRatio,
    required this.fallback,
    this.fallbackAlignment = Alignment.center,
  });

  final String id;

  /// width / height.
  final double aspectRatio;
  final KsArt fallback;

  /// Where to crop [fallback] when its aspect ratio differs from the slot's
  /// (keeps the person, not the background, in frame).
  final Alignment fallbackAlignment;

  String get assetPath => 'assets/photos/$id.webp';

  /// Learn tab header: a trainer and trainees at a real workshop bench.
  /// Fallback: trainee in safety glasses at the wiring practice board.
  static const learnWorkshop = PhotoSlot(
    'mobile-learn-workshop',
    aspectRatio: 4 / 5,
    fallback: KsArt.trainingLab,
    fallbackAlignment: Alignment(0.6, 0),
  );

  /// Home career card: a worker who moved up a trade level, at work.
  /// Fallback: welder lifting her helmet after a test weld.
  static const careerStep = PhotoSlot(
    'mobile-career-step',
    aspectRatio: 1,
    fallback: KsArt.welderVisor,
    fallbackAlignment: Alignment(-0.6, 0),
  );

  /// First-run language screen: a worker scanning the site QR for hajiri.
  /// Fallback: site supervisor marking hajiri on a phone.
  static const welcomeHajiri = PhotoSlot(
    'mobile-welcome-hajiri',
    aspectRatio: 4 / 5,
    fallback: KsArt.supervisorHajiri,
    fallbackAlignment: Alignment(-0.9, 0),
  );

  static const all = [learnWorkshop, careerStep, welcomeHajiri];
}

/// Shows a [PhotoSlot]'s bundled photo when it exists, otherwise its
/// illustrated fallback.
///
/// Alt text always describes what is actually on screen: [photoAlt] for the
/// commissioned photo (the shot in the brief), [illustrationAlt] for the
/// fallback scene — the two usually show different people doing different
/// things, so one label cannot serve both.
class ImageSlot extends StatelessWidget {
  const ImageSlot({super.key, required this.slot, required this.photoAlt, required this.illustrationAlt});

  final PhotoSlot slot;

  /// Alt text for the commissioned photo (`assets/photos/<id>.webp`).
  final String photoAlt;

  /// Alt text for the illustrated fallback ([PhotoSlot.fallback]).
  final String illustrationAlt;

  static Future<Set<String>>? _bundled;

  /// Forgets the cached asset list (tests swap the asset bundle).
  @visibleForTesting
  static void debugResetBundledAssets() => _bundled = null;

  /// Asset paths in the bundle (loaded once).
  static Future<Set<String>> bundledAssets(AssetBundle bundle) =>
      _bundled ??= AssetManifest.loadFromAssetBundle(
        bundle,
      ).then((m) => m.listAssets().toSet()).catchError((Object _) => <String>{});

  @override
  Widget build(BuildContext context) {
    final fallback = KsIllustration(
      art: slot.fallback,
      alignment: slot.fallbackAlignment,
      semanticLabel: illustrationAlt,
    );
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
            semanticLabel: photoAlt,
            errorBuilder: (_, _, _) => fallback,
          );
        },
      ),
    );
  }
}
