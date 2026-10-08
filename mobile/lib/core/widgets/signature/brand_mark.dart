import 'package:flutter/material.dart';

import '../../l10n/l10n.dart';

/// The app's small brand mark (logo + wordmark). The only brand element on
/// supervisor ("documentary ledger") screens.
class KsBrandMark extends StatelessWidget {
  const KsBrandMark({super.key, this.size = 22, this.showName = false});

  final double size;
  final bool showName;

  @override
  Widget build(BuildContext context) {
    final logo = Image.asset('assets/logo.png', width: size, height: size, excludeFromSemantics: true);
    if (!showName) return Semantics(label: context.l10n.appName, child: logo);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        logo,
        const SizedBox(width: 6),
        Text(context.l10n.appName, style: Theme.of(context).textTheme.labelLarge),
      ],
    );
  }
}
