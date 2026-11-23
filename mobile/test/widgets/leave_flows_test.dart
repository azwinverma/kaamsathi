import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kaamsathi/core/api/json.dart';
import 'package:kaamsathi/core/auth/session.dart';
import 'package:kaamsathi/core/format.dart';
import 'package:kaamsathi/core/router/router.dart';
import 'package:kaamsathi/features/common/inbox/inbox_data.dart';
import 'package:kaamsathi/features/common/inbox/inbox_screen.dart';
import 'package:kaamsathi/features/supervisor/leave/data/leave_repository.dart';
import 'package:kaamsathi/features/supervisor/leave/ui/leaves_screen.dart';
import 'package:kaamsathi/features/worker/employment/employment_data.dart';
import 'package:kaamsathi/features/worker/leave/my_leave_data.dart';
import 'package:kaamsathi/features/worker/leave/ui/my_leave_screen.dart';

import '../fixtures/eco_fixtures.dart' show employmentJson;
import 'ext_harness.dart';

class _FakeMyLeave implements MyLeaveRepository {
  final requests = <Json>[];
  final cancelled = <String>[];

  @override
  Future<void> request(Json body) async => requests.add(body);

  @override
  Future<void> cancel(String id) async => cancelled.add(id);

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

Json _leave(String id, String status, {String source = 'worker', String? note}) => {
  'id': id,
  'employment_id': 'e1',
  'worker': {'id': 'w1', 'full_name': 'Ram Bahadur Thapa'},
  'organization': {'id': 'o1', 'name': 'Hotel Annapurna View'},
  'designation': 'Cook',
  'leave_type': 'sick',
  'leave_type_label': 'Sick leave',
  'from_date': '2026-11-25',
  'from_date_bs': '2083-08-09',
  'to_date': '2026-11-26',
  'to_date_bs': '2083-08-10',
  'days': 2,
  'reason': 'Fever',
  'status': status,
  'source': source,
  'requested_by': {'id': 'u1', 'full_name': 'Ram Bahadur Thapa'},
  'decision_note': note,
  'created_at': '2026-11-23T10:00:00+05:45',
};

void main() {
  group('worker: my leave', () {
    final items = [
      LeaveRequest.fromJson(_leave('l1', 'pending')),
      LeaveRequest.fromJson(_leave('l2', 'rejected', note: 'Busy week')),
      LeaveRequest.fromJson(_leave('l3', 'cancelled')),
    ];

    testWidgets('lists requests with status chips; only pending can be cancelled', (tester) async {
      final fake = _FakeMyLeave();
      await pumpScreen(tester, const MyLeaveScreen(), [
        myLeaveRepositoryProvider.overrideWithValue(fake),
        myLeavesProvider.overrideWith((ref) async => items),
      ]);
      expect(find.text('Waiting'), findsOneWidget);
      expect(find.text('Rejected'), findsOneWidget);
      expect(find.text('Cancelled'), findsOneWidget);
      expect(find.text('Note: Busy week'), findsOneWidget);
      expect(find.textContaining('9 Mangsir 2083'), findsWidgets);
      expect(find.byKey(const Key('leave_cancel_l1')), findsOneWidget);
      expect(find.byKey(const Key('leave_cancel_l2')), findsNothing);

      await tester.tap(find.byKey(const Key('leave_cancel_l1')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('leave_cancel_confirm')));
      await tester.pumpAndSettle();
      expect(fake.cancelled, ['l1']);
    });

    testWidgets('empty list explains and offers a request (ne)', (tester) async {
      await pumpScreen(tester, const MyLeaveScreen(), [
        myLeaveRepositoryProvider.overrideWithValue(_FakeMyLeave()),
        myLeavesProvider.overrideWith((ref) async => <LeaveRequest>[]),
      ], lang: 'ne');
      expect(find.text('तपाईंले अहिलेसम्म बिदा माग्नुभएको छैन।'), findsOneWidget);
      expect(find.byKey(const Key('leave_new')), findsOneWidget);
    });

    testWidgets('request form sends job, type, dates and reason', (tester) async {
      final fake = _FakeMyLeave();
      await pumpScreen(tester, const LeaveRequestScreen(), [
        myLeaveRepositoryProvider.overrideWithValue(fake),
        myEmploymentsProvider.overrideWith((ref) async => [MyEmployment.fromJson(employmentJson)]),
      ]);
      final submit = find.byKey(const Key('leave_submit'));
      // No type picked yet.
      expect(tester.widget<FilledButton>(submit).onPressed, isNull);
      expect(find.text('1 days'), findsOneWidget);

      await tester.tap(find.byKey(const Key('leave_type_home')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('leave_reason')), 'Going home for Tihar');
      await tester.ensureVisible(submit);
      await tester.tap(submit);
      await tester.pumpAndSettle();
      final today = isoDate(nepalToday());
      expect(fake.requests, [
        {
          'employment_id': 'e1',
          'leave_type': 'home',
          'from_date': today,
          'to_date': today,
          'reason': 'Going home for Tihar',
        },
      ]);
    });

    testWidgets('no active job: explains and cannot submit (ne)', (tester) async {
      await pumpScreen(tester, const LeaveRequestScreen(), [
        myLeaveRepositoryProvider.overrideWithValue(_FakeMyLeave()),
        myEmploymentsProvider.overrideWith(
          (ref) async => [
            MyEmployment.fromJson({...employmentJson, 'status': 'ended', 'end_date': '2026-06-01'}),
          ],
        ),
      ], lang: 'ne');
      expect(find.byKey(const Key('leave_no_job')), findsOneWidget);
      await tester.tap(find.byKey(const Key('leave_type_sick')));
      await tester.pumpAndSettle();
      expect(tester.widget<FilledButton>(find.byKey(const Key('leave_submit'))).onPressed, isNull);
    });

    test('day count is inclusive and 0 when the range is backwards', () {
      expect(leaveDayCount('2026-11-25', '2026-11-25'), 1);
      expect(leaveDayCount('2026-11-25', '2026-12-04'), 10);
      expect(leaveDayCount('2026-11-25', '2026-11-24'), 0);
    });
  });

  group('supervisor: leave queue', () {
    testWidgets('worker-requested leave carries a badge', (tester) async {
      await pumpScreen(tester, const LeavesScreen(), [
        leavesProvider.overrideWith(
          (ref, status) async => [
            LeaveRequest.fromJson(_leave('l1', 'pending')),
            LeaveRequest.fromJson(_leave('l2', 'pending', source: 'employer')),
          ],
        ),
      ], mode: AppMode.supervisor);
      expect(find.byKey(const Key('leave_by_worker_l1')), findsOneWidget);
      expect(find.byKey(const Key('leave_by_worker_l2')), findsNothing);
      expect(find.text('Requested by worker'), findsOneWidget);
    });
  });

  test('leave notifications open the right screen', () {
    AppNotification n(String kind, {String? link}) =>
        AppNotification(id: 'n', kind: kind, title: 't', data: const {}, link: link);
    expect(routeForNotification(n('leave_decided', link: '/me/leaves'), AppMode.worker), Routes.workerLeave);
    expect(routeForNotification(n('leave_request', link: '/app/leave'), AppMode.supervisor), Routes.supLeaves);
  });
}
