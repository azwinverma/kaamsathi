import { ImageResponse } from "next/og";
import { bolauLive } from "@/lib/bolau/live";
import { MARK } from "@/lib/brand-mark";
import { ogCopy } from "@/lib/marketing/home-layout";

export const alt = "KaamSathi — Nepal's verified Sipalu and workers";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Flag-aware, so rendered per request (bolauLive() itself is cached for a minute); a build-time
// prerender would freeze whatever the flag was while building.
export const dynamic = "force-dynamic";

/** Open Graph card. Leads with Bolau while the `bolau` flag is on, else the employer line. */
export default async function OpengraphImage() {
  const copy = ogCopy(await bolauLive());
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
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
        <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: -1 }}>KaamSathi</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.1 }}>
          {copy.title}
        </div>
        <div style={{ fontSize: 32, opacity: 0.85 }}>{copy.body}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 26, opacity: 0.8 }}>
        <div style={{ width: 14, height: 14, borderRadius: 7, background: "#FF6B6B" }} />
        {copy.foot}
      </div>
    </div>,
    size,
  );
}
