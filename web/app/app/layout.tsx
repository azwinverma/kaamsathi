"use client";
import { SessionProvider } from "@/components/providers/session";
import { Shell, ShellSkeleton } from "@/components/shell/shell";
import { ShellError } from "@/components/shell/shell-error";
import { APP_NAV } from "@/components/shell/nav";
import { LegalGate } from "@/components/security/legal-accept";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider
      fallback={<ShellSkeleton />}
      renderError={(error, retry) => <ShellError error={error} retry={retry} />}
    >
      <LegalGate>
        <Shell nav={APP_NAV} variant="app">
          {children}
        </Shell>
      </LegalGate>
    </SessionProvider>
  );
}
