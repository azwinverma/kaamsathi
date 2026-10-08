"use client";
import * as React from "react";
import { MARK } from "@/lib/brand-mark";

/**
 * Last-resort boundary: replaces the root layout, so no providers, fonts or globals.css.
 * Text is inlined in both languages; styles are inline (style-src allows 'unsafe-inline').
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Devanagari", sans-serif',
          background: "#F8FAFC",
          color: "#0F172A",
          textAlign: "center",
        }}
      >
        <main role="alert" style={{ maxWidth: 440 }}>
          <svg
            viewBox="0 0 32 32"
            width="48"
            height="48"
            aria-hidden
            style={{ display: "block", margin: "0 auto 20px" }}
          >
            <rect width="32" height="32" rx={MARK.radius} fill="#2563EB" />
            <path
              d={MARK.k}
              stroke="#fff"
              strokeWidth={MARK.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <circle cx={MARK.sun.cx} cy={MARK.sun.cy} r={MARK.sun.r} fill={MARK.hex.sun} />
          </svg>
          <h1 style={{ fontSize: 22, margin: "0 0 6px", fontWeight: 600 }}>Something went wrong</h1>
          <p lang="ne" style={{ fontSize: 20, margin: "0 0 16px", fontWeight: 600 }}>
            केही गडबड भयो
          </p>
          <p style={{ margin: "0 0 4px", color: "#334155" }}>
            An unexpected error occurred. Please try again.
          </p>
          <p lang="ne" style={{ margin: 0, color: "#334155" }}>
            अनपेक्षित त्रुटि भयो। कृपया फेरि प्रयास गर्नुहोस्।
          </p>
          {error.digest ? (
            <p style={{ marginTop: 12, fontSize: 12, color: "#5A6679" }}>
              Reference / सन्दर्भ: {error.digest}
            </p>
          ) : null}
          <div
            style={{
              marginTop: 28,
              display: "flex",
              gap: 8,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => reset()}
              style={{
                height: 40,
                padding: "0 16px",
                borderRadius: 6,
                border: 0,
                background: "#2563EB",
                color: "#fff",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Try again · फेरि प्रयास गर्नुहोस्
            </button>
            {/* Full reload on purpose: the app shell itself failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                height: 40,
                padding: "0 16px",
                borderRadius: 6,
                border: "1px solid #CBD5E1",
                background: "#fff",
                color: "#0F172A",
                fontSize: 14,
                fontWeight: 500,
                display: "inline-flex",
                alignItems: "center",
                textDecoration: "none",
              }}
            >
              Home · गृहपृष्ठ
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
