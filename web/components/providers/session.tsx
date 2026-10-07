"use client";
import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useMe } from "@/lib/api/hooks/auth";
import { setUnauthenticatedHandler } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { Me, Membership, Role } from "@/lib/api/types";
import { ORG_COOKIE } from "@/lib/cookies";
import { readCookie } from "@/lib/utils";

interface SessionValue {
  me: Me;
  membership: Membership | null;
  orgId: string | null;
  role: Role | null;
  /** owner/admin/hr = full org access. */
  canManage: boolean;
  /** owner/admin = members & billing. */
  isAdmin: boolean;
  isSupervisor: boolean;
  switchOrg: (orgId: string) => Promise<void>;
}

const SessionContext = React.createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const ctx = React.useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}

/** Optional variant for components rendered both inside and outside the shell. */
export function useOptionalSession(): SessionValue | null {
  return React.useContext(SessionContext);
}

async function postOrg(orgId: string) {
  await fetch("/api/auth/org", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ org_id: orgId }),
    credentials: "same-origin",
  });
}

export function SessionProvider({
  children,
  fallback,
  requireOrg = true,
  requireStaff = false,
  forbidden,
  renderError,
}: {
  children: React.ReactNode;
  fallback: React.ReactNode;
  requireOrg?: boolean;
  requireStaff?: boolean;
  forbidden?: React.ReactNode;
  renderError?: (error: unknown, retry: () => void) => React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const { data: me, error, isLoading, refetch } = useMe();
  const [orgId, setOrgId] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    setUnauthenticatedHandler(() => {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    });
    return () => setUnauthenticatedHandler(null);
  }, [router, pathname]);

  React.useEffect(() => {
    if (error instanceof ApiError && error.status === 401) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [error, router, pathname]);

  // Resolve active org from cookie; fall back to first membership.
  React.useEffect(() => {
    if (!me) return;
    const memberships = me.memberships ?? [];
    if (requireOrg && memberships.length === 0) {
      router.replace(me.is_staff ? "/ops" : "/onboarding");
      return;
    }
    const cookie = readCookie(ORG_COOKIE);
    const valid = memberships.find((m) => m.organization.id === cookie);
    if (valid) {
      setOrgId(valid.organization.id);
      setReady(true);
    } else if (memberships[0]) {
      const id = memberships[0].organization.id;
      postOrg(id).then(() => {
        setOrgId(id);
        qc.removeQueries({ queryKey: ["org"] });
        setReady(true);
      });
    } else {
      setReady(true);
    }
  }, [me, requireOrg, router, qc]);

  const switchOrg = React.useCallback(
    async (id: string) => {
      await postOrg(id);
      setOrgId(id);
      qc.removeQueries({ queryKey: ["org"] });
      router.push("/app");
    },
    [qc, router],
  );

  const value = React.useMemo<SessionValue | null>(() => {
    if (!me) return null;
    const membership = me.memberships?.find((m) => m.organization.id === orgId) ?? null;
    const role = membership?.role ?? null;
    return {
      me,
      membership,
      orgId,
      role,
      canManage: role === "owner" || role === "admin" || role === "hr",
      isAdmin: role === "owner" || role === "admin",
      isSupervisor: role === "supervisor",
      switchOrg,
    };
  }, [me, orgId, switchOrg]);

  if (error && !(error instanceof ApiError && error.status === 401)) {
    return <>{renderError ? renderError(error, () => void refetch()) : fallback}</>;
  }
  if (isLoading || !value || (requireOrg && !ready)) return <>{fallback}</>;
  if (requireStaff && !value.me.is_staff) return <>{forbidden ?? fallback}</>;
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
