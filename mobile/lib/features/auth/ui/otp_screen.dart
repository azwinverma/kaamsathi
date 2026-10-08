import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/session.dart';
import '../../../core/format.dart';
import '../../../core/l10n/l10n.dart';
import '../../../core/theme/tokens.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/digit_formatter.dart';

class OtpArgs {
  const OtpArgs({required this.phone, this.devCode, this.expiresIn = 300});
  final String phone;
  final String? devCode;
  final int expiresIn;
}

class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({super.key, required this.args});
  final OtpArgs args;

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  static const _length = 6;
  static const _resendAfter = 30;

  final _code = TextEditingController();
  final _focus = FocusNode();
  Timer? _timer;
  int _secondsLeft = _resendAfter;
  bool _busy = false;
  String? _error;
  String? _devCode;

  @override
  void initState() {
    super.initState();
    _devCode = widget.args.devCode;
    _startTimer();
    _code.addListener(() {
      setState(() => _error = null);
      if (_code.text.length == _length && !_busy) _verify();
    });
  }

  void _startTimer() {
    _timer?.cancel();
    setState(() => _secondsLeft = _resendAfter);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return;
      setState(() => _secondsLeft--);
      if (_secondsLeft <= 0) t.cancel();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _code.dispose();
    _focus.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    final l = context.l10n;
    if (_code.text.length != _length) {
      setState(() => _error = l.otpIncomplete);
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(sessionProvider.notifier).verifyOtp(widget.args.phone, _code.text);
      TextInput.finishAutofillContext();
      // The router redirects once the session is logged in.
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = errorText(context, e);
        _code.clear();
      });
      _focus.requestFocus();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resend() async {
    try {
      final r = await ref.read(sessionProvider.notifier).requestOtp(widget.args.phone);
      if (!mounted) return;
      setState(() => _devCode = r.devCode);
      showSnack(context, context.l10n.otpSent);
      _startTimer();
    } catch (e) {
      if (mounted) showSnack(context, errorText(context, e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final lang = context.lang;
    return Scaffold(
      appBar: AppBar(title: Text(l.otpTitle)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(KsSpace.s6),
          children: [
            Text(l.otpTitle, style: t.headlineMedium),
            const SizedBox(height: KsSpace.s2),
            Text(
              l.otpSubtitle(formatPhone(widget.args.phone, lang: lang)),
              style: t.bodyLarge?.copyWith(color: context.ks.textMuted),
            ),
            const SizedBox(height: KsSpace.s6),
            AutofillGroup(
              child: _OtpBoxes(
                controller: _code,
                focusNode: _focus,
                length: _length,
                hasError: _error != null,
                lang: lang,
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: KsSpace.s3),
              Text(_error!, style: t.bodyMedium?.copyWith(color: Theme.of(context).colorScheme.error)),
            ],
            if (_devCode != null) ...[
              const SizedBox(height: KsSpace.s4),
              InkWell(
                onTap: () => _code.text = _devCode!,
                child: StatusBadge(label: l.otpDevHint(_devCode!), tone: Tone.warning),
              ),
            ],
            const SizedBox(height: KsSpace.s6),
            FilledButton(
              onPressed: _busy ? null : _verify,
              child: _busy
                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5))
                  : Text(l.otpVerify),
            ),
            const SizedBox(height: KsSpace.s3),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                TextButton(
                  onPressed: () => Navigator.of(context).maybePop(),
                  child: Text(l.otpChangeNumber),
                ),
                TextButton(
                  onPressed: _secondsLeft > 0 ? null : _resend,
                  child: Text(
                    _secondsLeft > 0
                        ? l.otpResendIn(localizeDigits('$_secondsLeft', lang))
                        : l.otpResend,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Six visual boxes over one real text field, so SMS one-time-code
/// autofill and paste work.
class _OtpBoxes extends StatelessWidget {
  const _OtpBoxes({
    required this.controller,
    required this.focusNode,
    required this.length,
    required this.hasError,
    required this.lang,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final int length;
  final bool hasError;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Stack(
      children: [
        ListenableBuilder(
          listenable: Listenable.merge([controller, focusNode]),
          builder: (context, _) {
            final text = controller.text;
            return Row(
              children: List.generate(length, (i) {
                final filled = i < text.length;
                final active = focusNode.hasFocus && i == text.length.clamp(0, length - 1);
                return Expanded(
                  child: Container(
                    height: 56,
                    margin: EdgeInsets.only(right: i == length - 1 ? 0 : 8),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: scheme.surface,
                      borderRadius: BorderRadius.circular(KsRadius.control),
                      border: Border.all(
                        color: hasError
                            ? scheme.error
                            : active
                            ? scheme.primary
                            : scheme.outline,
                        width: active || hasError ? 2 : 1,
                      ),
                    ),
                    child: Text(
                      filled ? localizeDigits(text[i], lang) : '',
                      style: Theme.of(context).textTheme.headlineMedium,
                    ),
                  ),
                );
              }),
            );
          },
        ),
        Positioned.fill(
          child: Opacity(
            opacity: 0.011,
            child: TextField(
              key: const Key('otp_field'),
              controller: controller,
              focusNode: focusNode,
              autofocus: true,
              keyboardType: TextInputType.number,
              autofillHints: const [AutofillHints.oneTimeCode],
              inputFormatters: [DigitsFormatter(length)],
              showCursor: false,
              enableInteractiveSelection: false,
              style: const TextStyle(color: Colors.transparent, fontSize: 1),
              decoration: const InputDecoration(
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                filled: false,
                counterText: '',
              ),
            ),
          ),
        ),
      ],
    );
  }
}
