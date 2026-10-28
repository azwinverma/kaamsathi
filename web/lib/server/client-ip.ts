/**
 * Relay the end user's IP to the API (backend/apps/core/proxy_ip.py). Every BFF call reaches
 * Django from this server, so without it OTP throttles and the audit log would see the web host's
 * address for every user. The API trusts the relayed IP only with the shared BFF_PROXY_SECRET.
 */

/** The client IP as seen by our edge: Vercel sets x-forwarded-for / x-real-ip to the client
 * itself; Caddy appends the peer address, so the rightmost entry is the one our proxy added. */
export function clientIpFrom(headers: Headers): string | null {
  const fwd = headers.get("x-forwarded-for");
  const last = fwd
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .pop();
  return last || headers.get("x-real-ip")?.trim() || null;
}

/** Headers for a backend call on behalf of `headers`' sender; empty when no secret is set. */
export function clientIpRelayHeaders(
  headers: Headers,
  secret: string | undefined = process.env.BFF_PROXY_SECRET,
): Record<string, string> {
  const ip = clientIpFrom(headers);
  if (!secret || !ip) return {};
  return { "X-KaamSathi-Client-IP": ip, "X-KaamSathi-Proxy-Secret": secret };
}
