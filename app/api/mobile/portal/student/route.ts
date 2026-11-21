import { z } from "zod";
import { acknowledgeLinkedCase } from "@/lib/student-health/portal";
import { HealthError } from "@/lib/student-health/store";
import { NextRequest } from "next/server";
import {
  authenticateMobileRequest,
  mobileError,
  mobileSuccess,
} from "@/lib/mobile-api";
import { portalSnapshot } from "@/lib/portal/snapshot";
export const dynamic = "force-dynamic";
const ackSchema = z.object({
  record_id: z.string().uuid(),
  updated_at: z.string().max(64).optional(),
});
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

/** Native family acknowledgment. Offline reads do not queue a receipt. */
export async function POST(req: NextRequest) {
  const auth = await authenticateMobileRequest(req, { allowPortalRoles: true });
  if (!auth.ok) return auth.response;
  const { ctx, adminClient: db } = auth;
  if (
    !ctx.permCtx ||
    ctx.permCtx.status !== "ACTIVE" ||
    ctx.userRow?.madrasa_id !== ctx.madrasaId
  )
    return mobileError("অনুমতি নেই।", 403, "FORBIDDEN");
  const parsed = ackSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return mobileError("অবৈধ স্বাস্থ্য নথি।", 400, "INVALID_RECORD");
  try {
    await acknowledgeLinkedCase(
      {
        db,
        user: ctx.user,
        userRow: ctx.userRow,
        tenant: ctx.madrasaId,
        perms: ctx.permCtx,
      },
      parsed.data.record_id,
      parsed.data.updated_at,
    );
    return mobileSuccess(
      { acknowledged: true },
      "প্রাপ্তি নিশ্চিত হয়েছে।",
      undefined,
      200,
      req,
    );
  } catch (e) {
    return e instanceof HealthError
      ? mobileError(e.message, 403, "NOT_ACKNOWLEDGED")
      : mobileError("প্রাপ্তি সংরক্ষণ করা যায়নি।", 500, "WRITE_FAILED");
  }
}
