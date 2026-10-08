import '../api/json.dart';

/// Roles that grant supervisor mode (attendance for their sites).
const supervisorRoles = {'owner', 'admin', 'hr', 'supervisor'};

class OrgRef {
  const OrgRef({required this.id, required this.name, this.logo, this.industry});

  final String id;
  final String name;
  final String? logo;
  final String? industry;

  factory OrgRef.fromJson(Json j) =>
      OrgRef(id: strOr(j['id']), name: strOr(j['name']), logo: str(j['logo']), industry: str(j['industry']));
}

class Membership {
  const Membership({required this.id, required this.role, required this.organization, required this.siteIds});

  final String id;
  final String role;
  final OrgRef organization;
  final List<String> siteIds;

  bool get canSupervise => supervisorRoles.contains(role);

  /// owner/admin/hr see every site; supervisors only their assigned ones.
  bool get allSites => role != 'supervisor';

  factory Membership.fromJson(Json j) => Membership(
    id: strOr(j['id']),
    role: strOr(j['role']),
    organization: OrgRef.fromJson(asJson(j['organization'])),
    siteIds: strList(j['site_ids']),
  );
}

/// A legal document the user must (re-)accept: `pending_legal` item.
class PendingLegal {
  const PendingLegal({required this.id, required this.kind, this.version, this.url, this.title});
  final String id;

  /// terms | privacy | … (free text from the server)
  final String kind;
  final String? version;
  final String? url;
  final String? title;

  factory PendingLegal.fromJson(Json j) => PendingLegal(
    id: strOr(j['id']),
    kind: strOr(j['kind']),
    version: str(j['version']),
    url: str(j['url']),
    title: str(j['title']),
  );
}

/// `GET /auth/me`.
class Me {
  const Me({
    required this.id,
    required this.phone,
    required this.fullName,
    this.email,
    required this.preferredLanguage,
    required this.isStaff,
    this.workerId,
    required this.memberships,
    this.pendingLegal = const [],
  });

  final String id;
  final String phone;
  final String fullName;
  final String? email;
  final String preferredLanguage;
  final bool isStaff;
  final String? workerId;
  final List<Membership> memberships;

  /// Terms/policies to accept before using the app (blocking screen).
  final List<PendingLegal> pendingLegal;

  List<Membership> get supervisorMemberships => memberships.where((m) => m.canSupervise).toList();

  bool get canSupervise => supervisorMemberships.isNotEmpty;
  bool get isWorker => workerId != null && workerId!.isNotEmpty;
  bool get hasBothModes => canSupervise && isWorker;
  bool get hasAnyMode => canSupervise || isWorker;

  String get firstName {
    final n = fullName.trim();
    if (n.isEmpty) return '';
    return n.split(RegExp(r'\s+')).first;
  }

  factory Me.fromJson(Json j) => Me(
    id: strOr(j['id']),
    phone: strOr(j['phone']),
    fullName: strOr(j['full_name']),
    email: str(j['email']),
    preferredLanguage: strOr(j['preferred_language'], 'en'),
    isStaff: boolOf(j['is_staff']),
    workerId: str(j['worker_id']),
    memberships: asJsonList(j['memberships']).map(Membership.fromJson).toList(),
    pendingLegal: asJsonList(j['pending_legal']).map(PendingLegal.fromJson).where((d) => d.id.isNotEmpty).toList(),
  );
}
