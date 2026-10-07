import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kaamsathi/features/worker/trust/trust_data.dart';
import 'package:kaamsathi/features/worker/trust/ui/trust_card.dart';

import '../fixtures/eco_fixtures.dart';
import 'harness.dart';

void main() {
  testWidgets('shows score ring, level badge, next steps (en)', (tester) async {
    var tapped = false;
    await pumpLocalized(
      tester,
      SingleChildScrollView(
        child: TrustCardView(summary: TrustSummary.fromJson(trustJson), onViews: () => tapped = true),
      ),
    );
    expect(find.text('My reliability'), findsOneWidget);
    expect(find.text('78'), findsOneWidget);
    expect(find.text('78 out of 100'), findsOneWidget);
    expect(find.text('Level 2 · Employment verified'), findsOneWidget);
    expect(find.text('Upload your NSTB certificate'), findsOneWidget);
    expect(find.textContaining('credit', findRichText: true), findsNothing);

    // Breakdown bars are collapsed until opened.
    expect(find.text('Hajiri (attendance)'), findsNothing);
    await tester.tap(find.text('What makes up your score'));
    await tester.pumpAndSettle();
    expect(find.text('Hajiri (attendance)'), findsOneWidget);
    expect(find.text('92%'), findsOneWidget);

    await tester.ensureVisible(find.text('Who viewed my profile'));
    await tester.tap(find.text('Who viewed my profile'));
    expect(tapped, isTrue);
  });

  testWidgets('Nepali: Devanagari digits and local level label fallback', (tester) async {
    final s = TrustSummary.fromJson({...trustJson, 'verification_level_label': null});
    await pumpLocalized(tester, SingleChildScrollView(child: TrustCardView(summary: s)), lang: 'ne');
    expect(find.text('मेरो भरपर्दोपन'), findsOneWidget);
    expect(find.text('७८'), findsOneWidget);
    expect(find.text('तह २ · रोजगारी प्रमाणित'), findsOneWidget);
    expect(find.text('भरपर्दो अंक'), findsWidgets);
  });

  testWidgets('no score yet + offline notice', (tester) async {
    final s = TrustSummary.fromJson({'verification_level': 0, 'reliability_score': null});
    await pumpLocalized(tester, SingleChildScrollView(child: TrustCardView(summary: s, fromCache: true)));
    expect(find.text('–'), findsOneWidget);
    expect(find.text('Your score appears after your first job on KaamSathi.'), findsOneWidget);
    expect(find.text('Level 0 · Phone verified'), findsOneWidget);
    expect(find.text('What makes up your score'), findsNothing);
    expect(find.textContaining('Offline'), findsOneWidget);
  });
}
