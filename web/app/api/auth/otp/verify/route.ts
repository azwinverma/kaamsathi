import { NextResponse, type NextRequest } from "next/server";
import { isMfaChallenge } from "@/lib/api/types-security";
import { hasTokens, loginResponse } from "@/lib/server/login-response";
import { rejectCrossSite } from "@/lib/server/origin";
import { backendJson, LOCALE_COOKIE } from "@/lib/server/session";

export async function POST(req: NextRequest) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const body = (await req.json().catch(() => ({}))) as { phone?: unknown; code?: unknown };
  const { status, data } = await backendJson("/auth/otp/verify", {
    method: "POST",
    body: { phone: String(body.phone ?? ""), code: String(body.code ?? "") },
    lang: req.cookies.get(LOCALE_COOKIE)?.value,
    from: req.headers,
  });
  // Staff with MFA enabled: no tokens yet — pass the short-lived challenge through, set no cookies.
  if (status === 200 && isMfaChallenge(data)) {
    return NextResponse.json({ mfa_required: true, mfa_token: data.mfa_token }, { status: 200 });
  }
  if (status !== 200 || !hasTokens(data)) {
    return NextResponse.json(data, { status: status === 200 ? 502 : status });
  }
  return loginResponse(req, data);
}
