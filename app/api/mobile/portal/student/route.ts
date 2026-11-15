import { NextRequest } from "next/server";
import { authenticateMobileRequest, mobileError, mobileSuccess } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateMobileRequest(req, {
    requireWrite: false,
    allowPortalRoles: true,
  });
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const requestedStudentId = searchParams.get("student_id");
    const phone = String(auth.ctx.userRow?.phone || auth.ctx.user?.user_metadata?.phone || "").replace(/[^0-9]/g, "");

    let studentsQuery = auth.adminClient
      .from("students")
      .select("*, classes(id, name)")
      .eq("madrasa_id", auth.ctx.madrasaId);

    if (requestedStudentId) {
      studentsQuery = studentsQuery.eq("id", requestedStudentId);
    } else if (phone.length >= 6) {
      studentsQuery = studentsQuery.ilike("parent_phone", `%${phone.slice(-10)}%`);
    }

    const { data: students } = await studentsQuery.limit(10);
    const activeStudent = students?.[0] || null;

    if (!activeStudent) {
      return mobileSuccess(
        { students: [], active_student: null, attendance: [], fees: [], exam_results: [], hifz_logs: [], kitab_logs: [] },
        "কোনো শিক্ষার্থী সংযুক্ত পাওয়া যায়নি।",
        undefined,
        200,
        req
      );
    }

    const [attRes, feeRes, examRes, hifzRes, kitabRes, noticeRes] = await Promise.all([
      auth.adminClient.from("attendance").select("*").eq("student_id", activeStudent.id).order("date", { ascending: false }).limit(30),
      auth.adminClient.from("student_fees").select("*, fee_types(id, name)").eq("student_id", activeStudent.id).order("due_date", { ascending: false }).limit(30),
      auth.adminClient.from("exam_results").select("*, exams(id, title), subjects(id, name)").eq("student_id", activeStudent.id).order("created_at", { ascending: false }).limit(50),
      auth.adminClient.from("hifz_logs").select("*").eq("student_id", activeStudent.id).order("date", { ascending: false }).limit(20),
      auth.adminClient.from("kitab_logs").select("*").eq("student_id", activeStudent.id).order("date", { ascending: false }).limit(20),
      auth.adminClient.from("notices").select("*").eq("madrasa_id", auth.ctx.madrasaId).order("created_at", { ascending: false }).limit(10),
    ]);

    return mobileSuccess(
      {
        students: students || [],
        active_student: activeStudent,
        attendance: attRes.data || [],
        fees: feeRes.data || [],
        exam_results: examRes.data || [],
        hifz_logs: hifzRes.data || [],
        kitab_logs: kitabRes.data || [],
        notices: noticeRes.data || [],
      },
      "Success",
      undefined,
      200,
      req
    );
  } catch (err: any) {
    return mobileError(err?.message || "Server error", 500, "INTERNAL_ERROR");
  }
}
