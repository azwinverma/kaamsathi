import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BolauChrome } from "@/components/bolau/chrome";
import { GharShell } from "@/components/bolau/ghar-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("bolau.meta");
  return { title: t("ghar_title"), robots: { index: false, follow: false } };
}

/** Ghardhani area (B frame, calm content). Session required (middleware); hidden when `bolau` is off. */
export default function GharLayout({ children }: { children: React.ReactNode }) {
  return (
    <BolauChrome>
      <GharShell>{children}</GharShell>
    </BolauChrome>
  );
}
