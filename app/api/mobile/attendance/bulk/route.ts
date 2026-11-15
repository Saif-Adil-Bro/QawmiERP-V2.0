import { NextRequest } from "next/server";
import { authenticateMobileRequest, mobileError, mobileSuccess } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await authenticateMobileRequest(req, {
    module: "attendance",
    requireWrite: true,
  });
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const date = String(body.date || "").trim();
    const records: Array<{ student_id: string; status: string; remarks?: string }> =
      Array.isArray(body.records) ? body.records : [];

    if (!date || records.length === 0) {
      return mobileError(
        "date এবং records অ্যারে আবশ্যক।",
        400,
        "VALIDATION_ERROR"
      );
    }

    const studentIds = records.map((r) => r.student_id).filter(Boolean);
    const { data: ownedStudents } = await auth.adminClient
      .from("students")
      .select("id")
      .eq("madrasa_id", auth.ctx.madrasaId)
      .in("id", studentIds);

    const ownedSet = new Set((ownedStudents || []).map((s: any) => String(s.id)));
    const validRows = records
      .filter((r) => ownedSet.has(String(r.student_id)))
      .map((r) => ({
        madrasa_id: auth.ctx.madrasaId,
        student_id: r.student_id,
        date,
        status: r.status || "Present",
        remarks: r.remarks || null,
      }));

    if (validRows.length === 0) {
      return mobileError("কোনো বৈধ শিক্ষার্থী পাওয়া যায়নি।", 400, "NO_VALID_STUDENTS");
    }

    // Remove existing records for same students on same date, then insert
    await auth.adminClient
      .from("attendance")
      .delete()
      .eq("madrasa_id", auth.ctx.madrasaId)
      .eq("date", date)
      .in(
        "student_id",
        validRows.map((r) => r.student_id)
      );

    const { data, error } = await auth.adminClient
      .from("attendance")
      .insert(validRows)
      .select("*");

    if (error) return mobileError(error.message, 400, "ATTENDANCE_SAVE_ERROR");

    return mobileSuccess(
      { savedCount: data?.length || 0, date, records: data || [] },
      "হাজিরা সফলভাবে সংরক্ষিত হয়েছে।",
      undefined,
      201,
      req
    );
  } catch (err: any) {
    return mobileError(err?.message || "Server error", 500, "INTERNAL_ERROR");
  }
}
