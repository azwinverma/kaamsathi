import { ImageResponse } from "next/og";

export const alt = "KaamSathi — Verified workers. On-time pay.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Static Open Graph card (prerendered at build). Latin text only: the bundled OG font has no Devanagari. */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        background: "linear-gradient(135deg, #142a7a 0%, #2647C4 100%)",
        color: "#ffffff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <svg viewBox="0 0 32 32" width="96" height="96">
          <rect width="32" height="32" rx="8" fill="#ffffff" />
          <path
            d="M10 8v16M10 16.5 19.5 8M13.5 13.5 21 24"
            stroke="#2647C4"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <circle cx="23.5" cy="9.5" r="2.5" fill="#DC2B4B" />
        </svg>
        <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: -1 }}>KaamSathi</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.1 }}>
          Verified workers. On-time pay.
        </div>
        <div style={{ fontSize: 32, opacity: 0.85 }}>
          Hire, manage and pay your workforce in Nepal
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 26, opacity: 0.8 }}>
        <div style={{ width: 14, height: 14, borderRadius: 7, background: "#DC2B4B" }} />
        Workers never pay a fee
      </div>
    </div>,
    size,
  );
}
