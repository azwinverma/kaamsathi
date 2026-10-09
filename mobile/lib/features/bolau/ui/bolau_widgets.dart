import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/format.dart';
import '../../../core/l10n/l10n.dart';
import '../../../core/router/router.dart';
import '../../../core/theme/tokens.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/eco.dart';
import '../../../core/widgets/signature/signature.dart';
import '../../common/support/safety_report_screen.dart';
import '../../worker/trust/trust_data.dart' show Dispute, disputesProvider;
import '../bolau_logic.dart';
import '../bolau_models.dart';
import '../bolau_repository.dart';

String bookingStatusLabel(AppLocalizations l, String status) => switch (status) {
  BookingStatus.requested => l.blStatusRequested,
  BookingStatus.accepted => l.blStatusAccepted,
  BookingStatus.declined => l.blStatusDeclined,
  BookingStatus.expired => l.blStatusExpired,
  BookingStatus.onTheWay => l.blStatusOnTheWay,
  BookingStatus.arrived => l.blStatusArrived,
  BookingStatus.inProgress => l.blStatusInProgress,
  BookingStatus.completed => l.blStatusCompleted,
  BookingStatus.confirmed => l.blStatusConfirmed,
  BookingStatus.cancelled => l.blStatusCancelled,
  BookingStatus.noShow => l.blStatusNoShow,
  BookingStatus.disputed => l.blStatusDisputed,
  _ => status,
};

Tone bookingStatusTone(String status) => switch (status) {
  BookingStatus.requested => Tone.warning,
  BookingStatus.accepted || BookingStatus.onTheWay || BookingStatus.arrived || BookingStatus.inProgress => Tone.info,
  BookingStatus.completed || BookingStatus.confirmed => Tone.success,
  BookingStatus.noShow || BookingStatus.disputed => Tone.danger,
  _ => Tone.neutral,
};

IconData bookingStatusIcon(String status) => switch (status) {
  BookingStatus.requested => LucideIcons.hourglass,
  BookingStatus.accepted => LucideIcons.calendarCheck,
  BookingStatus.onTheWay => LucideIcons.bike,
  BookingStatus.arrived => LucideIcons.doorOpen,
  BookingStatus.inProgress => LucideIcons.wrench,
  BookingStatus.completed || BookingStatus.confirmed => LucideIcons.circleCheck,
  BookingStatus.noShow || BookingStatus.disputed => LucideIcons.circleAlert,
  _ => LucideIcons.circleX,
};

class BookingStatusBadge extends StatelessWidget {
  const BookingStatusBadge({super.key, required this.status});
  final String status;

  @override
  Widget build(BuildContext context) => StatusBadge(
    label: bookingStatusLabel(context.l10n, status),
    tone: bookingStatusTone(status),
    icon: bookingStatusIcon(status),
  );
}

String priceTypeLabel(AppLocalizations l, String type) => switch (type) {
  PriceType.hourly => l.blPriceHourly,
  PriceType.visitThenQuote => l.blPriceVisitQuote,
  _ => l.blPriceFixed,
};

/// "Rs 600 fixed" · "Rs 300 an hour" · "Visit Rs 200, then a quote".
String priceText(AppLocalizations l, String lang, {required String priceType, String? price, String? visitFee}) {
  String m(String? v) => formatMoney(v, lang: lang);
  return switch (priceType) {
    PriceType.hourly => l.blPerHour(m(price)),
    PriceType.visitThenQuote => l.blVisitThenQuote(m(visitFee)),
    _ => l.blFixedPrice(m(price)),
  };
}

/// `Sun, 21 Ashwin 2083 · 9:00 AM`.
String whenText(DateTime? t, String lang) {
  if (t == null) return '';
  final npt = t.isUtc ? t.add(const Duration(hours: 5, minutes: 45)) : t;
  return '${weekdayName(npt, lang, short: true)}, ${formatBsDateTime(t, lang)} · ${formatTime(t, lang)}';
}

/// Average + count, e.g. "★ 4.8 (23)"; "New" with no ratings yet.
class RatingLine extends StatelessWidget {
  const RatingLine({super.key, required this.avg, required this.count, this.jobs});
  final double? avg;
  final int count;
  final int? jobs;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final parts = <String>[
      if (count > 0 && avg != null)
        '${formatNumber(avg!, lang: lang)} (${localizeDigits('$count', lang)})'
      else
        l.blNewOnBolau,
      if (jobs != null && jobs! > 0) l.blJobsDone(localizeDigits('$jobs', lang)),
    ];
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (count > 0) ...[
          ExcludeSemantics(child: Icon(LucideIcons.star, size: 16, color: context.ks.ratingStar, fill: 1)),
          const SizedBox(width: 4),
        ],
        Flexible(
          child: Text(
            parts.join(' · '),
            semanticsLabel: count > 0 && avg != null ? l.blRatingA11y(formatNumber(avg!, lang: lang)) : null,
            style: t.bodyMedium?.copyWith(color: context.ks.textSecondary),
          ),
        ),
      ],
    );
  }
}

/// Search result / favourite card.
class SipaluCardTile extends StatelessWidget {
  const SipaluCardTile({super.key, required this.card, this.onTap});
  final SipaluCard card;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final c = card;
    return Card(
      key: Key('sipalu_${c.handle}'),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(KsSpace.s3),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CutPaperFrame(
                width: 64,
                tapeColor: context.ks.teal,
                child: WorkerPhoto(name: c.name, url: c.photoUrl, missingLabel: l.passportPhotoMissing),
              ),
              const SizedBox(width: KsSpace.s3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(c.name, style: t.titleMedium),
                    if (c.headline?.isNotEmpty ?? false)
                      Text(c.headline!, maxLines: 2, overflow: TextOverflow.ellipsis, style: t.bodyMedium),
                    const SizedBox(height: 2),
                    RatingLine(avg: c.ratingAvg, count: c.ratingCount, jobs: c.jobsCompleted),
                    const SizedBox(height: KsSpace.s1),
                    Wrap(
                      spacing: KsSpace.s2,
                      runSpacing: KsSpace.s1,
                      children: [
                        if (c.verificationLevel >= 1)
                          StatusBadge(label: l.blIdVerified, tone: Tone.verified, icon: LucideIcons.badgeCheck),
                        if (c.topTrade != null) StatusBadge(label: c.topTrade!.name(lang), icon: LucideIcons.hardHat),
                        if (c.instantBooking) StatusBadge(label: l.blInstant, tone: Tone.info, icon: LucideIcons.zap),
                      ],
                    ),
                    if (c.fromPrice != null || c.nextAvailable != null) ...[
                      const SizedBox(height: KsSpace.s1),
                      Text(
                        [
                          if (c.fromPrice != null) l.blFromPrice(formatMoney(c.fromPrice, lang: lang)),
                          if (c.nextAvailable != null) l.blNextFree(whenText(c.nextAvailable, lang)),
                        ].join(' · '),
                        style: t.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                          fontFeatures: const [FontFeature.tabularFigures()],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The 4-digit arrival code, large, for the Ghardhani to read out.
class ArrivalCodeDisplay extends StatelessWidget {
  const ArrivalCodeDisplay({super.key, required this.code});
  final String? code;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final c = context.ks;
    final t = Theme.of(context).textTheme;
    final digits = (code ?? '').trim();
    return Container(
      key: const Key('arrival_code'),
      padding: const EdgeInsets.all(KsSpace.s4),
      decoration: BoxDecoration(
        color: c.yellowSubtle,
        borderRadius: BorderRadius.circular(KsRadius.card),
        border: Border.all(color: c.yellow, width: 2),
      ),
      child: Column(
        children: [
          Text(l.blArrivalCode, style: t.titleSmall),
          const SizedBox(height: KsSpace.s2),
          Semantics(
            label: l.blArrivalCodeA11y(digits.split('').join(' ')),
            child: ExcludeSemantics(
              child: Text(
                digits.isEmpty ? '— — — —' : digits.split('').join(' '),
                style: t.displaySmall?.copyWith(
                  fontWeight: FontWeight.w800,
                  letterSpacing: 4,
                  color: c.onAccentFill,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
            ),
          ),
          const SizedBox(height: KsSpace.s2),
          Text(l.blArrivalCodeHint, textAlign: TextAlign.center, style: t.bodyMedium),
        ],
      ),
    );
  }
}

/// Sipalu enters the code the Ghardhani reads out. Calls [onSubmit] with
/// exactly four Latin digits.
class ArrivalCodeEntry extends StatefulWidget {
  const ArrivalCodeEntry({super.key, required this.onSubmit, this.busy = false, this.error});
  final Future<void> Function(String code) onSubmit;
  final bool busy;
  final String? error;

  @override
  State<ArrivalCodeEntry> createState() => _ArrivalCodeEntryState();
}

/// Four digits (Devanagari accepted) → Latin, else null.
String? normaliseArrivalCode(String input) {
  final s = toLatinDigits(input).replaceAll(RegExp(r'\s'), '');
  return RegExp(r'^\d{4}$').hasMatch(s) ? s : null;
}

class _ArrivalCodeEntryState extends State<ArrivalCodeEntry> {
  final _c = TextEditingController();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final code = normaliseArrivalCode(_c.text);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(l.blEnterArrivalCode, style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: KsSpace.s1),
        Text(l.blEnterArrivalCodeHint, style: Theme.of(context).textTheme.bodyMedium),
        const SizedBox(height: KsSpace.s2),
        TextField(
          key: const Key('arrival_code_input'),
          controller: _c,
          keyboardType: TextInputType.number,
          maxLength: 4,
          textAlign: TextAlign.center,
          inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9०-९]'))],
          style: Theme.of(context).textTheme.headlineMedium?.copyWith(letterSpacing: 8),
          decoration: InputDecoration(counterText: '', errorText: widget.error, hintText: '0000'),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: KsSpace.s2),
        FilledButton.icon(
          key: const Key('arrival_code_submit'),
          onPressed: code == null || widget.busy ? null : () => widget.onSubmit(code),
          icon: const Icon(LucideIcons.doorOpen),
          label: Text(l.blIHaveArrived),
        ),
      ],
    );
  }
}

/// Booking progress: the happy path with the current step highlighted, or
/// the terminal state when it went another way.
class BookingTimeline extends StatelessWidget {
  const BookingTimeline({super.key, required this.booking});
  final Booking booking;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final c = context.ks;
    final t = Theme.of(context).textTheme;
    final b = booking;
    final at = {for (final e in b.events) e.toStatus: e.at};
    if (b.isTerminal || b.status == BookingStatus.disputed) {
      return Row(
        children: [
          Icon(bookingStatusIcon(b.status), color: c.textMuted),
          const SizedBox(width: KsSpace.s2),
          Expanded(child: Text(bookingStatusLabel(l, b.status), style: t.titleSmall)),
        ],
      );
    }
    final current = bookingPathIndex(b.status);
    return Column(
      key: const Key('booking_timeline'),
      children: [
        for (var i = 0; i < BookingStatus.path.length; i++)
          Builder(
            builder: (_) {
              final s = BookingStatus.path[i];
              final done = i <= current;
              final isNow = i == current;
              return Semantics(
                label: '${bookingStatusLabel(l, s)}${isNow ? ' · ${l.blNow}' : ''}',
                excludeSemantics: true,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Column(
                      children: [
                        Container(
                          width: 18,
                          height: 18,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: done ? c.verified : c.surface,
                            border: Border.all(color: done ? c.verified : c.borderStrong, width: 2),
                          ),
                          child: done ? Icon(LucideIcons.check, size: 11, color: c.surface) : null,
                        ),
                        if (i < BookingStatus.path.length - 1)
                          Container(width: 2, height: 22, color: i < current ? c.verified : c.border),
                      ],
                    ),
                    const SizedBox(width: KsSpace.s3),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Text.rich(
                          TextSpan(
                            text: bookingStatusLabel(l, s),
                            style: isNow ? t.titleSmall : t.bodyMedium?.copyWith(color: done ? null : c.textMuted),
                            children: [
                              if (at[s] != null)
                                TextSpan(
                                  text: '  ${formatTime(at[s]!, lang)}',
                                  style: t.bodySmall?.copyWith(color: c.textMuted),
                                ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
      ],
    );
  }
}

/// "Answer within 12:34" for an incoming request; turns to "Expired".
class CountdownText extends StatefulWidget {
  const CountdownText({super.key, required this.deadline, this.now});
  final DateTime? deadline;

  /// Clock for tests.
  final DateTime Function()? now;

  @override
  State<CountdownText> createState() => _CountdownTextState();
}

class _CountdownTextState extends State<CountdownText> {
  Timer? _timer;

  DateTime get _now => widget.now?.call() ?? DateTime.now();

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      final d = widget.deadline;
      if (d == null || !_now.isBefore(d)) _timer?.cancel();
      setState(() {});
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final d = widget.deadline;
    if (d == null) return const SizedBox.shrink();
    final left = d.difference(_now);
    final c = context.ks;
    final t = Theme.of(context).textTheme;
    if (left.isNegative || left == Duration.zero) {
      return Text(l.blRequestTimeUp, style: t.labelLarge?.copyWith(color: c.errorText));
    }
    final urgent = left.inMinutes < 5;
    final String text;
    if (left.inHours >= 24) {
      text = l.blAnswerBy(whenText(d, context.lang));
    } else {
      String two(int n) => n.toString().padLeft(2, '0');
      final clock =
          left.inHours > 0
              ? '${left.inHours}:${two(left.inMinutes % 60)}:${two(left.inSeconds % 60)}'
              : '${two(left.inMinutes)}:${two(left.inSeconds % 60)}';
      text = l.blAnswerWithin(localizeDigits(clock, context.lang));
    }
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(LucideIcons.timer, size: 16, color: urgent ? c.errorText : c.warningText),
        const SizedBox(width: 4),
        Flexible(
          child: Text(
            text,
            key: const Key('countdown'),
            style: t.labelLarge?.copyWith(
              color: urgent ? c.errorText : c.warningText,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ),
      ],
    );
  }
}

/// Emergency line + confidential report entry, on every booking (rule 4).
class BolauSafetyCard extends StatelessWidget {
  const BolauSafetyCard({super.key, this.booking});
  final Booking? booking;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const DangerCallout(),
        const SizedBox(height: KsSpace.s2),
        OutlinedButton.icon(
          key: const Key('booking_report'),
          onPressed: () => context.push(Routes.safetyFor(booking: booking?.id, code: booking?.code)),
          icon: const Icon(LucideIcons.shieldAlert),
          label: Text(l.blReportProblem),
        ),
      ],
    );
  }
}

/// "Show phone" for the other party — only once accepted (rule 4).
class ContactReveal extends ConsumerStatefulWidget {
  const ContactReveal({super.key, required this.booking, required this.side});
  final Booking booking;
  final BookingSide side;

  @override
  ConsumerState<ContactReveal> createState() => _ContactRevealState();
}

class _ContactRevealState extends ConsumerState<ContactReveal> {
  BookingContact? _contact;
  bool _busy = false;

  Future<void> _load() async {
    setState(() => _busy = true);
    try {
      final c = await ref.read(bolauRepositoryProvider).contact(widget.booking.id);
      if (mounted) setState(() => _contact = c);
    } catch (e) {
      if (mounted) showSnack(context, errorText(context, e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    final t = Theme.of(context).textTheme;
    final b = widget.booking;
    final open = BookingStatus.contactOpen.contains(b.status);
    if (!open) {
      return InfoNote(key: const Key('contact_hidden'), icon: LucideIcons.lock, text: l.blContactHidden);
    }
    final c = _contact;
    // The Sipalu sees the exact address once revealed (booking payload).
    final line = widget.side == BookingSide.sipalu ? b.addressLine : null;
    final landmark = widget.side == BookingSide.sipalu && b.addressRevealed ? b.address?.landmark : null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (line != null) KeyValueRow(key: const Key('contact_address'), label: l.blAddress, value: line),
        if (line != null && b.area(lang) != null) KeyValueRow(label: l.blArea, value: b.area(lang)!),
        if (landmark != null && landmark.isNotEmpty) KeyValueRow(label: l.blLandmark, value: landmark),
        if (c == null)
          OutlinedButton.icon(
            key: const Key('contact_show'),
            onPressed: _busy ? null : _load,
            icon: const Icon(LucideIcons.phone),
            label: Text(widget.side == BookingSide.sipalu ? l.blShowGhardhaniContact : l.blShowSipaluContact),
          )
        else if (c.visible && c.phone != null) ...[
          KeyValueRow(key: const Key('contact_shown'), label: l.blPhone, value: formatPhone(c.phone, lang: lang)),
          OutlinedButton.icon(
            onPressed: () => copyText(context, c.phone!),
            icon: const Icon(LucideIcons.copy),
            label: Text(l.blCopyNumber),
          ),
        ] else
          InfoNote(icon: LucideIcons.lock, text: l.blContactHidden),
        const SizedBox(height: KsSpace.s1),
        Text(l.blContactExpires, style: t.bodySmall?.copyWith(color: context.ks.textMuted)),
      ],
    );
  }
}

/// Picks how the Sipalu was paid (directly). Returns the method or null.
Future<String?> showPaidSheet(BuildContext context) => showModalBottomSheet<String>(
  context: context,
  builder: (ctx) {
    final l = ctx.l10n;
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(KsSpace.page, KsSpace.page, KsSpace.page, KsSpace.s1),
            child: Text(l.blHowPaid, style: Theme.of(ctx).textTheme.titleLarge),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: KsSpace.page),
            child: Text(l.blPaidDirectNote, style: Theme.of(ctx).textTheme.bodyMedium),
          ),
          for (final m in directPaymentMethods)
            ListTile(
              key: Key('paid_$m'),
              leading: Icon(switch (m) {
                'bank' => LucideIcons.landmark,
                'cash' => LucideIcons.banknote,
                _ => LucideIcons.smartphone,
              }),
              title: Text(paymentMethodLabel(l, m)),
              onTap: () => Navigator.pop(ctx, m),
            ),
        ],
      ),
    );
  },
);

/// Tags a Ghardhani can give a Sipalu, and the other way round.
const sipaluRatingTags = ['on_time', 'clean_work', 'polite', 'fair_price', 'skilled', 'explained_work'];
const ghardhaniRatingTags = ['respectful', 'paid_as_agreed', 'clear_instructions', 'safe_place'];

String ratingTagLabel(AppLocalizations l, String tag) => switch (tag) {
  'on_time' => l.blTagOnTime,
  'clean_work' => l.blTagCleanWork,
  'polite' => l.blTagPolite,
  'fair_price' => l.blTagFairPrice,
  'skilled' => l.blTagSkilled,
  'respectful' => l.blTagRespectful,
  'paid_as_agreed' => l.blTagPaidAsAgreed,
  'clear_instructions' => l.blTagClearInstructions,
  'explained_work' => l.blTagExplainedWork,
  'safe_place' => l.blTagSafePlace,
  _ => tag,
};

/// Stars + tags + comment. Returns true when saved.
Future<bool?> showBolauRateSheet(BuildContext context, {required Booking booking, required BookingSide side}) =>
    showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _RateSheet(booking: booking, side: side),
    );

class _RateSheet extends ConsumerStatefulWidget {
  const _RateSheet({required this.booking, required this.side});
  final Booking booking;
  final BookingSide side;

  @override
  ConsumerState<_RateSheet> createState() => _RateSheetState();
}

class _RateSheetState extends ConsumerState<_RateSheet> {
  int _score = 0;
  final Set<String> _tags = {};
  final _comment = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final l = context.l10n;
    if (_score == 0) {
      showSnack(context, l.blPickStars, error: true);
      return;
    }
    setState(() => _busy = true);
    try {
      await ref
          .read(bolauRepositoryProvider)
          .rate(widget.booking.id, score: _score, comment: _comment.text, tags: _tags.toList());
      if (!mounted) return;
      Navigator.pop(context, true);
      showSnack(context, l.blRatingSaved);
    } on ApiException catch (e) {
      if (!mounted) return;
      showSnack(context, e.code == 'duplicate' ? l.rateAlready : errorText(context, e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final tags = widget.side == BookingSide.ghardhani ? sipaluRatingTags : ghardhaniRatingTags;
    final other = widget.side == BookingSide.ghardhani ? widget.booking.sipalu : widget.booking.ghardhani;
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
            Text(widget.side == BookingSide.ghardhani ? l.blRateSipalu : l.blRateGhardhani, style: t.titleLarge),
            if (other != null && other.name.isNotEmpty) Text(other.name, style: t.bodyLarge),
            const SizedBox(height: KsSpace.s2),
            Text(l.blRateHint, style: t.bodySmall),
            const SizedBox(height: KsSpace.s2),
            StarInput(value: _score, onChanged: (v) => setState(() => _score = v), semanticLabel: 'score'),
            const SizedBox(height: KsSpace.s2),
            Wrap(
              spacing: KsSpace.s2,
              runSpacing: KsSpace.s2,
              children: [
                for (final tag in tags)
                  FilterChip(
                    key: Key('tag_$tag'),
                    label: Text(ratingTagLabel(l, tag)),
                    selected: _tags.contains(tag),
                    onSelected: (v) => setState(() => v ? _tags.add(tag) : _tags.remove(tag)),
                  ),
              ],
            ),
            const SizedBox(height: KsSpace.s3),
            TextField(
              key: const Key('rate_comment'),
              controller: _comment,
              maxLines: 3,
              maxLength: 500,
              decoration: InputDecoration(labelText: l.ecoOptional(l.rateComment)),
            ),
            const SizedBox(height: KsSpace.s2),
            FilledButton(
              key: const Key('rate_save'),
              onPressed: _busy ? null : _save,
              child:
                  _busy
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                      : Text(l.blSendRating),
            ),
          ],
        ),
      ),
    );
  }
}

/// Bottom-sheet form with a single price (final price / quote).
/// Returns the normalised amount or null.
Future<String?> showPriceSheet(
  BuildContext context, {
  required String title,
  String? hint,
  String? initial,
  String? max,
}) => showModalBottomSheet<String>(
  context: context,
  isScrollControlled: true,
  builder: (_) => _PriceSheet(title: title, hint: hint, initial: initial, max: max),
);

class _PriceSheet extends StatefulWidget {
  const _PriceSheet({required this.title, this.hint, this.initial, this.max});
  final String title;
  final String? hint;
  final String? initial;
  final String? max;

  @override
  State<_PriceSheet> createState() => _PriceSheetState();
}

class _PriceSheetState extends State<_PriceSheet> {
  late final _c = TextEditingController(
    text: () {
      final p = parsePaisa(widget.initial);
      return p == null ? '' : '${p ~/ 100}';
    }(),
  );
  final _form = GlobalKey<FormState>();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = context.lang;
    return Padding(
      padding: EdgeInsets.only(
        left: KsSpace.page,
        right: KsSpace.page,
        top: KsSpace.page,
        bottom: MediaQuery.viewInsetsOf(context).bottom + KsSpace.page,
      ),
      child: Form(
        key: _form,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(widget.title, style: Theme.of(context).textTheme.titleLarge),
            if (widget.hint != null) ...[const SizedBox(height: KsSpace.s1), Text(widget.hint!)],
            const SizedBox(height: KsSpace.s3),
            TextFormField(
              key: const Key('price_sheet_amount'),
              controller: _c,
              autofocus: true,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(labelText: l.blAmountRs, prefixText: 'Rs '),
              validator: (v) {
                final p = parsePaisa(moneyInput(v));
                if (p == null || p <= 0) return l.blEnterAmount;
                final max = parsePaisa(widget.max);
                if (max != null && max > 0 && p > max) return l.blNotAboveQuoted(formatMoney(widget.max, lang: lang));
                return null;
              },
            ),
            const SizedBox(height: KsSpace.s3),
            FilledButton(
              key: const Key('price_sheet_save'),
              onPressed: () {
                if (_form.currentState?.validate() ?? false) Navigator.pop(context, moneyInput(_c.text));
              },
              child: Text(l.commonSave),
            ),
          ],
        ),
      ),
    );
  }
}

/// Verification ladder for a Sipalu profile (`verification_level` 0–5).
class VerificationLadder extends StatelessWidget {
  const VerificationLadder({super.key, required this.level});
  final int level;

  @override
  Widget build(BuildContext context) => SkillLadder(earned: ladderRungsForLevel(level), height: 64);
}

/// Where a freshly raised booking dispute opens: the worker dispute detail
/// (evidence + appeal) for the Sipalu, the read-only party view for the
/// Ghardhani.
String bookingDisputeRoute(BookingSide side, String disputeId) =>
    side == BookingSide.sipalu ? Routes.workerDispute(disputeId) : Routes.gharDispute(disputeId);

/// "Raise a dispute" on a booking (either party) → `POST …/dispute
/// {description}`, then opens the dispute. Returns the dispute when sent.
Future<Dispute?> raiseBookingDispute(BuildContext context, WidgetRef ref, Booking b, BookingSide side) async {
  final l = context.l10n;
  final text = await showDialog<String>(context: context, builder: (_) => _DisputeDialog(side: side));
  if (text == null || !context.mounted) return null;
  try {
    final d = await ref.read(bolauRepositoryProvider).raiseDispute(b.id, text);
    ref.invalidate(bookingProvider(b.id));
    ref.invalidate(disputesProvider);
    if (!context.mounted) return d;
    showSnack(context, l.blDisputeSent);
    unawaited(context.push(bookingDisputeRoute(side, d.id), extra: d));
    return d;
  } catch (e) {
    if (context.mounted) showSnack(context, errorText(context, e), error: true);
    return null;
  }
}

/// Button shown on a booking while a dispute can be raised.
class RaiseDisputeButton extends ConsumerStatefulWidget {
  const RaiseDisputeButton({super.key, required this.booking, required this.side});
  final Booking booking;
  final BookingSide side;

  @override
  ConsumerState<RaiseDisputeButton> createState() => _RaiseDisputeButtonState();
}

class _RaiseDisputeButtonState extends ConsumerState<RaiseDisputeButton> {
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    if (!canDisputeBooking(widget.booking)) return const SizedBox.shrink();
    return OutlinedButton.icon(
      key: const Key('booking_dispute'),
      onPressed:
          _busy
              ? null
              : () async {
                setState(() => _busy = true);
                await raiseBookingDispute(context, ref, widget.booking, widget.side);
                if (mounted) setState(() => _busy = false);
              },
      icon: const Icon(LucideIcons.scale),
      label: Text(context.l10n.blRaiseDispute),
    );
  }
}

class _DisputeDialog extends StatefulWidget {
  const _DisputeDialog({required this.side});
  final BookingSide side;

  @override
  State<_DisputeDialog> createState() => _DisputeDialogState();
}

class _DisputeDialogState extends State<_DisputeDialog> {
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
      title: Text(l.blRaiseDisputeTitle),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(widget.side == BookingSide.sipalu ? l.blRaiseDisputeHint : l.blRaiseDisputeGharHint),
            const SizedBox(height: KsSpace.s3),
            TextField(
              key: const Key('dispute_description'),
              controller: _c,
              minLines: 3,
              maxLines: 6,
              maxLength: 2000,
              decoration: InputDecoration(labelText: l.blDisputeWhat, alignLabelWithHint: true),
              onChanged: (_) => setState(() {}),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: Text(l.commonCancel)),
        FilledButton(
          key: const Key('dispute_send'),
          onPressed: _c.text.trim().length < 5 ? null : () => Navigator.pop(context, _c.text.trim()),
          child: Text(l.ecoSubmit),
        ),
      ],
    );
  }
}
