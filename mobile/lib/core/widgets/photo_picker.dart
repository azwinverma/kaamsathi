import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../l10n/l10n.dart';
import '../theme/tokens.dart';
import 'common.dart';

/// Picks a photo and returns its local path (null when cancelled).
/// Downscaled + compressed so uploads stay small on patchy mobile data.
typedef PhotoPick = Future<String?> Function(ImageSource source);

/// Overridable in tests (no platform channel there).
final photoPickProvider = Provider<PhotoPick>(
  (ref) => (source) async {
    final f = await ImagePicker().pickImage(source: source, maxWidth: 1600, maxHeight: 1600, imageQuality: 70);
    return f?.path;
  },
);

/// Camera / gallery buttons with a preview of the chosen document photo.
/// Images are downscaled + compressed so uploads stay small on patchy data.
class DocumentPhotoPicker extends ConsumerWidget {
  const DocumentPhotoPicker({
    super.key,
    required this.label,
    required this.path,
    required this.onChanged,
    this.maxBytes,
    this.tooBigMessage,
  });

  final String label;
  final String? path;
  final ValueChanged<String?> onChanged;

  /// Rejects larger files with [tooBigMessage].
  final int? maxBytes;
  final String? tooBigMessage;

  Future<void> _pick(BuildContext context, WidgetRef ref, ImageSource source) async {
    try {
      final p = await ref.read(photoPickProvider)(source);
      if (p == null) return;
      final max = maxBytes;
      if (max != null) {
        final f = File(p);
        if (f.existsSync() && f.lengthSync() > max) {
          if (context.mounted) showSnack(context, tooBigMessage ?? context.l10n.credPhotoError, error: true);
          return;
        }
      }
      onChanged(p);
    } catch (_) {
      if (context.mounted) showSnack(context, context.l10n.credPhotoError, error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(label, style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: KsSpace.s2),
        if (path != null) ...[
          Stack(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(KsRadius.card),
                child: Image.file(
                  File(path!),
                  height: 160,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  cacheWidth: 600,
                  errorBuilder: (_, _, _) => const SizedBox(height: 160, child: Icon(LucideIcons.image)),
                ),
              ),
              Positioned(
                right: 4,
                top: 4,
                child: IconButton.filledTonal(
                  tooltip: l.ecoRemove,
                  onPressed: () => onChanged(null),
                  icon: const Icon(LucideIcons.x),
                ),
              ),
            ],
          ),
          const SizedBox(height: KsSpace.s2),
        ],
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                key: const Key('photo_camera'),
                onPressed: () => _pick(context, ref, ImageSource.camera),
                icon: const Icon(LucideIcons.camera),
                label: Text(l.credTakePhoto, overflow: TextOverflow.ellipsis),
              ),
            ),
            const SizedBox(width: KsSpace.s2),
            Expanded(
              child: OutlinedButton.icon(
                key: const Key('photo_gallery'),
                onPressed: () => _pick(context, ref, ImageSource.gallery),
                icon: const Icon(LucideIcons.image),
                label: Text(l.credChoosePhoto, overflow: TextOverflow.ellipsis),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

/// Outlined date button: "Started: 21 Ashwin 2083" / "Started (optional)".
class DateField extends StatelessWidget {
  const DateField({
    super.key,
    required this.label,
    required this.text,
    required this.onTap,
    this.icon = LucideIcons.calendar,
    this.errorText,
  });

  final String label;
  final String? text;
  final VoidCallback onTap;
  final IconData icon;
  final String? errorText;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(KsRadius.control),
      child: InputDecorator(
        decoration: InputDecoration(labelText: label, errorText: errorText, suffixIcon: Icon(icon)),
        isEmpty: text == null,
        child: text == null ? null : Text(text!),
      ),
    );
  }
}
