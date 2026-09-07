import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);

    if (!user) {
      return NextResponse.json({ error: "অননুমোদিত অ্যাক্সেস (Unauthorized)" }, { status: 401 });
    }

    const body = await req.json();
    const { exam_id, class_id, subject_name, madrasa_id, records } = body;

    if (!exam_id || !subject_name || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: "প্রয়োজনীয় ডেটা অনুপস্থিত (Missing required data)" }, { status: 400 });
    }

    const admin = await createAdminClient();

    // Resolve madrasaId
    let targetMadrasaId = madrasa_id;
    if (!targetMadrasaId) {
      const { data: u } = await admin.from("users").select("madrasa_id").eq("id", user.id).maybeSingle();
      targetMadrasaId = u?.madrasa_id || "";
    }

    const recordsToUpsert = records.map((r: any) => ({
      madrasa_id: targetMadrasaId || undefined,
      exam_id,
      student_id: r.student_id,
      class_id: class_id || null,
      subject_name,
      marks_obtained: Number(r.marks_obtained) || 0,
      total_marks: Number(r.total_marks) || 100,
    }));

    // First attempt batch upsert
    const { error: upsertErr } = await admin
      .from("exam_results")
      .upsert(recordsToUpsert, { onConflict: "student_id, exam_id, subject_name" });

    if (upsertErr) {
      console.warn("Batch upsert failed, executing sequential update/insert:", upsertErr.message);
      // Fallback: one-by-one check and update/insert
      for (const rec of recordsToUpsert) {
        const { data: existing } = await admin
          .from("exam_results")
          .select("id")
          .eq("student_id", rec.student_id)
          .eq("exam_id", rec.exam_id)
          .eq("subject_name", rec.subject_name)
          .maybeSingle();

        if (existing?.id) {
          await admin.from("exam_results").update({
            marks_obtained: rec.marks_obtained,
            total_marks: rec.total_marks,
            class_id: rec.class_id,
          }).eq("id", existing.id);
        } else {
          await admin.from("exam_results").insert([rec]);
        }
      }
    }

    return NextResponse.json({ success: true, count: recordsToUpsert.length });
  } catch (err: any) {
    console.error("Error in teacher save-marks API:", err);
    return NextResponse.json(
      { error: err?.message || "সার্ভার এরর হয়েছে। দয়া করে আবার চেষ্টা করুন।" },
      { status: 500 }
    );
  }
}
