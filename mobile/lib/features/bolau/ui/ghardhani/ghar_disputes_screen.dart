import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/l10n/l10n.dart';
import '../../../../core/router/router.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/eco.dart';
import '../../../worker/trust/trust_data.dart';
import '../../../worker/trust/ui/disputes_screen.dart' show DisputeCard;

/// Ghardhani → Profile → My disputes: every dispute on the Ghardhani's
/// bookings (`GET /me/booking-disputes`), whoever raised it.
class GharDisputesScreen extends ConsumerWidget {
  const GharDisputesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final value = ref.watch(bookingDisputesProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.gharDisputesTitle)),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(bookingDisputesProvider);
          try {
            await ref.read(bookingDisputesProvider.future);
          } catch (_) {}
        },
        child: FeatureAsyncBody<List<Dispute>>(
          value: value,
          onRetry: () => ref.invalidate(bookingDisputesProvider),
          data:
              (items) => ListView(
                padding: const EdgeInsets.all(KsSpace.page),
                children: [
                  Text(l.gharDisputesHint, style: t.bodyMedium),
                  const SizedBox(height: KsSpace.s3),
                  if (items.isEmpty) EmptyState(icon: LucideIcons.messageSquare, message: l.gharDisputesEmpty),
                  for (final d in items)
                    DisputeCard(
                      key: Key('dispute_${d.id}'),
                      dispute: d,
                      onTap: () => context.push(Routes.gharDispute(d.id), extra: d),
                    ),
                ],
              ),
        ),
      ),
    );
  }
}
