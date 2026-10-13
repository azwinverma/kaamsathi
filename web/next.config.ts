import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const isDev = process.env.NODE_ENV !== "production";

/**
 * Everything below is evaluated by `next build` and baked into `.next/routes-manifest.json`, which
 * the standalone server (`output: "standalone"`) serves as-is — no runtime env is read here.
 * NEXT_PUBLIC_SITE_URL (also inlined at build time) decides whether the site is served over HTTPS;
 * unset counts as HTTPS (secure default). An explicit http:// URL (e.g. a local docker smoke test)
 * drops HSTS + upgrade-insecure-requests so same-origin assets are not force-upgraded.
 */
const siteIsHttps = !/^http:\/\//i.test(process.env.NEXT_PUBLIC_SITE_URL ?? "");
const enforceHttps = !isDev && siteIsHttps;

/**
 * CSP: all API traffic goes through same-origin BFF routes, so connect-src can stay 'self'.
 * Next.js App Router injects inline bootstrap scripts, hence 'unsafe-inline' for script-src
 * (a nonce-based CSP would force every page to render dynamically).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "worker-src 'self' blob:",
  ...(enforceHttps ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  ...(enforceHttps
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: false,
  // The OG card reads its pre-shaped Nepali lines from disk (app/opengraph-image.tsx); make sure
  // the standalone output carries them.
  outputFileTracingIncludes: { "/opengraph-image": ["./assets/og/**"] },
  async headers() {
    // "/:path*" also matches "/" and metadata routes (robots.txt, sitemap.xml, icons, OG image).
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async rewrites() {
    // Browsers probe /favicon.ico regardless of <link rel="icon">; serve the SVG mark instead of a 404.
    return [{ source: "/favicon.ico", destination: "/icon.svg" }];
  },
};

export default withNextIntl(nextConfig);
