import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/router/router.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/eco.dart';
import '../../../../core/widgets/photo_picker.dart';
import '../../../common/ref_data.dart';
import '../../bolau_models.dart';
import '../../bolau_repository.dart';

/// The Sipalu's work photos: a grid editor (add up to [PortfolioItem.max],
/// caption en/ne, trade, delete). Photos are downscaled + compressed by
/// [photoPickProvider] before upload. The API keeps upload order (no
/// reordering endpoint).
class SipaluPortfolioScreen extends ConsumerStatefulWidget {
  const SipaluPortfolioScreen({super.key});

  @override
  ConsumerState<SipaluPortfolioScreen> createState() => _SipaluPortfolioScreenState();
}

class _SipaluPortfolioScreenState extends ConsumerState<SipaluPortfolioScreen> {
  bool _busy = false;

  void _refresh() {
    ref.invalidate(portfolioProvider);
    ref.invalidate(mySipaluProvider);
  }

  Future<void> _run(Future<void> Function() fn, String done) async {
    setState(() => _busy = true);
    try {
      await fn();
      _refresh();
      if (mounted) showSnack(context, done);
    } catch (e) {
      if (mounted) showSnack(context, errorText(context, e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _add() async {
    final l = context.l10n;
    final d = await showPortfolioSheet(context);
    if (d == null || d.path == null) return;
    await _run(
      () => ref
          .read(bolauRepositoryProvider)
          .addPortfolio(d.path!, caption: d.caption, captionNe: d.captionNe, trade: d.trade),
      l.blPortfolioSaved,
    );
  }

  Future<void> _edit(PortfolioItem item) async {
    final l = context.l10n;
    final d = await showPortfolioSheet(context, item: item);
    if (d == null || !mounted) return;
    final repo = ref.read(bolauRepositoryProvider);
    if (d.delete) {
      final ok = await confirmDialog(
        context,
        title: l.blPortfolioDelete,
        body: l.blPortfolioDeleteBody,
        confirmLabel: l.blPortfolioDelete,
        danger: true,
      );
      if (ok) await _run(() => repo.deletePortfolio(item.id), l.blPortfolioDeleted);
      return;
    }
    await _run(
      () => repo.updatePortfolio(item.id, caption: d.caption, captionNe: d.captionNe, trade: d.trade),
      l.blPortfolioSaved,
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final value = ref.watch(portfolioProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.blPortfolio)),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(portfolioProvider);
          try {
            await ref.read(portfolioProvider.future);
          } catch (_) {}
        },
        child: FeatureAsyncBody<List<PortfolioItem>>(
          value: value,
          onRetry: () => ref.invalidate(portfolioProvider),
          data: _grid,
        ),
      ),
    );
  }

  Widget _grid(List<PortfolioItem> items) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final full = items.length >= PortfolioItem.max;
    final max = localizeDigits('${PortfolioItem.max}', lang);
    return ListView(
      padding: const EdgeInsets.all(KsSpace.page),
      children: [
        InfoNote(icon: LucideIcons.eye, text: l.blPortfolioPublic),
        const SizedBox(height: KsSpace.s3),
        Text(
          l.blPortfolioCount(localizeDigits('${items.length}', lang), max),
          key: const Key('portfolio_count'),
          style: t.titleSmall,
        ),
        const SizedBox(height: KsSpace.s2),
        if (items.isEmpty) ...[Text(l.blPortfolioEmpty, style: t.bodyMedium), const SizedBox(height: KsSpace.s2)],
        GridView.count(
          crossAxisCount: 3,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: KsSpace.s2,
          crossAxisSpacing: KsSpace.s2,
          children: [
            for (final i in items)
              PortfolioThumb(
                key: Key('portfolio_${i.id}'),
                item: i,
                onTap: _busy ? null : () => _edit(i),
                editable: true,
              ),
            if (!full)
              Material(
                color: context.ks.surfaceMuted,
                borderRadius: BorderRadius.circular(KsRadius.dense),
                child: InkWell(
                  key: const Key('portfolio_add'),
                  borderRadius: BorderRadius.circular(KsRadius.dense),
                  onTap: _busy ? null : _add,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      _busy
                          ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(LucideIcons.imagePlus),
                      const SizedBox(height: KsSpace.s1),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        child: Text(
                          l.blPortfolioAdd,
                          textAlign: TextAlign.center,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: t.labelMedium,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
        if (full) ...[
          const SizedBox(height: KsSpace.s3),
          InfoNote(key: const Key('portfolio_full'), tone: Tone.warning, text: l.blPortfolioFull(max)),
        ],
      ],
    );
  }
}

/// A square work-photo thumbnail (signed URL), with its caption for screen
/// readers.
class PortfolioThumb extends StatelessWidget {
  const PortfolioThumb({super.key, required this.item, this.onTap, this.size, this.editable = false});
  final PortfolioItem item;
  final VoidCallback? onTap;
  final double? size;
  final bool editable;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final caption = item.captionFor(context.lang);
    final placeholder = Container(
      color: context.ks.surfaceMuted,
      alignment: Alignment.center,
      child: const Icon(LucideIcons.image),
    );
    final url = item.thumb;
    return Semantics(
      button: onTap != null,
      label: caption == null ? l.blPortfolioPhoto : l.blPortfolioPhotoAlt(caption),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(KsRadius.dense),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(KsRadius.dense),
          child: SizedBox(
            width: size,
            height: size,
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (url == null || url.isEmpty)
                  placeholder
                else
                  CachedNetworkImage(
                    imageUrl: url,
                    fit: BoxFit.cover,
                    placeholder: (_, _) => placeholder,
                    errorWidget: (_, _, _) => placeholder,
                  ),
                if (editable)
                  const Positioned(
                    right: 4,
                    top: 4,
                    child: CircleAvatar(radius: 12, child: Icon(LucideIcons.pencil, size: 14)),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Read-only strip of work photos (public profile, own preview); tap to
/// see a photo large with its caption.
class PortfolioStrip extends StatelessWidget {
  const PortfolioStrip({super.key, required this.items});
  final List<PortfolioItem> items;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      key: const Key('portfolio_strip'),
      height: 96,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: items.length,
        separatorBuilder: (_, _) => const SizedBox(width: KsSpace.s2),
        itemBuilder:
            (context, i) =>
                PortfolioThumb(item: items[i], size: 96, onTap: () => showPortfolioPhoto(context, items[i])),
      ),
    );
  }
}

Future<void> showPortfolioPhoto(BuildContext context, PortfolioItem item) => showDialog<void>(
  context: context,
  builder: (ctx) {
    final caption = item.captionFor(ctx.lang);
    final url = item.full;
    return Dialog(
      clipBehavior: Clip.antiAlias,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (url != null && url.isNotEmpty)
            CachedNetworkImage(
              imageUrl: url,
              fit: BoxFit.contain,
              errorWidget: (_, _, _) => const SizedBox(height: 160, child: Icon(LucideIcons.image)),
            ),
          if (caption != null || item.trade != null)
            Padding(
              padding: const EdgeInsets.all(KsSpace.s3),
              child: Text(
                [if (caption != null) caption, if (item.trade != null) item.trade!.name(ctx.lang)].join(' · '),
                style: Theme.of(ctx).textTheme.bodyMedium,
              ),
            ),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(onPressed: () => Navigator.pop(ctx), child: Text(ctx.l10n.commonClose)),
          ),
        ],
      ),
    );
  },
);

/// Result of [showPortfolioSheet].
class PortfolioDraft {
  const PortfolioDraft({this.path, this.caption, this.captionNe, this.trade, this.delete = false});
  final String? path;
  final String? caption;
  final String? captionNe;
  final String? trade;
  final bool delete;
}

/// Add (photo + details) or edit (details, or delete) a work photo.
Future<PortfolioDraft?> showPortfolioSheet(BuildContext context, {PortfolioItem? item}) =>
    showModalBottomSheet<PortfolioDraft>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _PortfolioSheet(item: item),
    );

class _PortfolioSheet extends ConsumerStatefulWidget {
  const _PortfolioSheet({this.item});
  final PortfolioItem? item;

  @override
  ConsumerState<_PortfolioSheet> createState() => _PortfolioSheetState();
}

class _PortfolioSheetState extends ConsumerState<_PortfolioSheet> {
  String? _path;
  late final _caption = TextEditingController(text: widget.item?.caption ?? '');
  late final _captionNe = TextEditingController(text: widget.item?.captionNe ?? '');
  late String? _trade = widget.item?.trade?.code;

  @override
  void dispose() {
    _caption.dispose();
    _captionNe.dispose();
    super.dispose();
  }

  bool get _editing => widget.item != null;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final trades = ref.watch(tradesProvider).value ?? const <Trade>[];
    final known = {for (final t in trades) t.code};
    final current = widget.item?.trade;
    final options = [...trades, if (current != null && !known.contains(current.code)) current];
    return Padding(
      padding: EdgeInsets.only(
        left: KsSpace.page,
        right: KsSpace.page,
        top: KsSpace.page,
        bottom: MediaQuery.viewInsetsOf(context).bottom + KsSpace.page,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(_editing ? l.blPortfolioEdit : l.blPortfolioAdd, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: KsSpace.s3),
            if (_editing)
              Center(child: PortfolioThumb(item: widget.item!, size: 120))
            else
              DocumentPhotoPicker(
                label: l.blPortfolioPhoto,
                path: _path,
                onChanged: (p) => setState(() => _path = p),
                maxBytes: PortfolioItem.maxBytes,
                tooBigMessage: l.blPortfolioTooBig,
              ),
            const SizedBox(height: KsSpace.s3),
            TextField(
              key: const Key('portfolio_caption'),
              controller: _caption,
              maxLength: 200,
              decoration: InputDecoration(labelText: l.ecoOptional(l.blPortfolioCaption)),
            ),
            TextField(
              key: const Key('portfolio_caption_ne'),
              controller: _captionNe,
              maxLength: 200,
              decoration: InputDecoration(labelText: l.ecoOptional(l.blPortfolioCaptionNe)),
            ),
            DropdownButtonFormField<String?>(
              key: const Key('portfolio_trade'),
              value: _trade,
              isExpanded: true,
              decoration: InputDecoration(labelText: l.blPortfolioTrade),
              items: [
                DropdownMenuItem<String?>(value: null, child: Text(l.blPortfolioAnyTrade)),
                for (final t in options)
                  DropdownMenuItem<String?>(value: t.code, child: Text(t.name(lang), overflow: TextOverflow.ellipsis)),
              ],
              onChanged: (v) => setState(() => _trade = v),
            ),
            const SizedBox(height: KsSpace.s4),
            FilledButton(
              key: const Key('portfolio_save'),
              onPressed:
                  !_editing && _path == null
                      ? null
                      : () => Navigator.pop(
                        context,
                        PortfolioDraft(path: _path, caption: _caption.text, captionNe: _captionNe.text, trade: _trade),
                      ),
              child: Text(_editing ? l.commonSave : l.blPortfolioAdd),
            ),
            if (_editing) ...[
              const SizedBox(height: KsSpace.s2),
              OutlinedButton.icon(
                key: const Key('portfolio_delete'),
                style: OutlinedButton.styleFrom(foregroundColor: context.ks.errorText),
                onPressed: () => Navigator.pop(context, const PortfolioDraft(delete: true)),
                icon: const Icon(LucideIcons.trash2),
                label: Text(l.blPortfolioDelete),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Bolau tab: the Sipalu's own work photos as the public sees them, with a
/// way into the editor.
class PortfolioPreviewCard extends StatelessWidget {
  const PortfolioPreviewCard({super.key, required this.items});
  final List<PortfolioItem> items;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    return SectionCard(
      key: const Key('portfolio_preview'),
      title: l.blPortfolio,
      trailing: Text(
        l.blPortfolioCount(localizeDigits('${items.length}', lang), localizeDigits('${PortfolioItem.max}', lang)),
        style: Theme.of(context).textTheme.bodySmall,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (items.isEmpty) Text(l.blPortfolioEmpty) else PortfolioStrip(items: items),
          const SizedBox(height: KsSpace.s2),
          OutlinedButton.icon(
            key: const Key('portfolio_manage'),
            onPressed: () => context.push(Routes.sipaluPortfolio),
            icon: const Icon(LucideIcons.images),
            label: Text(l.blPortfolioManage),
          ),
        ],
      ),
    );
  }
}
