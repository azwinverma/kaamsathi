import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/session.dart';
import '../../../core/l10n/l10n.dart';
import '../../../core/theme/tokens.dart';
import '../../../core/widgets/common.dart';

/// Restores the session, then the router redirects to the right place.
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  Object? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _boot());
  }

  Future<void> _boot() async {
    setState(() => _error = null);
    try {
      await ref.read(sessionProvider.notifier).bootstrap();
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.primary,
      body: SafeArea(
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(KsRadius.card),
                child: Image.asset('assets/logo.png', width: 96, height: 96),
              ),
              const SizedBox(height: KsSpace.s4),
              Text(
                'KaamSathi · कामसाथी',
                style: Theme.of(
                  context,
                ).textTheme.headlineMedium?.copyWith(color: Theme.of(context).colorScheme.onPrimary),
              ),
              const SizedBox(height: KsSpace.s2),
              Text(
                context.l10n.appTagline,
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: Theme.of(context).colorScheme.onPrimary),
              ),
              const SizedBox(height: KsSpace.s8),
              if (_error == null)
                SizedBox(
                  width: 28,
                  height: 28,
                  child: CircularProgressIndicator(color: Theme.of(context).colorScheme.onPrimary, strokeWidth: 3),
                )
              else
                Card(
                  margin: const EdgeInsets.symmetric(horizontal: KsSpace.s6),
                  child: ErrorView(error: _error, onRetry: _boot),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
