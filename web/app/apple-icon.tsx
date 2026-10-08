import { ImageResponse } from "next/og";
import { MARK } from "@/lib/brand-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS home-screen icon (PNG; iOS ignores SVG icons and applies its own corner mask). Prerendered at build. */
export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: MARK.hex.tile }}>
      <svg viewBox="0 0 32 32" width="180" height="180">
        <rect width="32" height="32" fill={MARK.hex.tile} />
        <path
          d={MARK.k}
          stroke={MARK.hex.k}
          strokeWidth={MARK.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx={MARK.sun.cx} cy={MARK.sun.cy} r={MARK.sun.r} fill={MARK.hex.sun} />
      </svg>
    </div>,
    size,
  );
}
