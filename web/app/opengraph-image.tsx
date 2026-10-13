import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { cookies } from "next/headers";
import manifest from "@/assets/og/manifest.json";
import { bolauLive } from "@/lib/bolau/live";
import { MARK } from "@/lib/brand-mark";
import { LOCALE_COOKIE } from "@/lib/cookies";
import { ogBrand, ogCopy, ogVariant } from "@/lib/marketing/og";

export const alt = "KaamSathi (कामसाथी) — Nepal's verified Sipalu and workers";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Flag- and locale-aware, so rendered per request (bolauLive() itself is cached for a minute); a
// build-time prerender would freeze whatever the flag was while building.
export const dynamic = "force-dynamic";

type NeKey = keyof typeof manifest.items;

/** A pre-shaped Nepali line (see lib/marketing/og.ts) as an <img>, optionally scaled. */
async function nepali(key: NeKey, scale = 1) {
  const item = manifest.items[key];
  const png = await readFile(join(process.cwd(), "assets", "og", item.file));
  return (
    <img
      src={`data:image/png;base64,${png.toString("base64")}`}
      width={Math.round(item.width * scale)}
      height={Math.round(item.height * scale)}
      alt=""
    />
  );
}

/**
 * Open Graph card. Leads with Bolau while the `bolau` flag is on, else the employer line. Bilingual:
 * with the locale cookie `ne` the Nepali lines lead (English title below, small); otherwise — and
 * for link-preview crawlers, which send no cookie — English leads with the Nepali title below.
 */
export default async function OpengraphImage() {
  const bolau = await bolauLive();
  const variant = ogVariant(bolau);
  const ne = (await cookies()).get(LOCALE_COOKIE)?.value === "ne";
  const en = ogCopy(bolau, "en");

  const brand = ne ? (
    await nepali("brand")
  ) : (
    <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: -1 }}>{ogBrand("en")}</div>
  );
  const lead = ne ? (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {await nepali(`${variant}.title`)}
      <div style={{ fontSize: 30, fontWeight: 700, opacity: 0.8 }}>{en.title}</div>
      {await nepali(`${variant}.body`)}
    </div>
  ) : (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.1 }}>{en.title}</div>
      <div style={{ display: "flex", opacity: 0.85 }}>{await nepali(`${variant}.title`, 0.6)}</div>
      <div style={{ fontSize: 32, opacity: 0.85 }}>{en.body}</div>
    </div>
  );
  const foot = ne ? await nepali(`${variant}.foot`) : en.foot;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 80px",
        background: "linear-gradient(135deg, #2563EB 0%, #4F46E5 55%, #7C3AED 100%)",
        color: "#ffffff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <svg viewBox="0 0 32 32" width="96" height="96">
          <rect width="32" height="32" rx={MARK.radius} fill="#ffffff" />
          <path
            d={MARK.k}
            stroke="#2563EB"
            strokeWidth={MARK.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <circle cx={MARK.sun.cx} cy={MARK.sun.cy} r={MARK.sun.r} fill={MARK.hex.sun} />
        </svg>
        {brand}
      </div>
      {lead}
      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 26, opacity: 0.8 }}>
        <div style={{ width: 14, height: 14, borderRadius: 7, background: "#FF6B6B" }} />
        {foot}
      </div>
    </div>,
    size,
  );
}
