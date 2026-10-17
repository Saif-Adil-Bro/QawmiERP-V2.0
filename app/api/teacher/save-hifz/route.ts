import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { authorizeApi, getOwnedStudentIds } from "@/lib/api-auth";

/**
 * হিফজ লগ সংরক্ষণ।
 *
 * ⛔ আগের সমস্যা: `madrasa_id` ক্লায়েন্টের বডি থেকে, student/teacher/existing_id
 * মালিকানা যাচাই নেই — টেন্যান্ট বদলে অন্য মাদ্রাসার `hifz_logs` লেখা/ওভাররাইট সম্ভব।
 *
 * এখন: writeGuard("hifz") → সার্ভার madrasaId → শিক্ষার্থী ও শিক্ষক মালিকানা যাচাই →
 * সব update/lookup মাদ্রাসা-স্কোপড।
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authorizeApi("hifz");
    if (!auth.ok) return auth.response;

    const { madrasaId } = auth.ctx;
    const body = await req.json();
    const { current_date, records } = body;

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: "কোন রেকর্ড পাওয়া যায়নি।" }, { status: 400 });
    }
    if (!current_date) {
      return NextResponse.json({ error: "তারিখ আবশ্যক (current_date missing)।" }, { status: 400 });
    }

    const admin = await createAdminClient();

    // 1) সব শিক্ষার্থী এই মাদ্রাসার কিনা
    const studentIds = records.map((r: any) => String(r?.student_id || "")).filter(Boolean);
    const ownedStudentIds = await getOwnedStudentIds(studentIds, madrasaId);
    if (studentIds.some((id) => !ownedStudentIds.has(id))) {
      return NextResponse.json(
        { error: "এই মাদ্রাসার অন্তর্ভুক্ত নয় এমন শিক্ষার্থীর হিফজ লগ সংরক্ষণ করা যাবে না।", code: "CROSS_TENANT_BLOCKED" },
        { status: 403 }
      );
    }

    // 2) শিক্ষক আইডি থাকলে সেটিও এই মাদ্রাসার হতে হবে
    const teacherIds = records.map((r: any) => String(r?.teacher_id || "")).filter(Boolean);
    let ownedTeacherIds = new Set<string>();
    if (teacherIds.length > 0) {
      const { data: teacherRows } = await admin
        .from("teachers")
        .select("id")
        .eq("madrasa_id", madrasaId)
        .in("id", Array.from(new Set(teacherIds)));
      ownedTeacherIds = new Set((teacherRows || []).map((t: any) => String(t.id)));
    }

    let saved = 0;
    for (const rec of records) {
      const dbRecord = {
        madrasa_id: madrasaId,
        student_id: rec.student_id,
        teacher_id: ownedTeacherIds.has(String(rec.teacher_id || "")) ? rec.teacher_id : null,
        log_date: current_date,
        sabak_para: rec.sabak_para,
        saboki_para: rec.saboki_para,
        amukhta_para: rec.amukhta_para,
        performance_rating: rec.performance_rating || "মুমতাজ (Excellent)",
        notes: rec.notes || null,
      };

      if (rec.existing_id) {
        // শুধু এই মাদ্রাসার রেকর্ড আপডেট হবে
        const { data: updated } = await admin
          .from("hifz_logs")
          .update(dbRecord)
          .eq("id", rec.existing_id)
          .eq("madrasa_id", madrasaId)
          .select("id");
        if (updated && updated.length > 0) {
          saved++;
          continue;
        }
      }

      const { data: found } = await admin
        .from("hifz_logs")
        .select("id")
        .eq("student_id", rec.student_id)
        .eq("log_date", current_date)
        .eq("madrasa_id", madrasaId)
        .maybeSingle();

      if (found?.id) {
        await admin.from("hifz_logs").update(dbRecord).eq("id", found.id).eq("madrasa_id", madrasaId);
      } else {
        await admin.from("hifz_logs").insert([dbRecord]);
      }
      saved++;
    }

    return NextResponse.json({ success: true, count: saved });
  } catch (err: any) {
    console.error("Error saving hifz logs in API:", err);
    return NextResponse.json(
      { error: err?.message || "সার্ভার এরর হয়েছে। দয়া করে আবার চেষ্টা করুন।" },
      { status: 500 }
    );
  }
}
