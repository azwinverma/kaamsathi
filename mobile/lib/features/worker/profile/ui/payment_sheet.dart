import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../data/worker_models.dart';
import '../../data/worker_repository.dart';

Future<void> showPaymentSheet(BuildContext context, WorkerProfile p) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (_) => _PaymentSheet(profile: p),
  );
}

class _PaymentSheet extends ConsumerStatefulWidget {
  const _PaymentSheet({required this.profile});
  final WorkerProfile profile;

  @override
  ConsumerState<_PaymentSheet> createState() => _PaymentSheetState();
}

class _PaymentSheetState extends ConsumerState<_PaymentSheet> {
  late String _method = widget.profile.paymentMethod;
  late final _bankName = TextEditingController(text: widget.profile.bankName);
  late final _accountNo = TextEditingController(text: widget.profile.bankAccountNo);
  late final _accountName = TextEditingController(text: widget.profile.bankAccountName);
  late final _wallet = TextEditingController(text: widget.profile.walletId);
  final _form = GlobalKey<FormState>();
  bool _busy = false;

  @override
  void dispose() {
    _bankName.dispose();
    _accountNo.dispose();
    _accountName.dispose();
    _wallet.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    setState(() => _busy = true);
    final patch = <String, dynamic>{'payment_method': _method};
    if (_method == 'bank') {
      patch['bank_name'] = _bankName.text.trim();
      patch['bank_account_no'] = _accountNo.text.trim();
      patch['bank_account_name'] = _accountName.text.trim();
    } else if (_method == 'esewa' || _method == 'khalti') {
      patch['wallet_id'] = _wallet.text.trim();
    }
    try {
      await ref.read(workerRepositoryProvider).updateProfile(patch);
      ref.invalidate(workerProfileProvider);
      if (!mounted) return;
      Navigator.pop(context);
      showSnack(context, context.l10n.commonSaved);
    } catch (e) {
      if (mounted) showSnack(context, errorText(context, e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    String? required(String? v) => (v == null || v.trim().isEmpty) ? l.commonErrorGeneric : null;
    return Padding(
      padding: EdgeInsets.only(
        left: KsSpace.page,
        right: KsSpace.page,
        bottom: MediaQuery.viewInsetsOf(context).bottom + KsSpace.page,
      ),
      child: Form(
        key: _form,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(l.profilePaymentMethod, style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: KsSpace.s4),
              Wrap(
                spacing: KsSpace.s2,
                runSpacing: KsSpace.s2,
                children: [
                  for (final m in ['esewa', 'khalti', 'bank', 'cash'])
                    ChoiceChip(
                      label: Text(paymentMethodLabel(l, m)),
                      selected: _method == m,
                      onSelected: (_) => setState(() => _method = m),
                    ),
                ],
              ),
              const SizedBox(height: KsSpace.s4),
              if (_method == 'bank') ...[
                TextFormField(
                  controller: _bankName,
                  decoration: InputDecoration(labelText: l.profileBankName),
                  validator: required,
                ),
                const SizedBox(height: KsSpace.s3),
                TextFormField(
                  controller: _accountNo,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(labelText: l.profileAccountNo),
                  validator: required,
                ),
                const SizedBox(height: KsSpace.s3),
                TextFormField(
                  controller: _accountName,
                  decoration: InputDecoration(labelText: l.profileAccountName),
                  validator: required,
                ),
              ],
              if (_method == 'esewa' || _method == 'khalti')
                TextFormField(
                  controller: _wallet,
                  keyboardType: TextInputType.phone,
                  decoration: InputDecoration(labelText: l.profileWalletId),
                  validator: required,
                ),
              const SizedBox(height: KsSpace.s6),
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
      ),
    );
  }
}
