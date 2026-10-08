"use client";
import { SessionProvider } from "@/components/providers/session";
import { Shell, ShellSkeleton } from "@/components/shell/shell";
import { Forbidden, ShellError } from "@/components/shell/shell-error";
import { OPS_NAV } from "@/components/shell/nav";
import { MfaGate } from "@/components/security/mfa-required-notice";
import { LegalGate } from "@/components/security/legal-accept";

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider
      requireOrg={false}
      requireStaff
      fallback={<ShellSkeleton />}
      forbidden={<Forbidden />}
      renderError={(error, retry) => <ShellError error={error} retry={retry} />}
    >
      <LegalGate>
        <Shell nav={OPS_NAV} variant="ops">
          <MfaGate>{children}</MfaGate>
        </Shell>
      </LegalGate>
    </SessionProvider>
  );
}
