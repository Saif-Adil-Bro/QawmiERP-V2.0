import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/api-auth";
import { canViewUnmaskedField } from "@/lib/data-access-guards";
import { loadServerPermissions } from "@/lib/permissions-server";
import { executeCustomReport } from "@/lib/bi/executive-bi-service";

export async function POST(req: Request) {
  const auth = await authorizeApi("bi");
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "অবৈধ JSON রিকোয়েস্ট" }, { status: 400 });
  }

  let allowUnmasked = false;
  if (body.allowUnmasked === true) {
    try {
      const permCtx = await loadServerPermissions(auth.ctx.userId, auth.ctx.madrasaId);
      allowUnmasked = canViewUnmaskedField(permCtx?.summary, "bi", "phone");
    } catch {
      allowUnmasked = false;
    }
  }

  try {
    const result = await executeCustomReport(auth.ctx.madrasaId, {
      ...body,
      allowUnmasked,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "কাস্টম রিপোর্ট চালানো যায়নি" },
      { status: 400 }
    );
  }
}
