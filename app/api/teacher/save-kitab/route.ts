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
    const { madrasa_id, current_class_id, current_date, records } = body;

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: "কোন রেকর্ড পাওয়া যায়নি।" }, { status: 400 });
    }

    const admin = await createAdminClient();

    let targetMadrasaId = madrasa_id;
    if (!targetMadrasaId) {
      const { data: u } = await admin.from("users").select("madrasa_id").eq("id", user.id).maybeSingle();
      targetMadrasaId = u?.madrasa_id || "";
    }

    for (const rec of records) {
      const dbRecord = {
        madrasa_id: targetMadrasaId || undefined,
        student_id: rec.student_id,
        teacher_id: rec.teacher_id || null,
        log_date: current_date,
        kitab_name: rec.kitab_name || "মিশকাত শরীফ",
        page_from: rec.page_from || null,
        page_to: rec.page_to || null,
        performance_rating: rec.performance_rating || "Good",
        notes: rec.notes || null,
      };

      if (rec.existing_id) {
        await admin.from("kitab_logs").update(dbRecord).eq("id", rec.existing_id);
      } else {
        const { data: found } = await admin
          .from("kitab_logs")
          .select("id")
          .eq("student_id", rec.student_id)
          .eq("log_date", current_date)
          .maybeSingle();

        if (found?.id) {
          await admin.from("kitab_logs").update(dbRecord).eq("id", found.id);
        } else {
          await admin.from("kitab_logs").insert([dbRecord]);
        }
      }
    }

    return NextResponse.json({ success: true, count: records.length });
  } catch (err: any) {
    console.error("Error saving kitab logs in API:", err);
    return NextResponse.json(
      { error: err?.message || "সার্ভার এরর হয়েছে। দয়া করে আবার চেষ্টা করুন।" },
      { status: 500 }
    );
  }
}
