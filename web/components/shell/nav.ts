import {
  Activity,
  DoorOpen,
  ListChecks,
  SlidersHorizontal,
  Star,
  ToggleRight,
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
  MapPin,
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
  /** Client feature flag that must be on for the item to show (e.g. `bolau`). */
  flag?: string;
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

/**
 * Employer IA — brand v2 §18: Dashboard · Recruitment · Workforce · Sites · Attendance · Payroll ·
 * Training · Reports · Billing · Settings. Single-item groups render as a top-level link (no heading).
 * Every route and role rule is unchanged from the earlier Hire/Manage/Pay/Grow/Account grouping.
 */
export const APP_NAV: NavGroup[] = [
  { items: [{ href: "/app", label: "nav.dashboard", icon: LayoutDashboard, exact: true }] },
  {
    label: "ledger.nav.recruitment",
    items: [
      { href: "/app/jobs", label: "nav.jobs", icon: Briefcase, roles: FULL },
      { href: "/app/candidates", label: "nav.candidates", icon: UserSearch, roles: FULL },
    ],
  },
  {
    label: "ledger.nav.workforce",
    items: [
      { href: "/app/workers", label: "nav.workers", icon: Users },
      { href: "/app/contractors", label: "nav.contractors", icon: HardHat, roles: FULL },
      { href: "/app/leave", label: "nav.leave", icon: CalendarOff },
      { href: "/app/advances", label: "nav.advance", icon: HandCoins, roles: FULL },
      { href: "/app/disputes", label: "nav.disputes", icon: FileWarning, roles: FULL },
      { href: "/app/ratings", label: "nav.ratings", icon: Star, roles: FULL },
    ],
  },
  {
    label: "ledger.nav.sites",
    items: [
      { href: "/app/roster", label: "nav.roster", icon: CalendarClock },
      { href: "/app/settings?tab=sites", label: "ledger.nav.work_sites", icon: MapPin, roles: FULL },
    ],
  },
  {
    label: "ledger.nav.attendance",
    items: [
      { href: "/app/attendance", label: "nav.attendance", icon: CalendarCheck },
      { href: "/app/attendance/corrections", label: "nav.corrections", icon: ListChecks },
      { href: "/app/timesheets", label: "nav.timesheets", icon: FileClock },
    ],
  },
  {
    label: "ledger.nav.payroll",
    items: [
      { href: "/app/payroll", label: "nav.payroll", icon: Banknote, roles: FULL },
      { href: "/app/compliance", label: "nav.compliance", icon: ClipboardCheck, roles: FULL },
    ],
  },
  {
    label: "ledger.nav.training",
    items: [{ href: "/app/training", label: "nav.training", icon: GraduationCap, roles: FULL }],
  },
  {
    label: "ledger.nav.reports",
    items: [{ href: "/app/analytics", label: "nav.analytics", icon: BarChart3, roles: FULL }],
  },
  {
    label: "ledger.nav.billing",
    items: [{ href: "/app/billing", label: "nav.billing", icon: CreditCard, roles: ADMIN }],
  },
  {
    label: "ledger.nav.settings",
    items: [
      { href: "/app/settings", label: "nav.settings", icon: Settings, roles: FULL },
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
    label: "ledger.nav.ops_queues",
    items: [
      { href: "/ops/workers", label: "nav.ops_workers", icon: Users, staffRoles: VERIFIER },
      { href: "/ops/verification", label: "nav.ops_verification", icon: ShieldCheck, staffRoles: VERIFIER },
      { href: "/ops/jobs", label: "nav.ops_jobs", icon: Briefcase, staffRoles: VERIFIER_OR_SUPPORT },
      { href: "/ops/organizations", label: "nav.ops_organizations", icon: Building2, staffRoles: VERIFIER_OR_SUPPORT },
      { href: "/ops/bolau", label: "nav.ops_bolau", icon: DoorOpen, staffRoles: SUPPORT, flag: "bolau" },
    ],
  },
  {
    label: "ledger.nav.ops_trust",
    items: [
      { href: "/ops/credentials", label: "nav.ops_credentials", icon: BadgeCheck, staffRoles: VERIFIER },
      { href: "/ops/disputes", label: "nav.ops_disputes", icon: FileWarning, staffRoles: SUPPORT },
      { href: "/ops/ratings", label: "nav.ops_ratings", icon: Star, staffRoles: SUPPORT },
      { href: "/ops/crews", label: "nav.ops_crews", icon: UsersRound, staffRoles: VERIFIER_OR_SUPPORT },
      { href: "/ops/privacy", label: "nav.ops_privacy", icon: Lock, staffRoles: SUPPORT },
      { href: "/ops/employers", label: "nav.ops_employers", icon: Building, staffRoles: VERIFIER },
      { href: "/ops/references", label: "nav.ops_references", icon: UserCheck, staffRoles: VERIFIER },
      { href: "/ops/risk", label: "nav.ops_risk", icon: ShieldAlert, staffRoles: ["risk_analyst"] },
      { href: "/ops/support", label: "nav.ops_support", icon: LifeBuoy, staffRoles: SUPPORT },
    ],
  },
  {
    label: "ledger.nav.ops_ecosystem",
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
    label: "ledger.nav.ops_admin",
    items: [
      { href: "/ops/audit", label: "nav.ops_audit", icon: ScrollText, staffRoles: SUPERADMIN },
      { href: "/ops/staff", label: "nav.ops_staff", icon: ClipboardList, staffRoles: SUPERADMIN },
      { href: "/ops/taxonomy", label: "nav.ops_taxonomy", icon: Tags, staffRoles: SUPERADMIN },
      { href: "/ops/system", label: "nav.ops_system", icon: Activity, staffRoles: SUPERADMIN },
      { href: "/ops/notifications", label: "nav.ops_notifications", icon: BellRing, staffRoles: SUPPORT },
      { href: "/ops/flags", label: "nav.ops_flags", icon: ToggleRight, staffRoles: SUPERADMIN },
      { href: "/ops/matching", label: "nav.ops_matching", icon: SlidersHorizontal, staffRoles: SUPERADMIN },
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

/** Drop items whose feature flag is off (unknown/missing flags count as off). */
export function filterNavByFlags(nav: NavGroup[], flags: Record<string, boolean> | null | undefined): NavGroup[] {
  return nav
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.flag || !!flags?.[i.flag]) }))
    .filter((g) => g.items.length > 0);
}

function splitHref(href: string): { path: string; query: URLSearchParams | null } {
  const i = href.indexOf("?");
  return i < 0 ? { path: href, query: null } : { path: href.slice(0, i), query: new URLSearchParams(href.slice(i + 1)) };
}

/**
 * Does the current location match this item? Items may carry a query (`/app/settings?tab=sites`):
 * they match only when every listed param matches. Without `search`, query items never match.
 */
export function isActive(pathname: string, item: NavItem, search?: URLSearchParams | null): boolean {
  const { path, query } = splitHref(item.href);
  if (query) {
    if (pathname !== path || !search) return false;
    for (const [k, v] of query) if (search.get(k) !== v) return false;
    return true;
  }
  if (item.exact) return pathname === path;
  return pathname === path || pathname.startsWith(path + "/");
}

/**
 * The single nav item to highlight: the most specific match, so `/app/attendance/corrections`
 * highlights Corrections (not Hajiri too) and `/app/settings?tab=sites` highlights Work sites.
 */
export function activeHref(
  items: readonly NavItem[],
  pathname: string,
  search?: URLSearchParams | null,
): string | null {
  let best: { href: string; score: number } | null = null;
  for (const item of items) {
    if (!isActive(pathname, item, search)) continue;
    const { path, query } = splitHref(item.href);
    const score = path.length * 10 + (query ? 5 : 0);
    if (!best || score > best.score) best = { href: item.href, score };
  }
  return best?.href ?? null;
}
