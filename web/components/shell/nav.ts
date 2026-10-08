import {
  Activity,
  BellRing,
  Funnel,
  ReceiptText,
  BadgeCheck,
  Building,
  ClipboardList,
  FileClock,
  Gauge,
  KeyRound,
  LifeBuoy,
  Plane,
  ScrollText,
  ShieldAlert,
  Tags,
  UserCheck,
  Webhook,
  Banknote,
  BarChart3,
  CalendarClock,
  ClipboardCheck,
  FileWarning,
  GraduationCap,
  Handshake,
  HardHat,
  Landmark,
  LineChart,
  Lock,
  UsersRound,
  Briefcase,
  Building2,
  CalendarCheck,
  CalendarOff,
  CreditCard,
  HandCoins,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Users,
  UserSearch,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/api/types";
import type { StaffRole } from "@/lib/api/types-security";

export interface NavItem {
  href: string;
  /** message key */
  label: string;
  icon: LucideIcon;
  roles?: Role[];
  /** Ops only: staff roles that may open this page (superadmin always can). Unset = any staff. */
  staffRoles?: StaffRole[];
  exact?: boolean;
}
export interface NavGroup {
  label?: string;
  items: NavItem[];
}

const FULL: Role[] = ["owner", "admin", "hr"];
const ADMIN: Role[] = ["owner", "admin"];

// Mirrors backend apps/accounts/staff_roles.py ROUTE_ROLES (docs/CONTRACT-EXTENSIONS.md §1).
const VERIFIER: StaffRole[] = ["verifier"];
const SUPPORT: StaffRole[] = ["support"];
const VERIFIER_OR_SUPPORT: StaffRole[] = ["verifier", "support"];
const SUPERADMIN: StaffRole[] = ["superadmin"];

export const APP_NAV: NavGroup[] = [
  { items: [{ href: "/app", label: "nav.dashboard", icon: LayoutDashboard, exact: true }] },
  {
    label: "nav.hire",
    items: [
      { href: "/app/jobs", label: "nav.jobs", icon: Briefcase, roles: FULL },
      { href: "/app/candidates", label: "nav.candidates", icon: UserSearch, roles: FULL },
    ],
  },
  {
    label: "nav.manage",
    items: [
      { href: "/app/workers", label: "nav.workers", icon: Users },
      { href: "/app/attendance", label: "nav.attendance", icon: CalendarCheck },
      { href: "/app/leave", label: "nav.leave", icon: CalendarOff },
      { href: "/app/advances", label: "nav.advance", icon: HandCoins, roles: FULL },
      { href: "/app/roster", label: "nav.roster", icon: CalendarClock },
      { href: "/app/timesheets", label: "nav.timesheets", icon: FileClock },
      { href: "/app/contractors", label: "nav.contractors", icon: HardHat, roles: FULL },
      { href: "/app/disputes", label: "nav.disputes", icon: FileWarning, roles: FULL },
    ],
  },
  {
    label: "nav.pay",
    items: [
      { href: "/app/payroll", label: "nav.payroll", icon: Banknote, roles: FULL },
      { href: "/app/compliance", label: "nav.compliance", icon: ClipboardCheck, roles: FULL },
    ],
  },
  {
    label: "nav.grow",
    items: [
      { href: "/app/analytics", label: "nav.analytics", icon: BarChart3, roles: FULL },
      { href: "/app/training", label: "nav.training", icon: GraduationCap, roles: FULL },
    ],
  },
  {
    label: "nav.account",
    items: [
      { href: "/app/settings", label: "nav.settings", icon: Settings, roles: FULL },
      { href: "/app/billing", label: "nav.billing", icon: CreditCard, roles: ADMIN },
      { href: "/app/verification", label: "nav.org_verification", icon: Building, roles: ADMIN },
      { href: "/app/integrations", label: "nav.integrations", icon: Webhook, roles: ADMIN },
      { href: "/app/support", label: "nav.support", icon: LifeBuoy },
      { href: "/app/account", label: "nav.account_security", icon: KeyRound },
    ],
  },
];

export const OPS_NAV: NavGroup[] = [
  { items: [{ href: "/ops", label: "nav.ops_dashboard", icon: LayoutDashboard, exact: true }] },
  {
    label: "nav.ops",
    items: [
      { href: "/ops/workers", label: "nav.ops_workers", icon: Users, staffRoles: VERIFIER },
      { href: "/ops/verification", label: "nav.ops_verification", icon: ShieldCheck, staffRoles: VERIFIER },
      { href: "/ops/jobs", label: "nav.ops_jobs", icon: Briefcase, staffRoles: VERIFIER_OR_SUPPORT },
      { href: "/ops/organizations", label: "nav.ops_organizations", icon: Building2, staffRoles: VERIFIER_OR_SUPPORT },
    ],
  },
  {
    label: "nav.ops_trust",
    items: [
      { href: "/ops/credentials", label: "nav.ops_credentials", icon: BadgeCheck, staffRoles: VERIFIER },
      { href: "/ops/disputes", label: "nav.ops_disputes", icon: FileWarning, staffRoles: SUPPORT },
      { href: "/ops/crews", label: "nav.ops_crews", icon: UsersRound, staffRoles: VERIFIER_OR_SUPPORT },
      { href: "/ops/privacy", label: "nav.ops_privacy", icon: Lock, staffRoles: SUPPORT },
      { href: "/ops/employers", label: "nav.ops_employers", icon: Building, staffRoles: VERIFIER },
      { href: "/ops/references", label: "nav.ops_references", icon: UserCheck, staffRoles: VERIFIER },
      { href: "/ops/risk", label: "nav.ops_risk", icon: ShieldAlert, staffRoles: ["risk_analyst"] },
      { href: "/ops/support", label: "nav.ops_support", icon: LifeBuoy, staffRoles: SUPPORT },
    ],
  },
  {
    label: "nav.ops_ecosystem",
    items: [
      { href: "/ops/training", label: "nav.ops_training", icon: GraduationCap, staffRoles: VERIFIER_OR_SUPPORT },
      { href: "/ops/partners", label: "nav.ops_partners", icon: Handshake, staffRoles: ["partner_manager"] },
      { href: "/ops/finance", label: "nav.ops_finance", icon: Landmark, staffRoles: ["finance_ops"] },
      { href: "/ops/billing", label: "nav.ops_billing", icon: ReceiptText, staffRoles: ["finance_ops"] },
      { href: "/ops/insights", label: "nav.ops_insights", icon: LineChart },
      { href: "/ops/kpis", label: "nav.ops_kpis", icon: Gauge },
      { href: "/ops/analytics", label: "nav.ops_analytics", icon: Funnel },
      { href: "/ops/mobility", label: "nav.ops_mobility", icon: Plane, staffRoles: VERIFIER },
    ],
  },
  {
    label: "nav.ops_admin",
    items: [
      { href: "/ops/audit", label: "nav.ops_audit", icon: ScrollText, staffRoles: SUPERADMIN },
      { href: "/ops/staff", label: "nav.ops_staff", icon: ClipboardList, staffRoles: SUPERADMIN },
      { href: "/ops/taxonomy", label: "nav.ops_taxonomy", icon: Tags, staffRoles: SUPERADMIN },
      { href: "/ops/system", label: "nav.ops_system", icon: Activity, staffRoles: SUPERADMIN },
      { href: "/ops/notifications", label: "nav.ops_notifications", icon: BellRing, staffRoles: SUPPORT },
      { href: "/ops/account", label: "nav.account_security", icon: KeyRound },
    ],
  },
];

/**
 * Can a staff member with `staffRoles` open this ops nav item?
 * Undefined roles (older backend without `Me.staff_roles`) → show everything.
 */
export function canSeeStaffItem(item: NavItem, staffRoles: readonly StaffRole[] | undefined): boolean {
  if (!item.staffRoles || staffRoles === undefined) return true;
  if (staffRoles.includes("superadmin")) return true;
  return item.staffRoles.some((r) => staffRoles.includes(r));
}

/** OPS_NAV filtered to what the staff member can open; empty groups are dropped. */
export function filterNavForStaff(
  nav: NavGroup[],
  staffRoles: readonly StaffRole[] | undefined,
): NavGroup[] {
  return nav
    .map((g) => ({ ...g, items: g.items.filter((i) => canSeeStaffItem(i, staffRoles)) }))
    .filter((g) => g.items.length > 0);
}

export function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}
