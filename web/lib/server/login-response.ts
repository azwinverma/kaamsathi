import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { Me } from "@/lib/api/types";
import { LOCALE_COOKIE, ORG_COOKIE, setAuthCookies, setOrgCookie } from "./session";

/**
 * Turn a backend `{access, refresh, user}` token response into the browser response:
 * tokens go into httpOnly cookies, the browser only gets the user. Shared by OTP and MFA verify.
 */
export function loginResponse(req: NextRequest, data: unknown): NextResponse {
  const { access, refresh, user } = data as { access: string; refresh: string; user: Me };
  const res = NextResponse.json({ user }, { status: 200 });
  setAuthCookies(res, { access, refresh });
  const current = req.cookies.get(ORG_COOKIE)?.value;
  const memberships = user?.memberships ?? [];
  if (memberships.length && !memberships.some((m) => m.organization.id === current)) {
    setOrgCookie(res, memberships[0].organization.id);
  }
  if (
    !req.cookies.get(LOCALE_COOKIE) &&
    (user?.preferred_language === "ne" || user?.preferred_language === "en")
  ) {
    res.cookies.set(LOCALE_COOKIE, user.preferred_language, {
      path: "/",
      sameSite: "lax",
      maxAge: 31536000,
    });
  }
  return res;
}

export function hasTokens(data: unknown): boolean {
  return !!data && typeof data === "object" && "access" in data;
}
