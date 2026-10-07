import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_exception.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/eco.dart';
import '../../employment/employment_data.dart';
import '../trust_data.dart';

/// Bottom sheet: worker rates an employer (pay on time, conditions, comment).
/// Returns true when the rating was saved.
Future<bool?> showRateEmployerSheet(BuildContext context, MyEmployment job) {
  return showModalBottomSheet<bool>(context: context, isScrollControlled: true, builder: (_) => _RateSheet(job: job));
}

class _RateSheet extends ConsumerStatefulWidget {
  const _RateSheet({required this.job});
  final MyEmployment job;

  @override
  ConsumerState<_RateSheet> createState() => _RateSheetState();
}

class _RateSheetState extends ConsumerState<_RateSheet> {
  int _pay = 0;
  int _conditions = 0;
  final _comment = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final l = context.l10n;
    if (_pay == 0 || _conditions == 0) {
      showSnack(context, l.ratePickStars, error: true);
      return;
    }
    setState(() => _busy = true);
    try {
      await ref
          .read(trustRepositoryProvider)
          .rateEmployer(widget.job.id, payOnTime: _pay, conditions: _conditions, comment: _comment.text);
      ref.invalidate(myEmploymentsProvider);
      if (!mounted) return;
      Navigator.pop(context, true);
      showSnack(context, l.rateSent);
    } on ApiException catch (e) {
      if (!mounted) return;
      final msg = e.code == 'duplicate' ? l.rateAlready : errorText(context, e);
      showSnack(context, msg, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    return Padding(
      padding: EdgeInsets.only(
        left: KsSpace.page,
        right: KsSpace.page,
        bottom: MediaQuery.viewInsetsOf(context).bottom + KsSpace.page,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l.rateTitle, style: t.titleLarge),
            Text(widget.job.orgName(context.lang), style: t.bodyLarge),
            const SizedBox(height: KsSpace.s2),
            Text(l.rateHint, style: t.bodySmall),
            const SizedBox(height: KsSpace.s4),
            Text(l.ratePayOnTime, style: t.titleSmall),
            StarInput(value: _pay, onChanged: (v) => setState(() => _pay = v), semanticLabel: 'pay'),
            const SizedBox(height: KsSpace.s2),
            Text(l.rateConditions, style: t.titleSmall),
            StarInput(
              value: _conditions,
              onChanged: (v) => setState(() => _conditions = v),
              semanticLabel: 'conditions',
            ),
            const SizedBox(height: KsSpace.s3),
            TextField(
              controller: _comment,
              maxLines: 3,
              maxLength: 500,
              decoration: InputDecoration(labelText: l.ecoOptional(l.rateComment)),
            ),
            const SizedBox(height: KsSpace.s4),
            FilledButton(
              onPressed: _busy ? null : _save,
              child:
                  _busy
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                      : Text(l.commonSave),
            ),
          ],
        ),
      ),
    );
  }
}
