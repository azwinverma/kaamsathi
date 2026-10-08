import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../data/check_in_service.dart';

/// Full-screen QR scanner. Pops with the raw value of the first site QR.
class ScanScreen extends StatefulWidget {
  const ScanScreen({super.key});

  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> {
  final _controller = MobileScannerController(
    formats: const [BarcodeFormat.qrCode],
    detectionSpeed: DetectionSpeed.noDuplicates,
  );
  bool _done = false;
  String? _lastInvalid;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_done) return;
    for (final b in capture.barcodes) {
      final raw = b.rawValue;
      if (raw == null) continue;
      if (parseSiteQr(raw) != null) {
        _done = true;
        Navigator.of(context).pop(raw);
        return;
      }
      if (raw != _lastInvalid) {
        _lastInvalid = raw;
        showSnack(context, context.l10n.errInvalidQr, error: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Scaffold(
      backgroundColor: context.ks.media,
      appBar: AppBar(
        backgroundColor: context.ks.media,
        foregroundColor: context.ks.onMedia,
        title: Text(l.scanTitle, style: TextStyle(color: context.ks.onMedia)),
        actions: [
          IconButton(
            tooltip: l.scanTorch,
            onPressed: _controller.toggleTorch,
            icon: Icon(LucideIcons.flashlight, color: context.ks.onMedia),
          ),
        ],
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
            errorBuilder:
                (context, error) => _ScanError(
                  message:
                      error.errorCode == MobileScannerErrorCode.permissionDenied
                          ? l.errCameraDenied
                          : l.commonErrorGeneric,
                ),
          ),
          IgnorePointer(
            child: Center(
              child: Container(
                width: 240,
                height: 240,
                decoration: BoxDecoration(
                  border: Border.all(color: context.ks.onMedia, width: 3),
                  borderRadius: BorderRadius.circular(KsRadius.card),
                ),
              ),
            ),
          ),
          Positioned(
            left: 24,
            right: 24,
            bottom: 48,
            child: Text(
              l.scanInstructions,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(color: context.ks.onMedia),
            ),
          ),
        ],
      ),
    );
  }
}

class _ScanError extends StatelessWidget {
  const _ScanError({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: context.ks.media,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(LucideIcons.cameraOff, color: context.ks.onMedia, size: 40),
              const SizedBox(height: 16),
              Text(
                message,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: context.ks.onMedia),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => CheckInController.openSettings(CheckInProblem.locationDenied),
                child: Text(context.l10n.openSettings),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
