import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/session.dart';
import '../../../core/format.dart';
import '../../../core/l10n/l10n.dart';
import '../../../core/router/router.dart';
import '../../../core/theme/tokens.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/digit_formatter.dart';
import '../../../core/widgets/language_toggle.dart';
import 'otp_screen.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _form = GlobalKey<FormState>();
  final _phone = TextEditingController();
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (ref.read(sessionProvider).expired) {
        showSnack(context, context.l10n.commonSessionExpired);
      }
    });
  }

  @override
  void dispose() {
    _phone.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    setState(() => _busy = true);
    final phone = normalizePhone(_phone.text);
    try {
      final r = await ref.read(sessionProvider.notifier).requestOtp(phone);
      if (!mounted) return;
      await context.push(Routes.otp, extra: OtpArgs(phone: phone, devCode: r.devCode, expiresIn: r.expiresIn));
    } catch (e) {
      if (mounted) showSnack(context, errorText(context, e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: Text(l.appName), actions: const [LanguageToggle()]),
      body: SafeArea(
        child: Form(
          key: _form,
          child: ListView(
            padding: const EdgeInsets.all(KsSpace.s6),
            children: [
              Text(l.loginTitle, style: t.headlineMedium),
              const SizedBox(height: KsSpace.s2),
              Text(l.loginSubtitle, style: t.bodyLarge?.copyWith(color: context.ks.textMuted)),
              const SizedBox(height: KsSpace.s6),
              TextFormField(
                key: const Key('phone_field'),
                controller: _phone,
                autofocus: true,
                keyboardType: TextInputType.phone,
                textInputAction: TextInputAction.done,
                autofillHints: const [AutofillHints.telephoneNumberNational],
                inputFormatters: const [DigitsFormatter(10)],
                style: t.titleLarge?.copyWith(letterSpacing: 1.5, fontFeatures: const [FontFeature.tabularFigures()]),
                decoration: InputDecoration(
                  labelText: l.loginPhoneLabel,
                  hintText: l.loginPhoneHint,
                  prefixIcon: Padding(
                    padding: const EdgeInsets.only(left: 14, right: 8),
                    child: Text('+977', style: t.titleLarge),
                  ),
                  prefixIconConstraints: const BoxConstraints(minWidth: 0, minHeight: 0),
                ),
                validator: (v) => isValidNepaliMobile(v ?? '') ? null : l.loginPhoneInvalid,
                onFieldSubmitted: (_) => _submit(),
              ),
              const SizedBox(height: KsSpace.s6),
              FilledButton(
                key: const Key('send_code'),
                onPressed: _busy ? null : _submit,
                child:
                    _busy
                        ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5))
                        : Text(l.loginSendCode),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
