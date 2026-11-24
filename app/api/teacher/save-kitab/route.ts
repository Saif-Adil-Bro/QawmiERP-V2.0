import { validDate } from "@/lib/portal/rules";
import { matchesSyncOwner } from "@/lib/portal/teacher-entry";
import { webTeacher } from "@/lib/portal/identity";
import { verifyRoster } from "@/lib/portal/teacher-entry";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { authorizeApi, getOwnedStudentIds } from "@/lib/api-auth";

/**
 * কিতাব লগ সংরক্ষণ।
 *
 * ⛔ আগের সমস্যা: `madrasa_id` ক্লায়েন্টের বডি থেকে, student/teacher/existing_id
 * মালিকানা যাচাই নেই — টেন্যান্ট বদলে অন্য মাদ্রাসার `kitab_logs` লেখা/ওভাররাইট সম্ভব।
 *
 * এখন: writeGuard("kitab") → সার্ভার madrasaId → শিক্ষার্থী ও শিক্ষক মালিকানা যাচাই →
 * সব update/lookup মাদ্রাসা-স্কোপড।
 */
export async function POST(req: NextRequest) {
  if (!(await matchesSyncOwner(req)))
    return NextResponse.json(
      { error: "সিঙ্ক মুলতবি: অ্যাকাউন্ট বদলেছে।" },
      { status: 409 },
    );
  try {
    const auth = await authorizeApi("kitab");
    if (!auth.ok) return auth.response;

    const { madrasaId } = auth.ctx;
    const body = await req.json();
    const { current_date, current_class_id, records } = body;

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { error: "কোন রেকর্ড পাওয়া যায়নি।" },
        { status: 400 },
      );
    }
    if (!validDate(current_date) || !current_class_id) {
      return NextResponse.json(
        { error: "তারিখ আবশ্যক (current_date missing)।" },
        { status: 400 },
      );
    }

    const admin = await createAdminClient();

    const teacher = await webTeacher();
    if (!teacher || !(await verifyRoster(madrasaId, records, current_class_id)))
      return NextResponse.json({ error: "অনুমতি নেই।" }, { status: 403 });
    if (records.some((r) => !r.kitab_name?.trim()))
      return NextResponse.json(
        { error: "কিতাবের নাম আবশ্যক।" },
        { status: 400 },
      );
    let saved = 0;
    for (const rec of records) {
      const dbRecord = {
        madrasa_id: madrasaId,
        student_id: rec.student_id,
        teacher_id: teacher.scope.teacher?.id || null,
        log_date: current_date,
        kitab_name: rec.kitab_name.trim(),
        page_from: rec.page_from || null,
        page_to: rec.page_to || null,
        performance_rating: rec.performance_rating || null,
        notes: rec.notes || null,
      };

      const scoped = () =>
        admin
          .from("kitab_logs")
          .select("id")
          .eq("madrasa_id", madrasaId)
          .eq("student_id", rec.student_id)
          .eq("log_date", current_date);
      const lookup = await (
        rec.existing_id
          ? scoped().eq("id", rec.existing_id)
          : scoped().eq("kitab_name", dbRecord.kitab_name)
      ).maybeSingle();
      if (lookup.error) throw lookup.error;
      if (rec.existing_id && !lookup.data)
        return NextResponse.json(
          { error: "রেকর্ডটি পরিবর্তিত হয়েছে। রিফ্রেশ করুন।" },
          { status: 409 },
        );
      const write = lookup.data
        ? await admin
            .from("kitab_logs")
            .update(dbRecord)
            .eq("id", lookup.data.id)
            .eq("madrasa_id", madrasaId)
            .eq("student_id", rec.student_id)
            .select("id")
            .single()
        : await admin.from("kitab_logs").insert(dbRecord);
      if (write.error) throw write.error;
      saved++;
    }

    revalidatePath("/portal/academic");
    revalidatePath("/teacher-portal/kitab");
    revalidatePath("/dashboard/kitab");
    return NextResponse.json({ success: true, count: saved });
  } catch (err: any) {
    console.error("Error saving kitab logs in API:", err);
    return NextResponse.json(
      { error: err?.message || "সার্ভার এরর হয়েছে। দয়া করে আবার চেষ্টা করুন।" },
      { status: 500 },
    );
  }
}
