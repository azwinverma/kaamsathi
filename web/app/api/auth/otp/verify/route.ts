import { NextResponse, type NextRequest } from "next/server";
import type { Me } from "@/lib/api/types";
import { backendJson, LOCALE_COOKIE, ORG_COOKIE, setAuthCookies, setOrgCookie } from "@/lib/server/session";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { phone?: unknown; code?: unknown };
  const { status, data } = await backendJson("/auth/otp/verify", {
    method: "POST",
    body: { phone: String(body.phone ?? ""), code: String(body.code ?? "") },
    lang: req.cookies.get(LOCALE_COOKIE)?.value,
  });
  if (status !== 200 || !data || typeof data !== "object" || !("access" in data)) {
    return NextResponse.json(data, { status: status === 200 ? 502 : status });
  }
  const { access, refresh, user } = data as { access: string; refresh: string; user: Me };
  // Tokens stay in httpOnly cookies; the browser only gets the user.
  const res = NextResponse.json({ user }, { status: 200 });
  setAuthCookies(res, { access, refresh });
  const current = req.cookies.get(ORG_COOKIE)?.value;
  const memberships = user?.memberships ?? [];
  if (memberships.length && !memberships.some((m) => m.organization.id === current)) {
    setOrgCookie(res, memberships[0].organization.id);
  }
  if (!req.cookies.get(LOCALE_COOKIE) && (user?.preferred_language === "ne" || user?.preferred_language === "en")) {
    res.cookies.set(LOCALE_COOKIE, user.preferred_language, { path: "/", sameSite: "lax", maxAge: 31536000 });
  }
  return res;
}
