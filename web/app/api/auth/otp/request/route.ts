import { NextResponse, type NextRequest } from "next/server";
import { rejectCrossSite } from "@/lib/server/origin";
import { backendJson, LOCALE_COOKIE } from "@/lib/server/session";

export async function POST(req: NextRequest) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const body = (await req.json().catch(() => ({}))) as { phone?: unknown };
  const phone = typeof body.phone === "string" ? body.phone : "";
  const { status, data } = await backendJson("/auth/otp/request", {
    method: "POST",
    body: { phone },
    lang: req.cookies.get(LOCALE_COOKIE)?.value,
  });
  return NextResponse.json(data, { status });
}
