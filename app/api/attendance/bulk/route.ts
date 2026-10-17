export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { authorizeApi, getOwnedStudentIds } from "@/lib/api-auth";

/**
 * বাল্ক হাজিরা সংরক্ষণ।
 *
 * ⛔ আগের সমস্যা:
 *   ১. শুধু লগইন থাকলেই চলত — কোনো মডিউল-পারমিশন/রোল যাচাই ছিল না।
 *   ২. `madrasa_id` আসত **ক্লায়েন্টের বডি থেকে** → অন্য মাদ্রাসার নামে ডেটা লেখা যেত।
 *   ৩. Existing রেকর্ড খোঁজা হতো শুধু `student_id + date` দিয়ে (madrasa_id ছাড়া) →
 *      অন্য মাদ্রাসার হাজিরা রেকর্ডও ওভাররাইট হয়ে যেত।
 *
 * এখন: writeGuard("attendance") → সার্ভার-রেজলভড madrasaId → শিক্ষার্থী মালিকানা যাচাই →
 * সব query/update মাদ্রাসা-স্কোপড।
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authorizeApi("attendance");
    if (!auth.ok) return auth.response;

    const { madrasaId } = auth.ctx;

    const { records } = await req.json();

    if (!records || !Array.isArray(records)) {
      return NextResponse.json({ error: "Invalid records format" }, { status: 400 });
    }

    // ক্লায়েন্টের পাঠানো madrasa_id সম্পূর্ণ উপেক্ষা করা হয়
    const studentIds = records.map((r: any) => String(r?.student_id || "")).filter(Boolean);
    if (studentIds.length === 0) {
      return NextResponse.json({ error: "No valid student records" }, { status: 400 });
    }

    const ownedIds = await getOwnedStudentIds(studentIds, madrasaId);
    const foreignIds = studentIds.filter((id) => !ownedIds.has(id));
    if (foreignIds.length > 0) {
      return NextResponse.json(
        {
          error: "এই মাদ্রাসার অন্তর্ভুক্ত নয় এমন শিক্ষার্থীর হাজিরা সংরক্ষণ করা যাবে না।",
          code: "CROSS_TENANT_BLOCKED",
        },
        { status: 403 }
      );
    }

    const admin = await createAdminClient();

    let savedCount = 0;
    for (const record of records) {
      const studentId = String(record.student_id || "");
      if (!studentId || !record.date) continue;

      const { data: existing } = await admin
        .from("attendance")
        .select("id")
        .eq("student_id", studentId)
        .eq("date", record.date)
        .eq("madrasa_id", madrasaId)
        .maybeSingle();

      if (existing) {
        await admin
          .from("attendance")
          .update({
            status: record.status,
            notes: record.notes,
            class_id: record.class_id,
          })
          .eq("id", existing.id)
          .eq("madrasa_id", madrasaId);
      } else {
        const { error: insertErr } = await admin.from("attendance").insert([
          {
            student_id: studentId,
            class_id: record.class_id,
            // সার্ভার-রেজলভড মাদ্রাসা — ক্লায়েন্টের মান কখনো নয়
            madrasa_id: madrasaId,
            date: record.date,
            status: record.status,
            notes: record.notes,
          },
        ]);
        if (insertErr) {
          console.warn("Attendance insert warning:", insertErr.message);
          continue;
        }
      }
      savedCount++;
    }

    revalidatePath("/teacher-portal/attendance");
    revalidatePath("/dashboard/attendance");
    revalidatePath("/dashboard/attendance/students");

    return NextResponse.json({ success: true, count: savedCount });
  } catch (error: any) {
    console.error("Bulk attendance error:", error);
    return NextResponse.json({ error: error.message || "Failed to save" }, { status: 500 });
  }
}
