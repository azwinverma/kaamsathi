import {
  Banknote,
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
    ],
  },
  {
    label: "nav.pay",
    items: [{ href: "/app/payroll", label: "nav.payroll", icon: Banknote, roles: FULL }],
  },
  {
    label: "nav.account",
    items: [
      { href: "/app/settings", label: "nav.settings", icon: Settings, roles: FULL },
      { href: "/app/billing", label: "nav.billing", icon: CreditCard, roles: ADMIN },
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
];

export function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}
