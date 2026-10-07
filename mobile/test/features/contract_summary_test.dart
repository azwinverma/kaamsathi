import 'package:flutter_test/flutter_test.dart';
import 'package:kaamsathi/features/worker/employment/employment_data.dart';
import 'package:kaamsathi/features/worker/employment/ui/contract_accept_screen.dart';

import '../fixtures/eco_fixtures.dart';

void main() {
  test('contract summary is built in both languages from the employment', () {
    final e = MyEmployment.fromJson(employmentJson);
    final en = contractSummaryLines(e, 'en');
    expect(en.first, 'Employer: Hotel Annapurna View');
    expect(en, contains('Basic salary Rs. 12,170 + dearness allowance Rs. 7,380 = Rs. 19,550 per month.'));
    expect(en, contains('Other allowance: Rs. 1,500 per month.'));
    expect(en.any((s) => s.contains('enrolled in SSF')), isTrue);

    final ne = contractSummaryLines(e, 'ne');
    expect(ne.first, 'रोजगारदाता: होटल अन्नपूर्ण भ्यू');
    expect(ne, contains('आधारभूत तलब रु. १२,१७० + महँगी भत्ता रु. ७,३८० = मासिक रु. १९,५५०।'));
    expect(ne.length, en.length);
  });

  test('daily-wage contract shows jyala', () {
    final e = MyEmployment.fromJson({
      ...employmentJson,
      'wage_type': 'daily',
      'daily_wage': '754.00',
      'other_allowance': '0',
    });
    final en = contractSummaryLines(e, 'en');
    expect(en, contains('Daily wage (jyala): Rs. 754.'));
    expect(en.any((s) => s.startsWith('Other allowance')), isFalse);
  });
}
