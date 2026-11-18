import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest, createMobileTableHandlers } from "@/lib/mobile-api";
import { loadServerPermissions } from "@/lib/permissions-server";
import { canViewUnmaskedField, maskDonorSensitiveFields } from "@/lib/data-access-guards";

export const dynamic = "force-dynamic";

const { GET: baseGET, POST } = createMobileTableHandlers({
  table: "donors",
  module: "zakat",
  select: "*",
  searchColumns: ["name", "phone", "email", "address"],
  filterColumns: ["donor_type"],
  defaultSort: "created_at",
  requiredFields: ["name"],
});

export async function GET(req: NextRequest) {
  const res = await baseGET(req);
  if (!res.ok) return res;

  try {
    let allowUnmasked = false;
    const auth = await authenticateMobileRequest(req);
    if (auth.ok && auth.ctx.madrasaId) {
      const permCtx = await loadServerPermissions(auth.ctx.userId, auth.ctx.madrasaId);
      allowUnmasked = canViewUnmaskedField(permCtx?.summary, "zakat", "phone");
    }

    if (allowUnmasked) return res;

    const body = await res.json();
    if (Array.isArray(body?.data)) {
      body.data = body.data.map((row: any) => maskDonorSensitiveFields(row, false));
    } else if (body?.data && typeof body.data === "object") {
      body.data = maskDonorSensitiveFields(body.data, false);
    }

    return NextResponse.json(body, { status: res.status, headers: res.headers });
  } catch {
    return res;
  }
}

export { POST };
