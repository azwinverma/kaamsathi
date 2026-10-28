import { NextResponse, type NextRequest } from "next/server";
import { rejectCrossSite } from "@/lib/server/origin";
import { ACCESS_COOKIE, REFRESH_COOKIE, backendJson, clearAuthCookies } from "@/lib/server/session";

export async function POST(req: NextRequest) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;
  const access = req.cookies.get(ACCESS_COOKIE)?.value;
  if (refresh) {
    // Best effort blacklist; we clear cookies regardless.
    await backendJson("/auth/logout", { method: "POST", body: { refresh }, access, from: req.headers });
  }
  const res = NextResponse.json({ ok: true });
  clearAuthCookies(res);
  return res;
}
