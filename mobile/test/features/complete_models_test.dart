import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:kaamsathi/core/api/json.dart';
import 'package:kaamsathi/core/auth/session.dart';
import 'package:kaamsathi/core/flags.dart';
import 'package:kaamsathi/core/router/router.dart';
import 'package:kaamsathi/features/common/inbox/inbox_data.dart';
import 'package:kaamsathi/features/common/inbox/inbox_screen.dart';
import 'package:kaamsathi/features/supervisor/roster/roster_data.dart';
import 'package:kaamsathi/features/worker/credentials/credentials_data.dart';
import 'package:kaamsathi/features/worker/data/worker_models.dart';
import 'package:kaamsathi/features/worker/employment/employment_data.dart';
import 'package:kaamsathi/features/worker/jobs/jobs_data.dart';
import 'package:kaamsathi/features/worker/my_hajiri/corrections_data.dart';
import 'package:kaamsathi/features/worker/my_hajiri/ui/corrections_screen.dart';
import 'package:kaamsathi/features/worker/profile/ui/completeness_card.dart';
import 'package:kaamsathi/features/worker/trust/trust_data.dart';

import '../fixtures/complete_fixtures.dart';

void main() {
  group('worker profile: languages + completeness', () {
    final p = WorkerProfile.fromJson(workerFullJson);

    test('languages parse code, proficiency and labels', () {
      expect(p.languages.map((x) => x.code), ['ne', 'hi']);
      expect(p.languages.first.proficiency, 'native');
      expect(p.languages.last.label, 'Hindi');
    });

    test('the PATCH body replaces the whole list', () {
      final body = languagesPatch([...p.languages, const SpokenLanguage(code: 'ko', proficiency: 'basic')]);
      expect(body, {
        'languages': [
          {'language': 'ne', 'proficiency': 'native'},
          {'language': 'hi', 'proficiency': 'conversational'},
          {'language': 'ko', 'proficiency': 'basic'},
        ],
      });
      expect(languagesPatch(const []), {'languages': <Object>[]});
    });

    test('completeness: percent, todo in order, routes per key', () {
      final c = p.completeness!;
      expect(c.percent, 63);
      expect(c.isComplete, isFalse);
      expect(c.todo.map((i) => i.key), ['photo', 'verified_credential', 'payment_details']);
      expect(c.items, hasLength(8));
      expect(completenessRoute('languages'), Routes.workerLanguages);
      expect(completenessRoute('availability'), Routes.workerAvailability);
      expect(completenessRoute('verified_credential'), Routes.workerCredentials);
      expect(completenessRoute('work_history'), Routes.workerWorkHistory);
      expect(completenessRoute('payment_details'), Routes.workerProfile);
      for (final k in CompletenessKey.all) {
        expect(completenessRoute(k), isNotEmpty);
      }
    });

    test('completeness tolerates missing / missing-only payloads', () {
      expect(WorkerProfile.fromJson({'id': 'w'}).completeness, isNull);
      expect(WorkerProfile.fromJson({'id': 'w'}).languages, isEmpty);
      final only =
          ProfileCompleteness.fromJson({
            'percent': 88,
            'missing': ['photo'],
          })!;
      expect(only.todo.single.key, 'photo');
      expect(ProfileCompleteness.fromJson({'percent': 100, 'items': <Object>[]})!.isComplete, isTrue);
    });
  });

  group('applications: interviews + employer invite', () {
    final apps = resultsOf(applicationsWithInterviewsJson).map(MyApplication.fromJson).toList();

    test('interviews parse; pending first; no notes field', () {
      final a = apps.first;
      expect(a.isEmployerInvite, isTrue);
      expect(a.needsResponse, isTrue);
      expect(a.interviews.map((i) => i.id), ['iv1', 'iv0']);
      final iv = a.interviews.first;
      expect(iv.mode, 'trade_test');
      expect(iv.location, 'Thamel kitchen, 2nd floor');
      expect(iv.interviewerName, 'Head chef');
      expect(iv.isPending, isTrue);
      expect(a.interviews.last.outcome, 'passed');
      expect(apps.last.isEmployerInvite, isFalse);
      expect(apps.last.interviews, isEmpty);
    });
  });

  group('ratings', () {
    final r = MyRatings.fromJson(myRatingsJson);

    test('received / given, moderation state, flagging', () {
      expect(r.received, hasLength(3));
      expect(r.given.single.rater, 'worker');
      expect(r.received.first.canFlag, isTrue);
      expect(r.received[1].comment, isNull);
      expect(r.received[1].commentStatus, 'hidden');
      expect(r.received.first.flagged().commentStatus, 'flagged');
      expect(r.received.first.organization?.name, 'Hotel Annapurna View');
    });

    test('averages skip voided ratings', () {
      final avg = ratingAverages(r.received)!;
      expect(avg.count, 2);
      expect(avg.a, 3.5);
      expect(avg.b, 3.5);
      expect(ratingAverages(const []), isNull);
    });
  });

  group('disputes: evidence + appeal', () {
    final list = resultsOf(disputesCompleteJson).map(Dispute.fromJson).toList();

    test('appeal fields and statuses', () {
      final d5 = list[0];
      expect(d5.canAppeal, isTrue);
      expect(d5.appealDeadline, isNotNull);
      expect(d5.evidenceCount, 1);
      expect(d5.employmentId, 'e1');
      expect(d5.canAddEvidence, isFalse); // rejected
      final d6 = list[1];
      expect(d6.status, 'appealed');
      expect(d6.appeal?.reason, startsWith('The register'));
      expect(d6.appeal?.outcome, isNull);
      expect(d6.canAddEvidence, isTrue);
      expect(list[2].appeal, isNull);
      expect(list[2].canAppeal, isFalse);
    });

    test('evidence rows', () {
      final ev = evidenceListJson.map(DisputeEvidence.fromJson).toList();
      expect(ev.first.isPdf, isFalse);
      expect(ev.first.uploadedBy, 'Ram Bahadur Thapa');
      expect(ev.last.isPdf, isTrue);
      expect(ev.last.partyLabel, 'Employer');
      expect(ev.last.fileUrl, contains('sig=2'));
    });

    test('evidence upload is multipart `file` + trimmed `note`', () async {
      final dir = await Directory.systemTemp.createTemp('ks_ev');
      addTearDown(() => dir.delete(recursive: true));
      final f = File('${dir.path}/photo.jpg')..writeAsBytesSync([1, 2, 3, 4]);
      final form = await evidenceForm(f.path, note: '  OT register  ');
      expect(form.files.single.key, 'file');
      expect(form.files.single.value.length, 4);
      expect({for (final f in form.fields) f.key: f.value}, {'note': 'OT register'});
      final bare = await evidenceForm(f.path, note: '  ');
      expect(bare.fields, isEmpty);
    });
  });

  group('credentials: resubmit', () {
    final list = resultsOf(credentialsResubmitJson).map(Credential.fromJson).toList();

    test('can_resubmit and resubmission_of', () {
      expect(list.first.canResubmit, isTrue);
      expect(list.first.resubmissionOf, isNull);
      expect(list.last.canResubmit, isFalse);
      expect(list.last.resubmissionOf?.id, 'cr1');
      expect(list.last.resubmissionOf?.note, 'Expired certificate.');
    });

    test('resubmit sends only changed fields', () {
      final c = list.first;
      expect(
        credentialFields(
          kind: c.kind,
          title: c.title,
          issuer: c.issuer!,
          certificateNo: 'NSTB-1000',
          level: c.level,
          issuedOn: c.issuedOn,
          original: c,
        ),
        {'certificate_no': 'NSTB-1000'},
      );
      expect(credentialFields(kind: 'nstb', title: 'T', issuer: 'I', level: ' '), {
        'kind': 'nstb',
        'title': 'T',
        'issuer': 'I',
      });
    });
  });

  group('attendance corrections', () {
    test('parse', () {
      final list = resultsOf(correctionsJson).map(AttendanceCorrection.fromJson).toList();
      expect(list.first.isPending, isTrue);
      expect(list.first.workerName, 'Ram Bahadur Thapa');
      expect(list.first.requestedCheckInAt, isNotNull);
      expect(list.last.decisionNote, 'No leave request on file.');
      expect(list.last.decidedBy, 'Sita Supervisor');
    });

    test('request body uses the backend field names in Nepal time', () {
      expect(
        correctionBody(
          employmentId: 'e1',
          date: '2026-10-01',
          requestedStatus: 'present',
          checkIn: (hour: 9, minute: 5),
          reason: ' QR failed ',
        ),
        {
          'employment_id': 'e1',
          'date': '2026-10-01',
          'requested_status': 'present',
          'requested_check_in_at': '2026-10-01T09:05:00+05:45',
          'reason': 'QR failed',
        },
      );
    });

    test('employedOn respects start/end dates', () {
      final e = MyEmployment.fromJson({'id': 'e', 'start_date': '2026-08-01', 'end_date': '2026-09-30'});
      expect(employedOn(e, '2026-07-31'), isFalse);
      expect(employedOn(e, '2026-08-01'), isTrue);
      expect(employedOn(e, '2026-10-01'), isFalse);
    });

    test('attendance days carry check-in/out times', () {
      final m = MyAttendanceMonth.fromJson(myAttendanceMonthJson);
      expect(m.days.first.checkInAt, isNotNull);
      expect(m.days.last.checkOutAt, isNull);
    });
  });

  group('hourly pay', () {
    test('payslip regular hours + employment link', () {
      final p = Payslip.fromJson(hourlyPayslipJson);
      expect(p.isHourly, isTrue);
      expect(p.regularHours, 96);
      expect(p.employmentId, 'e2');
      expect(p.hourlyWage, isNull);
    });

    test('employment hourly wage + part-time', () {
      final e = MyEmployment.fromJson(hourlyEmploymentJson);
      expect(e.hourlyWage, '120.00');
      expect(e.partTime, isTrue);
    });
  });

  group('roster warnings', () {
    test('cell warnings, labels and the save result', () {
      final w = RosterWeek.fromJson(rosterWithWarningsJson, DateTime(2026, 10, 4));
      expect(w.rows.single.warnings['2026-10-05'], ['on_leave', 'conflict_elsewhere']);
      expect(w.rows.single.warnings['2026-10-04'], isNull);
      expect(w.warningLabels['on_leave'], 'On approved leave');
      final r = RosterSaveResult.fromJson(rosterSaveJson);
      expect(r.notifiedWorkers, 1);
      expect(r.warnings.single.code, 'on_leave');
      expect(RosterSaveResult.fromJson(null).notifiedWorkers, 0);
    });
  });

  group('feature flags', () {
    test('parse {flags} and bare maps', () {
      expect(parseFlags(flagsJson), {'dispute_appeal': false, 'worker_ratings': true, 'ird_cbms_enabled': false});
      expect(parseFlags({'x': true}), {'x': true});
      expect(parseFlags(null), isEmpty);
    });
  });

  group('notification routing (new kinds)', () {
    AppNotification n(String kind, {Json data = const {}, String? link}) =>
        AppNotification(id: 'n', kind: kind, title: 't', data: data, link: link);

    test('worker', () {
      expect(
        routeForNotification(n('roster_changed', link: '/me/roster', data: {'employment_id': 'e1'}), AppMode.worker),
        Routes.workerShifts,
      );
      expect(routeForNotification(n('interview_scheduled'), AppMode.worker), Routes.workerApplications);
      expect(
        routeForNotification(n('application_invited', link: '/me/applications'), AppMode.worker),
        Routes.workerApplications,
      );
      expect(
        routeForNotification(n('dispute_appeal', link: '/me/disputes', data: {'dispute_id': 'd5'}), AppMode.worker),
        Routes.workerDispute('d5'),
      );
      expect(
        routeForNotification(n('dispute_evidence', data: {'dispute_id': 'd6'}), AppMode.worker),
        Routes.workerDispute('d6'),
      );
      expect(
        routeForNotification(n('attendance_correction_decided', link: '/me/attendance'), AppMode.worker),
        Routes.workerHajiri,
      );
      expect(routeForNotification(n('job_offer', link: '/me/job-offers'), AppMode.worker), Routes.workerOffers);
    });

    test('supervisor', () {
      expect(
        routeForNotification(n('attendance_correction', link: '/app/attendance'), AppMode.supervisor),
        Routes.supCorrections,
      );
      expect(routeForNotification(n('roster_changed'), AppMode.supervisor), isNull);
    });
  });
}
