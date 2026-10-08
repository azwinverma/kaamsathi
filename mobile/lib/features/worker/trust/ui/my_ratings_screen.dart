import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/eco.dart';
import '../trust_data.dart';

/// "My ratings": averages + each rating from employers (received) and by me
/// (given). Never names a person — only the organization, when sent.
class MyRatingsScreen extends ConsumerWidget {
  const MyRatingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final value = ref.watch(myRatingsProvider);
    Future<void> refresh() async {
      ref.invalidate(myRatingsProvider);
      try {
        await ref.read(myRatingsProvider.future);
      } catch (_) {}
    }

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: Text(l.ratingsTitle),
          bottom: TabBar(tabs: [Tab(text: l.ratingsReceived), Tab(text: l.ratingsGiven)]),
        ),
        body: TabBarView(
          children: [
            for (final received in [true, false])
              RefreshIndicator(
                onRefresh: refresh,
                child: FeatureAsyncBody<MyRatings>(
                  value: value,
                  onRetry: () => ref.invalidate(myRatingsProvider),
                  data: (r) => _List(items: received ? r.received : r.given, received: received),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _List extends ConsumerStatefulWidget {
  const _List({required this.items, required this.received});
  final List<RatingItem> items;
  final bool received;

  @override
  ConsumerState<_List> createState() => _ListState();
}

class _ListState extends ConsumerState<_List> {
  final Set<String> _flagged = {};

  Future<void> _flag(RatingItem r) async {
    final l = context.l10n;
    final reason = await showDialog<String>(context: context, builder: (_) => const _FlagDialog());
    if (reason == null || !mounted) return;
    try {
      await ref.read(trustRepositoryProvider).flagRating(r.id, reason);
      if (!mounted) return;
      setState(() => _flagged.add(r.id));
      showSnack(context, l.ratingsFlagged);
    } catch (e) {
      if (mounted) showSnack(context, errorText(context, e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final received = widget.received;
    final items = [for (final r in widget.items) _flagged.contains(r.id) ? r.flagged() : r];
    final avg = ratingAverages(items);
    final labelA = received ? l.ratingsReliability : l.ratePayOnTime;
    final labelB = received ? l.ratingsSkill : l.rateConditions;
    String n(double v) => localizeDigits(v.toStringAsFixed(1), lang);
    return ListView(
      padding: const EdgeInsets.all(KsSpace.page),
      children: [
        if (items.isEmpty)
          EmptyState(icon: LucideIcons.star, message: received ? l.ratingsEmptyReceived : l.ratingsEmptyGiven),
        if (avg != null)
          SectionCard(
            key: Key(received ? 'ratings_avg_received' : 'ratings_avg_given'),
            title: l.ratingsAverage(n((avg.a + avg.b) / 2), localizeDigits('${avg.count}', lang)),
            child: Column(
              children: [
                FractionBar(label: labelA, value: avg.a / 5, trailing: '${n(avg.a)} / ${localizeDigits('5', lang)}'),
                FractionBar(label: labelB, value: avg.b / 5, trailing: '${n(avg.b)} / ${localizeDigits('5', lang)}'),
              ],
            ),
          ),
        for (final r in items) ...[
          const SizedBox(height: KsSpace.s3),
          Card(
            key: Key('rating_${r.id}'),
            child: Padding(
              padding: const EdgeInsets.all(KsSpace.s4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          r.organization?.name ?? '',
                          style: t.titleSmall,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (r.createdAt != null) Text(formatBsDateTime(r.createdAt, lang), style: t.bodySmall),
                    ],
                  ),
                  const SizedBox(height: KsSpace.s2),
                  _Stars(label: labelA, value: r.scoreA),
                  _Stars(label: labelB, value: r.scoreB),
                  if (r.comment?.isNotEmpty ?? false) ...[
                    const SizedBox(height: KsSpace.s2),
                    Text('“${r.comment!}”', style: t.bodyMedium),
                  ],
                  if (r.commentStatus != 'visible' || r.voided) ...[
                    const SizedBox(height: KsSpace.s2),
                    Wrap(
                      spacing: KsSpace.s2,
                      runSpacing: KsSpace.s1,
                      children: [
                        if (r.commentStatus == 'flagged')
                          StatusBadge(label: l.ratingsStatusFlagged, tone: Tone.warning, icon: LucideIcons.flag),
                        if (r.commentStatus == 'hidden')
                          StatusBadge(label: l.ratingsStatusHidden, tone: Tone.neutral, icon: LucideIcons.eyeOff),
                        if (r.voided) StatusBadge(label: l.ratingsVoided, tone: Tone.neutral),
                      ],
                    ),
                  ],
                  if (received && r.canFlag && r.commentStatus == 'visible')
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton.icon(
                        key: Key('flag_${r.id}'),
                        onPressed: () => _flag(r),
                        icon: const Icon(LucideIcons.flag, size: 18),
                        label: Text(l.ratingsFlag),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _Stars extends StatelessWidget {
  const _Stars({required this.label, required this.value});
  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    final c = context.ks;
    return Semantics(
      label: '$label $value / 5',
      excludeSemantics: true,
      child: Row(
        children: [
          Expanded(child: Text(label, style: Theme.of(context).textTheme.bodySmall)),
          for (var i = 1; i <= 5; i++)
            Icon(LucideIcons.star, size: 16, color: i <= value ? c.ratingStar : c.border, fill: i <= value ? 1 : 0),
        ],
      ),
    );
  }
}

class _FlagDialog extends StatefulWidget {
  const _FlagDialog();

  @override
  State<_FlagDialog> createState() => _FlagDialogState();
}

class _FlagDialogState extends State<_FlagDialog> {
  final _c = TextEditingController();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return AlertDialog(
      title: Text(l.ratingsFlagTitle),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l.ratingsFlagHint),
            const SizedBox(height: KsSpace.s3),
            TextField(
              key: const Key('flag_reason'),
              controller: _c,
              maxLength: 500,
              maxLines: 4,
              minLines: 2,
              decoration: InputDecoration(labelText: l.ratingsFlagReason),
              onChanged: (_) => setState(() {}),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: Text(l.commonCancel)),
        FilledButton(
          key: const Key('flag_confirm'),
          onPressed: _c.text.trim().isEmpty ? null : () => Navigator.pop(context, _c.text.trim()),
          child: Text(l.ecoSubmit),
        ),
      ],
    );
  }
}
