import { NextResponse, type NextRequest } from "next/server";
import { setOrgCookie } from "@/lib/server/session";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Select the active organization. The backend re-validates membership on every /org request. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { org_id?: unknown };
  const orgId = typeof body.org_id === "string" ? body.org_id : "";
  if (!UUID_RE.test(orgId)) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Invalid organization.", fields: { org_id: ["Invalid organization."] } } },
      { status: 400 },
    );
  }
  const res = NextResponse.json({ ok: true });
  setOrgCookie(res, orgId);
  return res;
}
