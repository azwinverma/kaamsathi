import {
  Activity,
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

export interface NavItem {
  href: string;
  /** message key */
  label: string;
  icon: LucideIcon;
  roles?: Role[];
  exact?: boolean;
}
export interface NavGroup {
  label?: string;
  items: NavItem[];
}

const FULL: Role[] = ["owner", "admin", "hr"];
const ADMIN: Role[] = ["owner", "admin"];

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
      { href: "/ops/workers", label: "nav.ops_workers", icon: Users },
      { href: "/ops/verification", label: "nav.ops_verification", icon: ShieldCheck },
      { href: "/ops/jobs", label: "nav.ops_jobs", icon: Briefcase },
      { href: "/ops/organizations", label: "nav.ops_organizations", icon: Building2 },
    ],
  },
  {
    label: "nav.ops_trust",
    items: [
      { href: "/ops/credentials", label: "nav.ops_credentials", icon: BadgeCheck },
      { href: "/ops/disputes", label: "nav.ops_disputes", icon: FileWarning },
      { href: "/ops/crews", label: "nav.ops_crews", icon: UsersRound },
      { href: "/ops/privacy", label: "nav.ops_privacy", icon: Lock },
      { href: "/ops/employers", label: "nav.ops_employers", icon: Building },
      { href: "/ops/references", label: "nav.ops_references", icon: UserCheck },
      { href: "/ops/risk", label: "nav.ops_risk", icon: ShieldAlert },
      { href: "/ops/support", label: "nav.ops_support", icon: LifeBuoy },
    ],
  },
  {
    label: "nav.ops_ecosystem",
    items: [
      { href: "/ops/training", label: "nav.ops_training", icon: GraduationCap },
      { href: "/ops/partners", label: "nav.ops_partners", icon: Handshake },
      { href: "/ops/finance", label: "nav.ops_finance", icon: Landmark },
      { href: "/ops/insights", label: "nav.ops_insights", icon: LineChart },
      { href: "/ops/kpis", label: "nav.ops_kpis", icon: Gauge },
      { href: "/ops/mobility", label: "nav.ops_mobility", icon: Plane },
    ],
  },
  {
    label: "nav.ops_admin",
    items: [
      { href: "/ops/audit", label: "nav.ops_audit", icon: ScrollText },
      { href: "/ops/staff", label: "nav.ops_staff", icon: ClipboardList },
      { href: "/ops/taxonomy", label: "nav.ops_taxonomy", icon: Tags },
      { href: "/ops/system", label: "nav.ops_system", icon: Activity },
      { href: "/ops/account", label: "nav.account_security", icon: KeyRound },
    ],
  },
];

export function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}
