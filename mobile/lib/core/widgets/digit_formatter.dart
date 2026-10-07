import 'package:flutter/services.dart';

import '../format.dart';

/// Accepts ASCII and Devanagari digits (Nepali keyboards), stores ASCII.
class DigitsFormatter extends TextInputFormatter {
  const DigitsFormatter(this.maxLength);
  final int maxLength;

  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    var digits = toLatinDigits(newValue.text).replaceAll(RegExp(r'\D'), '');
    if (digits.length > maxLength) digits = digits.substring(0, maxLength);
    return TextEditingValue(
      text: digits,
      selection: TextSelection.collapsed(offset: digits.length),
    );
  }
}
