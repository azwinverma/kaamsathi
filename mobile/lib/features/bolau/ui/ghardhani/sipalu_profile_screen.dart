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
import '../../../../core/widgets/signature/signature.dart';
import '../../../worker/credentials/ui/credentials_screen.dart' show nstbLabel;
import '../../../worker/profile/ui/languages_screen.dart' show spokenLanguageName;
import '../../bolau_models.dart';
import '../../bolau_repository.dart';
import '../bolau_widgets.dart';
import '../sipalu/sipalu_editors.dart' show apiWeekdayName, weekdayDisplayOrder;

/// A Sipalu's public profile (never phone, address, ID or location).
class SipaluProfileScreen extends ConsumerStatefulWidget {
  const SipaluProfileScreen({super.key, required this.handle});
  final String handle;

  @override
  ConsumerState<SipaluProfileScreen> createState() => _SipaluProfileScreenState();
}

class _SipaluProfileScreenState extends ConsumerState<SipaluProfileScreen> {
  bool? _fav;

  Future<void> _toggleFav(bool now) async {
    final l = context.l10n;
    setState(() => _fav = !now);
    try {
      final repo = ref.read(bolauRepositoryProvider);
      now ? await repo.removeFavourite(widget.handle) : await repo.addFavourite(widget.handle);
      ref.invalidate(favouritesProvider);
      if (mounted) showSnack(context, now ? l.blFavRemoved : l.blFavAdded);
    } catch (e) {
      if (!mounted) return;
      setState(() => _fav = now);
      showSnack(context, errorText(context, e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final value = ref.watch(publicSipaluProvider(widget.handle));
    final favs = ref.watch(favouritesProvider).value;
    final isFav = _fav ?? (favs?.any((f) => f.handle == widget.handle) ?? false);
    return Scaffold(
      appBar: AppBar(
        title: Text(value.value?.displayName(context.lang) ?? l.blModeSipalu),
        actions: [
          IconButton(
            key: const Key('fav_toggle'),
            tooltip: isFav ? l.blFavRemove : l.blFavAdd,
            onPressed: () => _toggleFav(isFav),
            icon: Icon(LucideIcons.heart, fill: isFav ? 1 : 0, color: isFav ? context.ks.coral : null),
          ),
        ],
      ),
      body: FeatureAsyncBody<PublicSipalu>(
        value: value,
        onRetry: () => ref.invalidate(publicSipaluProvider(widget.handle)),
        data: (p) => _Body(p: p),
      ),
      bottomNavigationBar:
          value.hasValue
              ? SafeArea(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(KsSpace.page, KsSpace.s2, KsSpace.page, KsSpace.s2),
                  child: FilledButton.icon(
                    key: const Key('book_sipalu'),
                    onPressed: () => context.push(Routes.gharBook(widget.handle)),
                    icon: const Icon(LucideIcons.calendarPlus),
                    label: Text(l.blBookName(value.requireValue.displayName(context.lang))),
                  ),
                ),
              )
              : null,
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.p});
  final PublicSipalu p;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final c = context.ks;
    final headline = p.headlineFor(lang);
    final bio = p.bioFor(lang);
    return ListView(
      padding: const EdgeInsets.all(KsSpace.page),
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CutPaperFrame(
              width: 96,
              tapeColor: c.yellow,
              child: WorkerPhoto(name: p.name, url: p.photoUrl, missingLabel: l.passportPhotoMissing),
            ),
            const SizedBox(width: KsSpace.s4),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(p.displayName(lang), style: t.titleLarge),
                  if (headline != null) Text(headline, style: t.bodyLarge),
                  const SizedBox(height: KsSpace.s1),
                  RatingLine(avg: p.ratingAvg, count: p.ratingCount, jobs: p.jobsCompleted),
                  if (p.responseTimeMinutes != null)
                    Text(
                      l.blRepliesIn(localizeDigits('${p.responseTimeMinutes}', lang)),
                      style: t.bodySmall?.copyWith(color: c.textMuted),
                    ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: KsSpace.s3),
        Wrap(
          spacing: KsSpace.s2,
          runSpacing: KsSpace.s1,
          children: [
            if (p.verificationLevel >= 1)
              StatusBadge(label: l.blIdVerified, tone: Tone.verified, icon: LucideIcons.badgeCheck),
            if (p.instantBooking) StatusBadge(label: l.blInstant, tone: Tone.info, icon: LucideIcons.zap),
            for (final b in p.verifiedBadges) StatusBadge(label: b, tone: Tone.verified),
          ],
        ),
        const SizedBox(height: KsSpace.s3),
        SectionCard(title: l.blVerification, child: VerificationLadder(level: p.verificationLevel)),
        const SizedBox(height: KsSpace.s3),
        SectionCard(
          title: l.blStepServices,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (p.services.isEmpty) Text(l.blNoServicesListed),
              for (final s in p.services)
                ListTile(
                  key: Key('svc_${s.id}'),
                  contentPadding: EdgeInsets.zero,
                  title: Text(s.name(lang)),
                  subtitle: Text(
                    [
                      priceText(l, lang, priceType: s.priceType, price: s.price, visitFee: s.visitFee),
                      if (s.estimatedMinutes != null) l.blAboutMinutes(localizeDigits('${s.estimatedMinutes}', lang)),
                    ].join(' · '),
                  ),
                  trailing: TextButton(
                    onPressed: () => context.push(Routes.gharBook(p.handle, serviceId: s.id)),
                    child: Text(l.blBook),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: KsSpace.s3),
        SectionCard(
          title: l.blSkillsAndAreas,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final s in p.trades)
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text(
                    [
                      s.trade.name(lang),
                      if (s.years > 0) l.blYearsN(localizeDigits('${s.years.round()}', lang)),
                      if (nstbLabel(l, s.nstbLevel, lang).isNotEmpty) nstbLabel(l, s.nstbLevel, lang),
                    ].join(' · '),
                    style: t.bodyLarge,
                  ),
                ),
              if (p.serviceDistricts.isNotEmpty) ...[
                const SizedBox(height: KsSpace.s1),
                Text(l.blWorksIn(p.serviceDistricts.map((d) => d.name(lang)).join(', ')), style: t.bodyMedium),
              ],
              if (p.languages.isNotEmpty)
                Text(l.blSpeaks(p.languages.map((c) => spokenLanguageName(l, c)).join(', ')), style: t.bodyMedium),
            ],
          ),
        ),
        const SizedBox(height: KsSpace.s3),
        SectionCard(
          title: l.blUsualHours,
          child:
              p.availabilityRules.isEmpty
                  ? Text(p.availabilityText ?? l.blAskInBooking)
                  : Column(
                    children: [
                      for (final d in weekdayDisplayOrder)
                        KeyValueRow(
                          label: apiWeekdayName(d, lang),
                          value: () {
                            final rs = p.availabilityRules.where((r) => r.weekday == d).toList();
                            if (rs.isEmpty) return l.blDayOff;
                            return rs
                                .map((r) => '${formatClock(r.start, lang)}–${formatClock(r.end, lang)}')
                                .join(', ');
                          }(),
                        ),
                    ],
                  ),
        ),
        if (bio != null && bio.isNotEmpty) ...[
          const SizedBox(height: KsSpace.s3),
          SectionCard(title: l.blAbout, child: Text(bio, style: t.bodyLarge)),
        ],
        const SizedBox(height: KsSpace.s3),
        SectionCard(
          title: l.blReviews,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (p.reviews.isEmpty) Text(l.blNoReviews),
              for (final r in p.reviews)
                Padding(
                  padding: const EdgeInsets.only(bottom: KsSpace.s2),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          for (var i = 1; i <= 5; i++)
                            Icon(
                              LucideIcons.star,
                              size: 14,
                              color: i <= r.score ? c.ratingStar : c.border,
                              fill: i <= r.score ? 1 : 0,
                            ),
                          const SizedBox(width: KsSpace.s2),
                          Text(
                            [
                              if (r.by != null) r.by!,
                              if (r.monthBs != null) formatBsMonthFromIso(r.monthBs!, lang),
                            ].join(' · '),
                            style: t.bodySmall?.copyWith(color: c.textMuted),
                          ),
                        ],
                      ),
                      if (r.comment?.isNotEmpty ?? false) Text(r.comment!, style: t.bodyMedium),
                    ],
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: KsSpace.s3),
        InfoNote(icon: LucideIcons.lock, text: l.blProfilePrivacy),
      ],
    );
  }
}

/// `2083-06` → `Ashwin 2083`; anything else is returned as-is.
String formatBsMonthFromIso(String s, String lang) {
  final m = RegExp(r'^(\d{4})-(\d{1,2})').firstMatch(s);
  if (m == null) return s;
  return formatBsMonthYear(int.parse(m.group(1)!), int.parse(m.group(2)!), lang);
}
