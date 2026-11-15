import { NextRequest } from "next/server";
import { authenticateMobileRequest, mobileError, mobileSuccess } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await authenticateMobileRequest(req, {
    module: "students",
    requireWrite: true,
  });
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const list: any[] = Array.isArray(body?.students) ? body.students : Array.isArray(body) ? body : [];
    if (list.length === 0) {
      return mobileError("students অ্যারে খালি।", 400, "VALIDATION_ERROR");
    }

    const rows = list.map((s) => ({
      ...s,
      madrasa_id: auth.ctx.madrasaId,
    }));

    const { data, error } = await auth.adminClient
      .from("students")
      .insert(rows)
      .select("*, classes(id, name)");

    if (error) return mobileError(error.message, 400, "BULK_INSERT_ERROR");

    return mobileSuccess(
      { insertedCount: data?.length || 0, students: data || [] },
      `${data?.length || 0} জন শিক্ষার্থী সফলভাবে যোগ করা হয়েছে।`,
      undefined,
      201,
      req
    );
  } catch (err: any) {
    return mobileError(err?.message || "Server error", 500, "INTERNAL_ERROR");
  }
}
