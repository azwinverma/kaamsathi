import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/l10n/l10n.dart';
import '../../../../core/router/router.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/eco.dart';
import '../../../../core/widgets/signature/signature.dart';
import '../../../common/ref_data.dart';
import '../../bolau_models.dart';
import '../../bolau_repository.dart';
import '../bolau_widgets.dart';

/// Search results with quick filters (instant booking, 4★ and up).
class BolauSearchScreen extends ConsumerStatefulWidget {
  const BolauSearchScreen({super.key, this.trade, this.q});
  final String? trade;
  final String? q;

  @override
  ConsumerState<BolauSearchScreen> createState() => _BolauSearchScreenState();
}

class _BolauSearchScreenState extends ConsumerState<BolauSearchScreen> {
  late BolauSearch _query = BolauSearch(trade: widget.trade, q: widget.q);

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final value = ref.watch(bolauSearchProvider(_query));
    final trades = ref.watch(tradesProvider).value ?? const <Trade>[];
    final tradeName = trades.where((t) => t.code == _query.trade).firstOrNull?.name(lang) ?? _query.trade;
    return Scaffold(
      appBar: AppBar(title: Text(tradeName ?? (_query.q?.isNotEmpty ?? false ? _query.q! : l.blFindSipalu))),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(bolauSearchProvider(_query));
          try {
            await ref.read(bolauSearchProvider(_query).future);
          } catch (_) {}
        },
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.fromLTRB(KsSpace.page, KsSpace.s2, KsSpace.page, KsSpace.s2),
              child: Row(
                children: [
                  FilterChip(
                    key: const Key('filter_instant'),
                    avatar: const Icon(LucideIcons.zap, size: 16),
                    label: Text(l.blInstant),
                    selected: _query.instant,
                    onSelected: (v) => setState(() => _query = _query.copyWith(instant: v)),
                  ),
                  const SizedBox(width: KsSpace.s2),
                  FilterChip(
                    key: const Key('filter_rating'),
                    avatar: const Icon(LucideIcons.star, size: 16),
                    label: Text(l.blFourStarsUp),
                    selected: _query.minRating == 4,
                    onSelected:
                        (v) => setState(
                          () => _query = v ? _query.copyWith(minRating: 4) : _query.copyWith(clearRating: true),
                        ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: FeatureAsyncBody<List<SipaluCard>>(
                value: value,
                onRetry: () => ref.invalidate(bolauSearchProvider(_query)),
                data:
                    (list) =>
                        list.isEmpty
                            ? ListView(
                              children: [
                                EmptyState(
                                  icon: LucideIcons.searchX,
                                  message: l.blNoSipaluFound,
                                  art: KsArt.cookKitchen,
                                  action: OutlinedButton.icon(
                                    onPressed: () => context.push(Routes.gharRequestNew),
                                    icon: const Icon(LucideIcons.megaphone, size: 18),
                                    label: Text(l.blPostRequest),
                                  ),
                                ),
                              ],
                            )
                            : ListView.separated(
                              padding: const EdgeInsets.fromLTRB(KsSpace.page, 0, KsSpace.page, KsSpace.page),
                              itemCount: list.length,
                              separatorBuilder: (_, _) => const SizedBox(height: KsSpace.s2),
                              itemBuilder:
                                  (_, i) => SipaluCardTile(
                                    card: list[i],
                                    onTap: () => context.push(Routes.gharSipalu(list[i].handle)),
                                  ),
                            ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
