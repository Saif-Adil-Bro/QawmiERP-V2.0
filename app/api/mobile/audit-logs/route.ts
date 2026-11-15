import { NextRequest } from "next/server";
import { authenticateMobileRequest, mobileSuccess, parsePagination } from "@/lib/mobile-api";
import { readJsonStore } from "@/lib/madrasa-store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateMobileRequest(req, {
    module: "users",
    requireWrite: false,
  });
  if (!auth.ok) return auth.response;

  const { page, limit } = parsePagination(req);
  const store = await readJsonStore(auth.ctx.madrasaId, "security");
  const logs: any[] = Array.isArray(store.security_audit_logs)
    ? store.security_audit_logs
    : [];

  const total = logs.length;
  const start = (page - 1) * limit;
  const paged = logs.slice(start, start + limit);

  return mobileSuccess(
    paged,
    "Success",
    {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    200,
    req
  );
}
