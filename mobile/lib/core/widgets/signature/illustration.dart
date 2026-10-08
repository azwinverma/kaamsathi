import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../theme/tokens.dart';
import 'brush_stroke.dart';
import 'cut_paper_frame.dart';

/// A scene from the shared illustration kit (`design/illustrations/`, the
/// same SVGs the website uses). Copies live in `assets/illustrations/` with
/// identical filenames; refresh them with `tool/sync_illustrations.sh`.
///
/// Only the scenes the app shows are bundled. Adding one: add the value
/// here, then run the sync script with the new filename.
enum KsArt {
  /// Older site supervisor marking hajiri on a phone, scaffold behind (4:3).
  supervisorHajiri('supervisor-hajiri', 480 / 360, Color(0xFFF0FDFA)),

  /// Instructor and trainee at a wiring practice board (4:3).
  trainingLab('training-lab', 480 / 360, Color(0xFFEFF6FF)),

  /// Woman welder lifting her helmet after a test weld (4:3).
  welderVisor('welder-visor', 480 / 360, Color(0xFFF0FDFA)),

  /// Woman electrician testing a breaker in a distribution board (4:5).
  electricianBoard('electrician-board', 400 / 500, Color(0xFFFFF1F1)),

  /// Plumber with a pipe wrench under a rooftop water tank (4:5).
  plumberWrench('plumber-wrench', 400 / 500, Color(0xFFEFF6FF)),

  /// Solar installer on a tin roof, harness clipped to an anchor (4:5).
  solarRoof('solar-roof', 400 / 500, Color(0xFFEFF6FF)),

  /// Cook at a karahi with a pressure cooker (4:5).
  cookKitchen('cook-kitchen', 400 / 500, Color(0xFFFEF9E7)),

  /// Hands holding a phone showing the Skill Passport (4:5).
  passportPhone('passport-phone', 400 / 500, Color(0xFFFEF9E7));

  const KsArt(this.file, this.aspectRatio, this.ground);

  /// Filename without extension, identical to `design/illustrations/`.
  final String file;

  /// Canvas width / height (portrait 400×500, wide 480×360).
  final double aspectRatio;

  /// The scene's flat ground tint, shown while the SVG loads.
  final Color ground;

  String get assetPath => 'assets/illustrations/$file.svg';

  /// Scenes on the first screens a worker sees (language screen, home
  /// career card, Learn tab); [precacheFirstScreens] warms them.
  static const firstScreens = [supervisorHajiri, welderVisor, trainingLab];

  /// Parses [firstScreens] into flutter_svg's picture cache ahead of time so
  /// the first frame on a low-end phone does not wait on XML parsing.
  static Future<void> precacheFirstScreens() => Future.wait([
    for (final a in firstScreens)
      () {
        final loader = SvgAssetLoader(a.assetPath);
        return svg.cache.putIfAbsent(loader.cacheKey(null), () => loader.loadBytes(null));
      }(),
  ]).then((_) {}, onError: (Object _) {});
}

/// A [KsArt] scene filling its box ([BoxFit.cover], cropped around
/// [alignment]). Decorative unless [semanticLabel] is given.
class KsIllustration extends StatelessWidget {
  const KsIllustration({
    super.key,
    required this.art,
    this.semanticLabel,
    this.fit = BoxFit.cover,
    this.alignment = Alignment.center,
  });

  final KsArt art;
  final String? semanticLabel;
  final BoxFit fit;
  final Alignment alignment;

  @override
  Widget build(BuildContext context) {
    // Fixed colours in both themes: it is a printed illustration.
    final picture = SvgPicture.asset(
      art.assetPath,
      key: ValueKey('art_${art.file}'),
      fit: fit,
      alignment: alignment,
      excludeFromSemantics: true,
      placeholderBuilder: (_) => ColoredBox(color: art.ground, child: const SizedBox.expand()),
    );
    final box = ClipRect(child: SizedBox.expand(child: picture));
    if (semanticLabel == null) return ExcludeSemantics(child: box);
    return Semantics(image: true, label: semanticLabel, child: ExcludeSemantics(child: box));
  }
}

/// A [KsArt] scene for an empty state, in a small cut-paper sheet at its
/// native aspect ratio. Always decorative: the state's message carries the
/// meaning.
class EmptyStateArt extends StatelessWidget {
  const EmptyStateArt({super.key, required this.art, this.height = 132});

  final KsArt art;

  /// Picture height; width follows the scene's aspect ratio.
  final double height;

  @override
  Widget build(BuildContext context) {
    final frameW = height * art.aspectRatio + 10;
    return ExcludeSemantics(
      child: CutPaperFrame(
        width: frameW,
        aspectRatio: frameW / (height + 10),
        angle: -0.05,
        tapeColor: context.ks.teal,
        child: KsIllustration(art: art),
      ),
    );
  }
}

/// Illustrated stand-in for an empty state: the state's icon on a tilted
/// sheet of tinted paper with a short teal brush stroke and spray dots.
/// Used on worker (mural) surfaces; supervisor screens keep a plain icon.
class IllustratedIcon extends StatelessWidget {
  const IllustratedIcon({super.key, required this.icon, this.size = 112});

  final IconData icon;
  final double size;

  @override
  Widget build(BuildContext context) {
    final c = context.ks;
    return ExcludeSemantics(
      child: SizedBox(
        width: size * 1.3,
        height: size,
        child: Stack(
          alignment: Alignment.center,
          children: [
            Transform.rotate(
              angle: -0.07,
              child: Container(
                width: size * 0.82,
                height: size * 0.82,
                decoration: BoxDecoration(color: c.yellowSubtle, borderRadius: BorderRadius.circular(KsRadius.sm)),
              ),
            ),
            Positioned(
              bottom: size * 0.04,
              child: BrushStroke(
                width: size * 0.9,
                height: size * 0.22,
                color: c.teal,
                shape: BrushShape.underline,
                strokeWidth: size * 0.07,
              ),
            ),
            Positioned(
              top: size * 0.06,
              right: size * 0.12,
              child: Row(
                children: [
                  _dot(size * 0.06, c.coral),
                  SizedBox(width: size * 0.03),
                  Padding(padding: EdgeInsets.only(top: size * 0.06), child: _dot(size * 0.035, c.coral)),
                ],
              ),
            ),
            Icon(icon, size: size * 0.42, color: c.textPrimary),
          ],
        ),
      ),
    );
  }

  Widget _dot(double d, Color color) =>
      Container(width: d, height: d, decoration: BoxDecoration(color: color, shape: BoxShape.circle));
}
