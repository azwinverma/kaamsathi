import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/json.dart';
import '../../../core/auth/session.dart';
import '../../../core/providers.dart';
import '../../common/ref_data.dart';

/// `GET /me/courses` item.
class Course {
  const Course({
    required this.id,
    required this.title,
    this.titleNe,
    this.description,
    this.providerName,
    this.providerNameNe,
    this.trade,
    this.level,
    this.durationDays,
    this.fee,
    this.sponsorNote,
    this.mode,
    this.district,
    this.startsOn,
    this.startsOnBs,
    this.seats,
    this.status = 'open',
    this.leadsToNstb = false,
    this.recommended = false,
  });

  final String id;
  final String title;
  final String? titleNe;
  final String? description;
  final String? providerName;
  final String? providerNameNe;
  final Trade? trade;

  /// basic | level1 | level2 | level3 | refresher
  final String? level;
  final int? durationDays;
  final String? fee;
  final String? sponsorNote;

  /// classroom | on_site | online
  final String? mode;
  final String? district;
  final String? startsOn;
  final String? startsOnBs;
  final int? seats;
  final String status;
  final bool leadsToNstb;
  final bool recommended;

  String displayTitle(String lang) => lang == 'ne' && (titleNe?.isNotEmpty ?? false) ? titleNe! : title;
  String? provider(String lang) =>
      lang == 'ne' && (providerNameNe?.isNotEmpty ?? false) ? providerNameNe : providerName;

  factory Course.fromJson(Json j, {String lang = 'en'}) {
    final p = asJsonOrNull(j['provider']);
    final d = j['district'];
    return Course(
      id: strOr(j['id']),
      title: strOr(j['title']),
      titleNe: str(j['title_ne']),
      description: str(j['description']),
      providerName: str(p?['name'] ?? j['provider_name']),
      providerNameNe: str(p?['name_ne']),
      trade: Trade.fromAny(j['trade']),
      level: str(j['level']),
      durationDays: intOf(j['duration_days']),
      fee: str(j['fee']),
      sponsorNote: str(j['sponsor_note']),
      mode: str(j['mode']),
      district: d is Map ? str(lang == 'ne' ? (d['name_ne'] ?? d['name_en']) : d['name_en']) : str(d),
      startsOn: str(j['starts_on']),
      startsOnBs: str(j['starts_on_bs']),
      seats: intOf(j['seats']),
      status: strOr(j['status'], 'open'),
      leadsToNstb: boolOf(j['leads_to_nstb']),
      recommended: boolOf(j['recommended']),
    );
  }
}

/// Recommended courses first, then by start date (stable otherwise).
List<Course> sortCourses(List<Course> courses) {
  final indexed = courses.asMap().entries.toList();
  indexed.sort((a, b) {
    if (a.value.recommended != b.value.recommended) return a.value.recommended ? -1 : 1;
    final sa = a.value.startsOn ?? '9999';
    final sb = b.value.startsOn ?? '9999';
    final c = sa.compareTo(sb);
    return c != 0 ? c : a.key.compareTo(b.key);
  });
  return [for (final e in indexed) e.value];
}

/// `GET /me/enrollments` item.
class Enrollment {
  const Enrollment({
    required this.id,
    required this.courseId,
    this.course,
    required this.status,
    this.appliedAt,
    this.completedOn,
    this.completedOnBs,
  });

  final String id;
  final String courseId;
  final Course? course;

  /// applied | enrolled | completed | dropped | rejected
  final String status;
  final DateTime? appliedAt;
  final String? completedOn;
  final String? completedOnBs;

  factory Enrollment.fromJson(Json j, {String lang = 'en'}) {
    final c = asJsonOrNull(j['course']);
    return Enrollment(
      id: strOr(j['id']),
      courseId: strOr(c?['id'] ?? j['course_id'] ?? j['course']),
      course: c == null ? null : Course.fromJson(c, lang: lang),
      status: strOr(j['status'], 'applied'),
      appliedAt: dateTimeOf(j['applied_at']),
      completedOn: str(j['completed_on']),
      completedOnBs: str(j['completed_on_bs']),
    );
  }
}

class TrainingRepository {
  TrainingRepository(this._api);
  final ApiClient _api;

  Future<List<Course>> courses(String lang) async {
    final data = await _api.get<dynamic>('/me/courses', query: {'page_size': 100});
    return sortCourses(resultsOf(data).map((j) => Course.fromJson(j, lang: lang)).toList());
  }

  Future<List<Enrollment>> enrollments(String lang) async {
    final data = await _api.get<dynamic>('/me/enrollments', query: {'page_size': 100});
    return resultsOf(data).map((j) => Enrollment.fromJson(j, lang: lang)).toList();
  }

  Future<void> apply(String courseId) => _api.postNoContent('/me/enrollments', data: {'course_id': courseId});
}

final trainingRepositoryProvider = Provider<TrainingRepository>(
  (ref) => TrainingRepository(ref.watch(apiClientProvider)),
);

final coursesProvider = FutureProvider.autoDispose<List<Course>>((ref) {
  ref.watch(sessionProvider.select((s) => s.me?.id));
  return ref.watch(trainingRepositoryProvider).courses(ref.watch(langCodeProvider));
});

final enrollmentsProvider = FutureProvider.autoDispose<List<Enrollment>>((ref) {
  ref.watch(sessionProvider.select((s) => s.me?.id));
  return ref.watch(trainingRepositoryProvider).enrollments(ref.watch(langCodeProvider));
});
