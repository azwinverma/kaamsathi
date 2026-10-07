import '../api/json.dart';

/// Roles that grant supervisor mode (attendance for their sites).
const supervisorRoles = {'owner', 'admin', 'hr', 'supervisor'};

class OrgRef {
  const OrgRef({
    required this.id,
    required this.name,
    this.logo,
    this.industry,
  });

  final String id;
  final String name;
  final String? logo;
  final String? industry;

  factory OrgRef.fromJson(Json j) => OrgRef(
    id: strOr(j['id']),
    name: strOr(j['name']),
    logo: str(j['logo']),
    industry: str(j['industry']),
  );
}

class Membership {
  const Membership({
    required this.id,
    required this.role,
    required this.organization,
    required this.siteIds,
  });

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
  });

  final String id;
  final String phone;
  final String fullName;
  final String? email;
  final String preferredLanguage;
  final bool isStaff;
  final String? workerId;
  final List<Membership> memberships;

  List<Membership> get supervisorMemberships =>
      memberships.where((m) => m.canSupervise).toList();

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
  );
}
