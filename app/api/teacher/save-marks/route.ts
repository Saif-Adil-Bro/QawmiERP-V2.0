import { matchesSyncOwner } from "@/lib/portal/teacher-entry";
import { NextRequest, NextResponse } from "next/server";
import { saveExamMarks } from "@/app/actions/exams";
export async function POST(req: NextRequest) {
  if (!(await matchesSyncOwner(req)))
    return NextResponse.json(
      { error: "সিঙ্ক মুলতবি: অ্যাকাউন্ট বদলেছে।" },
      { status: 409 },
    );
  const { exam_id, class_id, subject_name, records } = await req.json();
  if (!class_id || !subject_name || !exam_id || !Array.isArray(records))
    return NextResponse.json({ error: "অসম্পূর্ণ তথ্য" }, { status: 400 });
  const result = await saveExamMarks(exam_id, subject_name, records, class_id);
  const code = "code" in result ? result.code : undefined;
  return NextResponse.json(result, { status: code === "EXAM_LOCKED" ? 409 : code === "EXAM_LOCK_UNAVAILABLE" ? 503 : result.error ? 403 : 200 });
}
