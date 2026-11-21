import { SessionUnavailableError } from "@/lib/current-app-session";
import { webIdentity } from "@/lib/portal/identity";
import { portalSnapshot } from "@/lib/portal/snapshot";
import { privateResponseHeaders as headers } from "@/lib/private-response";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const i = await webIdentity(true);
    if (!i) return new Response(null, { status: 401, headers });
    const q = new URL(req.url).searchParams,
      portal = q.get("portal");
    if (portal !== "student" && portal !== "teacher")
      return new Response(null, { status: 400, headers });
    const data = await portalSnapshot(i, portal, q.get("student_id"));
    if (!data) return new Response(null, { status: 403, headers });
    return Response.json({ data }, { headers });
  } catch (err) {
    return new Response(null, {
      status: err instanceof SessionUnavailableError ? 503 : 500,
      headers,
    });
  }
}
