import { NextResponse, type NextRequest } from "next/server";
import { hasTokens, loginResponse } from "@/lib/server/login-response";
import { rejectCrossSite } from "@/lib/server/origin";
import { backendJson, LOCALE_COOKIE } from "@/lib/server/session";

/** Second login factor: exchange the MFA challenge token + TOTP / recovery code for a session. */
export async function POST(req: NextRequest) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const body = (await req.json().catch(() => ({}))) as {
    mfa_token?: unknown;
    code?: unknown;
    recovery_code?: unknown;
  };
  const payload: Record<string, string> = { mfa_token: String(body.mfa_token ?? "") };
  if (typeof body.recovery_code === "string" && body.recovery_code.trim()) {
    payload.recovery_code = body.recovery_code.trim();
  } else {
    payload.code = String(body.code ?? "");
  }
  const { status, data } = await backendJson("/auth/mfa/verify", {
    method: "POST",
    body: payload,
    lang: req.cookies.get(LOCALE_COOKIE)?.value,
  });
  if (status !== 200 || !hasTokens(data)) {
    return NextResponse.json(data, { status: status === 200 ? 502 : status });
  }
  return loginResponse(req, data);
}
