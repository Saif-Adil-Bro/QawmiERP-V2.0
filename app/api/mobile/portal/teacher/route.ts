import { teacherRoles, studentRoles } from "@/lib/portal/rules";
import { hasRole } from "@/lib/portal/identity";
import { staffScope } from "@/lib/hifz/access";
import { writeHifz } from "@/lib/hifz/write";
import { EntryError } from "@/lib/hifz/entries";
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
      "teacher",
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

/** Bearer-only clients use the same mutation contract as the WebView's cookie route. */
export async function POST(req: NextRequest) {
  const auth = await authenticateMobileRequest(req, {
    module: "hifz",
    requireWrite: true,
    allowPortalRoles: true,
    portalSyncOwner: "teacher",
  });
  if (!auth.ok) return auth.response;
  const { ctx, adminClient: db } = auth;
  if (
    ctx.permCtx?.status !== "ACTIVE" ||
    ctx.userRow.madrasa_id !== ctx.madrasaId
  )
    return mobileError("অনুমতি নেই।", 403);
  const i = {
    db,
    tenant: ctx.madrasaId,
    user: ctx.user,
    userRow: ctx.userRow,
    perms: ctx.permCtx,
  };
  if (!hasRole(i, teacherRoles) || hasRole(i, studentRoles))
    return mobileError("শিক্ষকের অনুমতি প্রয়োজন।", 403);
  try {
    const body = await req.json();
    if (!body.current_class_id || body.current_class_id === "All")
      throw new EntryError("জামাত নির্বাচন করুন।");
    const c = await staffScope(i, body.current_class_id);
    if (!c.roster.length) throw new EntryError("এই জামাতের অনুমতি নেই।", 403);
    return mobileSuccess(await writeHifz(c, body), "সংরক্ষিত");
  } catch (e) {
    return mobileError(
      e instanceof EntryError ? e.message : "হিফজ এন্ট্রি সংরক্ষণ হয়নি।",
      e instanceof EntryError ? e.status : 500,
    );
  }
}
