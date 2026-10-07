import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS home-screen icon (PNG; iOS ignores SVG icons). Prerendered at build. */
export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#2647C4" }}>
      <svg viewBox="0 0 32 32" width="180" height="180">
        <rect width="32" height="32" fill="#2647C4" />
        <path
          d="M10 8v16M10 16.5 19.5 8M13.5 13.5 21 24"
          stroke="#fff"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx="23.5" cy="9.5" r="2.5" fill="#DC2B4B" />
      </svg>
    </div>,
    size,
  );
}
