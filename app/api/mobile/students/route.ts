import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest, createMobileTableHandlers } from "@/lib/mobile-api";
import { loadServerPermissions } from "@/lib/permissions-server";
import { canViewUnmaskedField, maskStudentSensitiveFields } from "@/lib/data-access-guards";

export const dynamic = "force-dynamic";

const { GET: baseGET, POST } = createMobileTableHandlers({
  table: "students",
  module: "students",
  select: "*, classes(id, name)",
  detailSelect: "*, classes(id, name)",
  searchColumns: ["full_name", "roll_number", "guardian_name", "parent_phone", "student_id_code"],
  filterColumns: ["class_id", "status", "gender"],
  defaultSort: "created_at",
  requiredFields: ["full_name", "class_id"],
});

export async function GET(req: NextRequest) {
  const res = await baseGET(req);
  if (!res.ok) return res;

  try {
    let allowUnmasked = false;
    const auth = await authenticateMobileRequest(req);
    if (auth.ok && auth.ctx.madrasaId) {
      const permCtx = await loadServerPermissions(auth.ctx.userId, auth.ctx.madrasaId);
      allowUnmasked = canViewUnmaskedField(permCtx?.summary, "students", "phone");
    }

    if (allowUnmasked) return res;

    const body = await res.json();
    if (Array.isArray(body?.data)) {
      body.data = body.data.map((row: any) => maskStudentSensitiveFields(row, false));
    } else if (body?.data && typeof body.data === "object") {
      body.data = maskStudentSensitiveFields(body.data, false);
    }

    return NextResponse.json(body, { status: res.status, headers: res.headers });
  } catch {
    return res;
  }
}

export { POST };
