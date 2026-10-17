import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { authorizeApi, getOwnedStudentIds } from "@/lib/api-auth";

/**
 * শিক্ষকের মার্কস এন্ট্রি।
 *
 * ⛔ আগের সমস্যা: শুধু লগইন থাকলেই চলত, `madrasa_id` আসত ক্লায়েন্টের বডি থেকে, এবং
 * exam/student মালিকানা যাচাই হতো না — ফলে টেন্যান্ট বদলে অন্য মাদ্রাসার
 * `exam_results` লেখা/ওভাররাইট করা সম্ভব ছিল।
 *
 * এখন: writeGuard("exams") → সার্ভার-রেজলভড madrasaId → exam + student মালিকানা যাচাই →
 * সব write মাদ্রাসা-স্কোপড।
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authorizeApi("exams");
    if (!auth.ok) return auth.response;

    const { madrasaId } = auth.ctx;
    const body = await req.json();
    const { exam_id, class_id, subject_name, records } = body;

    if (!exam_id || !subject_name || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { error: "প্রয়োজনীয় ডেটা অনুপস্থিত (Missing required data)" },
        { status: 400 }
      );
    }

    const admin = await createAdminClient();

    // 1) পরীক্ষাটি আসলেই এই মাদ্রাসার — নাহলে অন্য মাদ্রাসার পরীক্ষায় মার্কস লেখা যেত
    const { data: examRow } = await admin
      .from("exams")
      .select("id")
      .eq("id", String(exam_id))
      .eq("madrasa_id", madrasaId)
      .maybeSingle();

    if (!examRow) {
      return NextResponse.json(
        { error: "এই মাদ্রাসার অন্তর্ভুক্ত নয় এমন পরীক্ষায় মার্কস সংরক্ষণ করা যাবে না।", code: "CROSS_TENANT_BLOCKED" },
        { status: 403 }
      );
    }

    // 2) সব শিক্ষার্থী এই মাদ্রাসার কিনা
    const studentIds = records.map((r: any) => String(r?.student_id || "")).filter(Boolean);
    const ownedIds = await getOwnedStudentIds(studentIds, madrasaId);
    if (studentIds.some((id) => !ownedIds.has(id))) {
      return NextResponse.json(
        { error: "এই মাদ্রাসার অন্তর্ভুক্ত নয় এমন শিক্ষার্থীর মার্কস সংরক্ষণ করা যাবে না।", code: "CROSS_TENANT_BLOCKED" },
        { status: 403 }
      );
    }

    const recordsToUpsert = records.map((r: any) => ({
      // সার্ভার-রেজলভড মাদ্রাসা — ক্লায়েন্টের পাঠানো madrasa_id কখনো ব্যবহার হয় না
      madrasa_id: madrasaId,
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
          .eq("madrasa_id", madrasaId)
          .maybeSingle();

        if (existing?.id) {
          await admin
            .from("exam_results")
            .update({
              marks_obtained: rec.marks_obtained,
              total_marks: rec.total_marks,
              class_id: rec.class_id,
            })
            .eq("id", existing.id)
            .eq("madrasa_id", madrasaId);
        } else {
          await admin.from("exam_results").insert([rec]);
        }
      }
    }

    return NextResponse.json({ success: true, count: recordsToUpsert.length });
  } catch (err: any) {
    console.error("Error in teacher save-marks API:", err);
    return NextResponse.json(
      { error: err?.message || "সার্ভার এরর হয়েছে। দয়া করে আবার চেষ্টা করুন।" },
      { status: 500 }
    );
  }
}
