import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kaamsathi/core/api/api_exception.dart';
import 'package:kaamsathi/core/api/cached.dart';
import 'package:kaamsathi/core/api/json.dart';
import 'package:kaamsathi/features/common/inbox/inbox_data.dart';
import 'package:kaamsathi/features/common/inbox/inbox_screen.dart';
import 'package:kaamsathi/features/common/legal/legal_screen.dart';
import 'package:kaamsathi/features/common/support/safety_report_screen.dart';
import 'package:kaamsathi/features/common/support/support_data.dart';
import 'package:kaamsathi/features/common/support/support_screen.dart';
import 'package:kaamsathi/features/worker/jobs/jobs_data.dart';
import 'package:kaamsathi/features/worker/jobs/ui/jobs_screen.dart';
import 'package:kaamsathi/features/worker/jobs/ui/offers.dart';
import 'package:kaamsathi/features/worker/mobility/mobility_data.dart';
import 'package:kaamsathi/features/worker/mobility/ui/mobility_screen.dart';
import 'package:kaamsathi/features/worker/money/money_data.dart';

import '../fixtures/ext_fixtures.dart';
import 'ext_harness.dart';

class _FakeJobs implements JobsRepository {
  final interested = <String>[];
  final responses = <(String, bool, String?)>[];

  @override
  Future<List<JobSummary>> recommended() async => resultsOf(recommendedJobsJson).map(JobSummary.fromJson).toList();

  @override
  Future<void> interest(String jobId) async => interested.add(jobId);

  @override
  Future<Cached<List<MyApplication>>> applications() async =>
      Cached(sortApplications(resultsOf(applicationsJson).map(MyApplication.fromJson).toList()));

  @override
  Future<void> respond(String applicationId, {required bool interested, String? note}) async =>
      responses.add((applicationId, interested, note));
}

class _FakeOffers implements OffersRepository {
  final accepted = <String>[];

  @override
  Future<void> accept(String id) async => accepted.add(id);

  @override
  Future<void> decline(String id, {String? reason}) async {}

  @override
  Future<List<JobOffer>> offers() async => resultsOf(jobOffersJson).map(JobOffer.fromJson).toList();

  @override
  Future<List<JobAlert>> alerts() async => const [];

  @override
  Future<void> createAlert(Json body) async {}

  @override
  Future<void> updateAlert(String id, Json body) async {}

  @override
  Future<void> deleteAlert(String id) async {}
}

class _FakeSupport implements SupportRepository {
  Json? safety;

  @override
  Future<List<SupportCase>> cases() async => const [];

  @override
  Future<SupportCase?> create({required String category, required String subject, required String description}) async =>
      null;

  @override
  Future<SupportCase?> reportSafety(Json body) async {
    safety = body;
    return null;
  }

  @override
  Future<List<CaseMessage>> messages(String caseId) async => const [];

  @override
  Future<void> send(String caseId, String body) async {}
}

void main() {
  group('I\'m interested', () {
    testWidgets('shows the review note, confirms, sends interest, marks the card', (tester) async {
      final fake = _FakeJobs();
      await pumpScreen(tester, const JobsScreen(), [
        jobsRepositoryProvider.overrideWithValue(fake),
        recommendedJobsProvider.overrideWith((ref) => fake.recommended()),
      ]);
      const note = "KaamSathi's team reviews your interest before the employer sees you.";
      expect(find.byKey(const Key('jobs_review_note')), findsOneWidget);
      expect(find.text(note), findsOneWidget);
      expect(find.byKey(const Key('employer_verified')), findsOneWidget);

      await tester.tap(find.byKey(const Key('interest_j1')));
      await tester.pumpAndSettle();
      // The confirm dialog repeats the note.
      expect(find.descendant(of: find.byType(AlertDialog), matching: find.textContaining(note)), findsOneWidget);
      expect(fake.interested, isEmpty);
      await tester.tap(find.descendant(of: find.byType(AlertDialog), matching: find.text("I'm interested")));
      await tester.pumpAndSettle();

      expect(fake.interested, ['j1']);
      expect(find.byKey(const Key('interest_sent_j1')), findsOneWidget);
      expect(find.byKey(const Key('interest_j1')), findsNothing);
    });

    testWidgets('cancel sends nothing (ne)', (tester) async {
      final fake = _FakeJobs();
      await pumpScreen(tester, const JobsScreen(), [
        jobsRepositoryProvider.overrideWithValue(fake),
        recommendedJobsProvider.overrideWith((ref) => fake.recommended()),
      ], lang: 'ne');
      expect(find.text('रोजगारदाताले तपाईंलाई देख्नुअघि कामसाथीको टोलीले तपाईंको चासो जाँच गर्छ।'), findsOneWidget);
      await tester.tap(find.byKey(const Key('interest_j1')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('रद्द गर्नुहोस्').last);
      await tester.pumpAndSettle();
      expect(fake.interested, isEmpty);
    });
  });

  group('applications confirm / decline', () {
    Future<_FakeJobs> pumpApps(WidgetTester tester) async {
      final fake = _FakeJobs();
      await pumpScreen(tester, const JobsScreen(initialTab: 2), [
        jobsRepositoryProvider.overrideWithValue(fake),
        myApplicationsProvider.overrideWith((ref) => fake.applications()),
      ]);
      return fake;
    }

    testWidgets('decline asks for confirmation; cancel keeps it pending', (tester) async {
      final fake = await pumpApps(tester);
      expect(find.text('You were shortlisted. Are you still interested?'), findsOneWidget);
      // Worker-interest application is under review, with no buttons.
      expect(find.text('KaamSathi is reviewing'), findsOneWidget);
      expect(find.byKey(const Key('decline_a2')), findsNothing);

      await tester.tap(find.byKey(const Key('decline_a1')));
      await tester.pumpAndSettle();
      expect(find.text('Decline this job?'), findsOneWidget);
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(fake.responses, isEmpty);
      expect(find.byKey(const Key('decline_a1')), findsOneWidget);

      await tester.tap(find.byKey(const Key('decline_a1')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('decline_reason')), 'Too far from home');
      await tester.tap(find.byKey(const Key('decline_confirm')));
      await tester.pumpAndSettle();
      expect(fake.responses, [('a1', false, 'Too far from home')]);
      expect(find.text('You declined'), findsOneWidget);
      expect(find.byKey(const Key('decline_a1')), findsNothing);
    });

    testWidgets('confirm interest needs no dialog', (tester) async {
      final fake = await pumpApps(tester);
      await tester.tap(find.byKey(const Key('confirm_a1')));
      await tester.pumpAndSettle();
      expect(fake.responses, [('a1', true, null)]);
      expect(find.text('You confirmed interest'), findsOneWidget);
    });
  });

  group('job offer', () {
    testWidgets('accept stays disabled until the worker agrees; summary switches language', (tester) async {
      final fake = _FakeOffers();
      final offer = JobOffer.fromJson(resultsOf(jobOffersJson).first);
      await pumpScreen(tester, OfferAcceptScreen(offer: offer), [offersRepositoryProvider.overrideWithValue(fake)]);
      expect(find.text('Rs. 12,170'), findsOneWidget);
      expect(find.text('Fixed term'), findsOneWidget);
      expect(find.text('KaamSathi never charges workers. Do not pay anyone to get this job.'), findsOneWidget);

      await tester.tap(find.text('नेपाली'));
      await tester.pumpAndSettle();
      expect(find.text('रु. १२,१७०'), findsOneWidget);
      expect(find.text('निश्चित अवधि'), findsOneWidget);

      final accept = find.byKey(const Key('offer_accept'));
      await tester.ensureVisible(accept);
      expect(tester.widget<FilledButton>(accept).onPressed, isNull);
      await tester.tap(find.byKey(const Key('offer_agree')));
      await tester.pumpAndSettle();
      await tester.ensureVisible(accept);
      await tester.tap(accept);
      await tester.pumpAndSettle();
      expect(fake.accepted, ['of1']);
    });

    testWidgets('offers tab shows countdown and verified employer', (tester) async {
      await pumpScreen(tester, const OffersTab(), [
        jobOffersProvider.overrideWith((ref) async => resultsOf(jobOffersJson).map(JobOffer.fromJson).toList()),
      ]);
      expect(find.byKey(const Key('offer_countdown_of1')), findsOneWidget);
      expect(find.byKey(const Key('employer_verified')), findsOneWidget);
    });
  });

  group('mobility safety guidance is always visible', () {
    final docs = mobilityDocumentsProvider.overrideWith(
      (ref) async => Cached(MobilityDocuments.fromJson(mobilityDocsJson)),
    );
    final agencies = mobilityAgenciesProvider.overrideWith(
      (ref) async => resultsOf(agenciesJson).map(RecruitmentAgency.fromJson).toList(),
    );
    final shares = mobilitySharesProvider.overrideWith(
      (ref) async => resultsOf(mobilitySharesJson).map(ConsentGrant.fromJson).toList(),
    );

    Future<void> expectGuidanceOnBothTabs(WidgetTester tester, {bool settle = true}) async {
      expect(find.byKey(const Key('mobility_safety')), findsOneWidget);
      await tester.tap(find.text('Agencies & sharing'));
      if (settle) {
        await tester.pumpAndSettle();
      } else {
        await tester.pump(const Duration(milliseconds: 500));
      }
      expect(find.byKey(const Key('mobility_safety')), findsOneWidget);
    }

    testWidgets('with data (server guidance + DoFE link + expiry warning)', (tester) async {
      await pumpScreen(tester, const MobilityScreen(), [docs, agencies, shares]);
      expect(find.text('Stay safe when going abroad'), findsOneWidget);
      expect(find.text('https://dofe.gov.np'), findsOneWidget);
      expect(find.byKey(const Key('expiry_warning_d1')), findsOneWidget);
      expect(find.text('Expired'), findsOneWidget);
      await expectGuidanceOnBothTabs(tester);
      expect(find.text('Licence no. 1234/070/71'), findsOneWidget);
    });

    testWidgets('with the backend off (built-in text)', (tester) async {
      await pumpScreen(tester, const MobilityScreen(), [
        mobilityDocumentsProvider.overrideWith((ref) => throw off),
        mobilityAgenciesProvider.overrideWith((ref) => throw off),
        mobilitySharesProvider.overrideWith((ref) => throw off),
      ]);
      expect(find.text('Never hand over your original passport without a receipt.'), findsOneWidget);
      expect(find.text(comingSoonEn), findsWidgets);
      await expectGuidanceOnBothTabs(tester);
    });

    testWidgets('while loading and on server error (ne)', (tester) async {
      final never = Completer<Cached<MobilityDocuments>>();
      await pumpScreen(
        tester,
        const MobilityScreen(),
        [
          mobilityDocumentsProvider.overrideWith((ref) => never.future),
          mobilityAgenciesProvider.overrideWith(
            (ref) => throw const ApiException(code: 'server_error', message: '', statusCode: 500),
          ),
          mobilitySharesProvider.overrideWith((ref) => Completer<List<ConsentGrant>>().future),
        ],
        lang: 'ne',
        settle: false,
      );
      expect(find.byType(CircularProgressIndicator), findsWidgets);
      expect(find.byKey(const Key('mobility_safety')), findsOneWidget);
      expect(find.text('रसिद नलिई आफ्नो सक्कल राहदानी कसैलाई नदिनुहोस्।'), findsOneWidget);
      await tester.tap(find.text('एजेन्सी र सेयरिङ'));
      await tester.pump(const Duration(milliseconds: 500));
      expect(find.byKey(const Key('mobility_safety')), findsOneWidget);
    });

    testWidgets('on the add-document form and the share sheet', (tester) async {
      await pumpScreen(tester, const AddMobilityDocScreen(), [
        mobilityDocumentsProvider.overrideWith((ref) => throw off),
      ]);
      expect(find.byKey(const Key('mobility_safety')), findsOneWidget);

      await pumpScreen(tester, const MobilityScreen(), [docs, agencies, shares]);
      await tester.tap(find.text('Agencies & sharing'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('share_p9')));
      await tester.pumpAndSettle();
      expect(find.text('Share with Himalayan Manpower Pvt. Ltd.?'), findsOneWidget);
      // One on the tab behind, one in the sheet.
      expect(find.byKey(const Key('mobility_safety')), findsNWidgets(2));
    });
  });

  testWidgets('support thread never shows internal notes', (tester) async {
    final raw = resultsOf(caseMessagesJson).map((j) => CaseMessage.fromJson(j, meId: 'u1')).toList();
    expect(raw.any((m) => m.internal), isTrue); // the fixture does contain one
    await pumpScreen(tester, const SupportThreadScreen(id: 'c1'), [
      supportCasesProvider.overrideWith((ref) async => resultsOf(supportCasesJson).map(SupportCase.fromJson).toList()),
      // Provider returns the raw list incl. the internal note: the screen must still hide it.
      caseMessagesProvider.overrideWith((ref, id) async => raw),
    ]);
    expect(find.textContaining('INTERNAL'), findsNothing);
    expect(find.textContaining('escalate'), findsNothing);
    expect(find.text('Please share your payslip month.'), findsOneWidget);
    expect(find.text('It is for Asoj.'), findsOneWidget);
    expect(find.text('KaamSathi team'), findsOneWidget);
    expect(find.text('You'), findsOneWidget);
    expect(find.text('Waiting for you'), findsOneWidget);
  });

  group('safety report', () {
    testWidgets('call-100 line, confidentiality, sends a confidential safety case', (tester) async {
      final fake = _FakeSupport();
      await pumpScreen(tester, const SafetyReportScreen(), [supportRepositoryProvider.overrideWithValue(fake)]);
      expect(find.text('If you are in danger now, call 100 (Police).'), findsOneWidget);
      expect(find.textContaining('Your employer will not see it'), findsOneWidget);

      await tester.tap(find.byKey(const Key('safety_kind_harassment')));
      await tester.enterText(find.byKey(const Key('safety_description')), 'The site manager shouts and threatens us.');
      await tester.tap(find.byKey(const Key('safety_emergency')));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byKey(const Key('safety_submit')));
      await tester.tap(find.byKey(const Key('safety_submit')));
      await tester.pumpAndSettle();
      expect(fake.safety?['category'], 'safety');
      expect(fake.safety?['safety_kind'], 'harassment');
      expect(fake.safety?['confidential'], isTrue);
      expect(fake.safety?['emergency'], isTrue);
    });

    testWidgets('Nepali danger line', (tester) async {
      await pumpScreen(tester, const SafetyReportScreen(), [], lang: 'ne');
      expect(find.text('अहिले खतरामा हुनुहुन्छ भने १०० (प्रहरी) मा फोन गर्नुहोस्।'), findsOneWidget);
    });
  });

  testWidgets('legal: accept only after agreeing; sends all document ids', (tester) async {
    List<String>? sent;
    await pumpScreen(tester, LegalScreen(onAccept: (ids) async => sent = ids), [], meJson: meWithLegalJson);
    expect(find.text('Terms of use'), findsOneWidget);
    expect(find.text('Privacy policy'), findsOneWidget);
    final accept = find.byKey(const Key('legal_accept'));
    await tester.ensureVisible(accept);
    expect(tester.widget<FilledButton>(accept).onPressed, isNull);
    await tester.tap(find.byKey(const Key('legal_agree')));
    await tester.pumpAndSettle();
    await tester.ensureVisible(accept);
    await tester.tap(accept);
    await tester.pumpAndSettle();
    expect(sent, ['L1', 'L2']);
  });

  testWidgets('inbox: unread badge on the bell', (tester) async {
    await pumpScreen(tester, const Scaffold(body: Center(child: InboxBell())), []);
    expect(find.text('3'), findsNothing);

    final container = ProviderScope.containerOf(tester.element(find.byType(InboxBell)));
    container.read(unreadCountProvider.notifier).set(3);
    await tester.pumpAndSettle();
    expect(find.text('3'), findsOneWidget);
  });
}
