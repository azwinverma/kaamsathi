import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/json.dart';
import '../../../core/auth/session.dart';
import '../../../core/l10n/l10n.dart';
import '../../../core/providers.dart';
import '../../../core/router/router.dart';
import '../../../core/theme/tokens.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/eco.dart';
import '../../../core/widgets/simple_markdown.dart';

/// `GET /help/articles` item / `GET /help/articles/{slug}`.
class HelpArticle {
  const HelpArticle({
    required this.slug,
    required this.titleEn,
    this.titleNe,
    this.summaryEn,
    this.summaryNe,
    this.bodyEn,
    this.bodyNe,
    this.category,
  });

  final String slug;
  final String titleEn;
  final String? titleNe;
  final String? summaryEn;
  final String? summaryNe;
  final String? bodyEn;
  final String? bodyNe;
  final String? category;

  static String? _pick(String lang, String? en, String? ne) =>
      lang == 'ne' && (ne?.trim().isNotEmpty ?? false) ? ne : en;

  String title(String lang) => _pick(lang, titleEn, titleNe) ?? titleEn;
  String? summary(String lang) => _pick(lang, summaryEn, summaryNe);
  String body(String lang) => _pick(lang, bodyEn, bodyNe) ?? '';

  factory HelpArticle.fromJson(Json j) => HelpArticle(
    slug: strOr(j['slug'] ?? j['id']),
    titleEn: strOr(j['title_en'] ?? j['title']),
    titleNe: str(j['title_ne']),
    summaryEn: str(j['summary_en'] ?? j['summary']),
    summaryNe: str(j['summary_ne']),
    bodyEn: str(j['body_en'] ?? j['body']),
    bodyNe: str(j['body_ne']),
    // Only a human label — raw category codes are never shown.
    category: str(j['category_label']),
  );
}

/// Supervisors are on the employer side of the help center.
String helpAudience(AppMode? mode) => mode == AppMode.supervisor ? 'employer' : 'worker';

final helpArticlesProvider = FutureProvider.autoDispose.family<List<HelpArticle>, String>((ref, q) async {
  final mode = ref.watch(sessionProvider.select((s) => s.mode));
  final data = await ref
      .watch(apiClientProvider)
      .get<dynamic>('/help/articles', query: {'audience': helpAudience(mode), 'q': q.trim(), 'page_size': 50});
  return resultsOf(data).map(HelpArticle.fromJson).where((a) => a.slug.isNotEmpty).toList();
});

final helpArticleProvider = FutureProvider.autoDispose.family<HelpArticle, String>((ref, slug) async {
  final data = await ref.watch(apiClientProvider).get<dynamic>('/help/articles/$slug');
  return HelpArticle.fromJson(asJson(data));
});

class HelpCenterScreen extends ConsumerStatefulWidget {
  const HelpCenterScreen({super.key});

  @override
  ConsumerState<HelpCenterScreen> createState() => _HelpCenterScreenState();
}

class _HelpCenterScreenState extends ConsumerState<HelpCenterScreen> {
  String _q = '';
  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final value = ref.watch(helpArticlesProvider(_q));
    return Scaffold(
      appBar: AppBar(title: Text(l.helpCenterTitle)),
      body: ListView(
        padding: const EdgeInsets.all(KsSpace.page),
        children: [
          TextField(
            key: const Key('help_search'),
            controller: _search,
            textInputAction: TextInputAction.search,
            onSubmitted: (v) => setState(() => _q = v.trim()),
            decoration: InputDecoration(
              hintText: l.helpSearch,
              prefixIcon: const Icon(LucideIcons.search),
              suffixIcon: IconButton(
                tooltip: l.helpSearch,
                icon: const Icon(LucideIcons.arrowRight),
                onPressed: () => setState(() => _q = _search.text.trim()),
              ),
            ),
          ),
          const SizedBox(height: KsSpace.s3),
          FeatureAsyncSection<List<HelpArticle>>(
            value: value,
            onRetry: () => ref.invalidate(helpArticlesProvider(_q)),
            data:
                (items) => Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (items.isEmpty) EmptyState(icon: LucideIcons.bookOpen, message: l.helpEmpty),
                    for (final a in items)
                      Card(
                        key: Key('article_${a.slug}'),
                        child: ListTile(
                          leading: const Icon(LucideIcons.bookOpen),
                          title: Text(a.title(lang)),
                          subtitle:
                              (a.summary(lang) ?? a.category) == null
                                  ? null
                                  : Text(a.summary(lang) ?? a.category!, maxLines: 2, overflow: TextOverflow.ellipsis),
                          trailing: const Icon(LucideIcons.chevronRight),
                          onTap: () => context.push(Routes.helpArticle(a.slug)),
                        ),
                      ),
                  ],
                ),
          ),
          const SizedBox(height: KsSpace.s4),
          Text(l.helpStillNeed, style: t.bodyMedium, textAlign: TextAlign.center),
          const SizedBox(height: KsSpace.s2),
          OutlinedButton.icon(
            onPressed: () => context.push(Routes.helpNew),
            icon: const Icon(LucideIcons.messageSquarePlus),
            label: Text(l.supportNew),
          ),
        ],
      ),
    );
  }
}

class HelpArticleScreen extends ConsumerWidget {
  const HelpArticleScreen({super.key, required this.slug});
  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lang = context.lang;
    final value = ref.watch(helpArticleProvider(slug));
    return Scaffold(
      appBar: AppBar(title: Text(value.value?.title(lang) ?? context.l10n.helpCenterTitle)),
      body: FeatureAsyncBody<HelpArticle>(
        value: value,
        onRetry: () => ref.invalidate(helpArticleProvider(slug)),
        data:
            (a) => ListView(
              padding: const EdgeInsets.all(KsSpace.page),
              children: [
                Text(a.title(lang), style: Theme.of(context).textTheme.headlineSmall),
                const SizedBox(height: KsSpace.s3),
                SimpleMarkdown(a.body(lang)),
              ],
            ),
      ),
    );
  }
}
