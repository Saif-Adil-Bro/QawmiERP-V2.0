export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { records } = await req.json();

    if (!records || !Array.isArray(records)) {
      return NextResponse.json({ error: "Invalid records format" }, { status: 400 });
    }

    // Process upsert
    for (const record of records) {
      const { data: existing } = await supabase
        .from("attendance")
        .select("id")
        .eq("student_id", record.student_id)
        .eq("date", record.date)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("attendance")
          .update({
            status: record.status,
            notes: record.notes,
            class_id: record.class_id,
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("attendance").insert([
          {
            student_id: record.student_id,
            class_id: record.class_id,
            madrasa_id: record.madrasa_id,
            date: record.date,
            status: record.status,
            notes: record.notes,
          },
        ]);
      }
    }

    revalidatePath("/teacher-portal/attendance");
    revalidatePath("/dashboard/attendance");
    revalidatePath("/dashboard/attendance/students");

    return NextResponse.json({ success: true, count: records.length });
  } catch (error: any) {
    console.error("Bulk attendance error:", error);
    return NextResponse.json({ error: error.message || "Failed to save" }, { status: 500 });
  }
}
