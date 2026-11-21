import { NextRequest } from "next/server";
import {
  authenticateMobileRequest,
  mobileError,
  mobileSuccess,
} from "@/lib/mobile-api";
import { portalSnapshot } from "@/lib/portal/snapshot";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const auth = await authenticateMobileRequest(req, { allowPortalRoles: true });
  if (!auth.ok) return auth.response;
  const { ctx, adminClient: db } = auth;
  if (
    ctx.permCtx?.status !== "ACTIVE" ||
    ctx.userRow?.madrasa_id !== ctx.madrasaId
  )
    return mobileError("অনুমতি নেই।", 403, "FORBIDDEN");
  try {
    const data = await portalSnapshot(
      {
        db,
        tenant: ctx.madrasaId,
        user: ctx.user,
        userRow: ctx.userRow,
        perms: ctx.permCtx,
      },
      "student",
      req.nextUrl.searchParams.get("student_id"),
    );
    return data
      ? mobileSuccess(data, "Success", undefined, 200, req)
      : mobileError("অনুমতি নেই।", 403, "FORBIDDEN");
  } catch (err) {
    console.error("Portal snapshot failed", err);
    return mobileError("পোর্টালের তথ্য লোড হয়নি।", 500, "READ_FAILED");
  }
}
