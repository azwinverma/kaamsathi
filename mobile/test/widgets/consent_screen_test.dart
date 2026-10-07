import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kaamsathi/features/worker/money/money_data.dart';
import 'package:kaamsathi/features/worker/money/ui/consent_screen.dart';

import '../fixtures/eco_fixtures.dart';
import 'harness.dart';

void main() {
  final loan = Offer.fromJson(offersJson.first);

  testWidgets('shows partner, regulator, purpose, scopes, duration, no-lend', (tester) async {
    await pumpLocalized(tester, ConsentView(offer: loan, today: DateTime(2026, 10, 7), onSubmit: (_) async {}));
    expect(find.text('Sunrise Bank'), findsOneWidget);
    expect(find.text('Offered by Sunrise Bank, regulated by Nepal Rastra Bank (NRB)'), findsOneWidget);
    expect(find.text('To check if you can get this loan'), findsOneWidget);
    expect(find.textContaining('Your verified salary'), findsOneWidget);
    expect(find.textContaining('Your Skill Passport'), findsOneWidget);
    expect(find.textContaining('will NOT see'), findsOneWidget);
    expect(find.textContaining('until'), findsOneWidget);
    expect(find.textContaining('stop sharing at any time'), findsOneWidget);
    expect(
      find.text(
        'KaamSathi does not lend you money and does not charge you. Any loan or insurance is between you and Sunrise Bank.',
      ),
      findsOneWidget,
    );
    expect(find.textContaining('credit', findRichText: true), findsNothing);
  });

  testWidgets('apply is disabled until the worker agrees; submits chosen days', (tester) async {
    ApplyRequest? sent;
    await pumpLocalized(
      tester,
      ConsentView(offer: loan, today: DateTime(2026, 10, 7), onSubmit: (r) async => sent = r),
    );
    final apply = find.byKey(const Key('consent_apply'));
    await tester.ensureVisible(apply);
    expect(tester.widget<FilledButton>(apply).onPressed, isNull);

    await tester.tap(find.text('90 days'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).first, '30000');

    await tester.ensureVisible(find.byKey(const Key('consent_agree')));
    await tester.tap(find.byKey(const Key('consent_agree')));
    await tester.pumpAndSettle();
    expect(tester.widget<FilledButton>(apply).onPressed, isNotNull);

    await tester.ensureVisible(apply);
    await tester.tap(apply);
    await tester.pumpAndSettle();
    expect(sent, isNotNull);
    expect(sent!.days, 90);
    expect(sent!.amount, '30000');
  });

  testWidgets('Nepali consent screen names the regulator in Nepali', (tester) async {
    final insurance = Offer.fromJson(offersJson[1]);
    await pumpLocalized(
      tester,
      ConsentView(offer: insurance, today: DateTime(2026, 10, 7), onSubmit: (_) async {}),
      lang: 'ne',
    );
    expect(find.text('Shikhar Insurance द्वारा प्रस्तावित, नेपाल बीमा प्राधिकरण द्वारा नियमन गरिएको'), findsOneWidget);
    expect(find.text('तपाईंलाई यो बीमा दिन'), findsOneWidget);
    // Insurance has no amount field.
    expect(find.textContaining('चाहिने रकम'), findsNothing);
  });
}
