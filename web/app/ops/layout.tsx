"use client";
import { SessionProvider } from "@/components/providers/session";
import { Shell, ShellSkeleton } from "@/components/shell/shell";
import { Forbidden, ShellError } from "@/components/shell/shell-error";
import { OPS_NAV } from "@/components/shell/nav";

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider
      requireOrg={false}
      requireStaff
      fallback={<ShellSkeleton />}
      forbidden={<Forbidden />}
      renderError={(error, retry) => <ShellError error={error} retry={retry} />}
    >
      <Shell nav={OPS_NAV} variant="ops">
        {children}
      </Shell>
    </SessionProvider>
  );
}
