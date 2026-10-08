# ADR 0008: Caddy instead of Nginx

- Status: accepted
- Date: 2026-10-07 (recorded 2026-10-08; decision taken earlier in the build)

## Context

Single-server production needs TLS for two domains (web + API), HTTP/2, security headers, gzip and
a reverse proxy to Next.js and gunicorn, run by a small team without a dedicated ops engineer.

## Decision

`deploy/Caddyfile` with Caddy 2 in docker-compose: automatic Let's Encrypt certificates and renewal,
HSTS and security headers, reverse proxy to `web:3000` and `backend:8000`, request size limits.

## Consequences

+ Zero-touch TLS, short readable config, fewer foot-guns than hand-written Nginx + certbot.
− Smaller community than Nginx for edge cases; rate limiting stays in the app (DRF throttles) and
any CDN/WAF in front (e.g. Cloudflare) rather than in the proxy.
