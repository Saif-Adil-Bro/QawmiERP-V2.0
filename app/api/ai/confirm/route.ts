import { getAuthUser, createAdminClient } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "@/app/actions/students";
import { loadServerPermissions } from "@/lib/permissions-server";
import { toDhakaDateString } from "@/lib/date-utils";
import { generateNextUniqueStudentId } from "@/lib/student-utils";
import { revalidatePath } from "next/cache";

const PORTAL_ROLES = new Set(["student", "parent", "guardian"]);
const FINANCE_ROLES = new Set(["super_admin", "admin", "muhtamim", "naib_muhtamim", "accountant"]);
const STAFF_ROLES = new Set([
  "super_admin",
  "admin",
  "muhtamim",
  "naib_muhtamim",
  "office_staff",
  "teacher",
  "education_secretary",
  "attendance_manager",
]);

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return Response.json({ error: "অননুমোদিত প্রবেশ।" }, { status: 401 });
    }

    const madrasaId = await getAuthMadrasaId(undefined, user);
    if (!madrasaId) {
      return Response.json({ error: "মাদ্রাসা পাওয়া যায়নি।" }, { status: 403 });
    }

    const permCtx = await loadServerPermissions(user.id, madrasaId);
    if (!permCtx || permCtx.status !== "ACTIVE" || permCtx.roles.some((r) => PORTAL_ROLES.has(r))) {
      return Response.json({ error: "এই কাজের অনুমতি নেই।" }, { status: 403 });
    }

    const body = await req.json();
    const { actionType, payload } = body || {};
    const adminClient = await createAdminClient();

    if (actionType === "create_expense") {
      const allowed =
        permCtx.roles.some((r) => FINANCE_ROLES.has(r)) ||
        permCtx.summary.effectivePermissions.includes("finance.create" as any);
      if (!allowed) {
        return Response.json({ error: "খরচ এন্ট্রি করার অনুমতি আপনার রোলে নেই।" }, { status: 403 });
      }

      const amount = Number(payload?.amount || 0);
      const category = String(payload?.category || "").trim();
      const description = String(payload?.description || category).trim();
      const expenseDate = String(payload?.expenseDate || toDhakaDateString()).trim();

      if (!category || isNaN(amount) || amount <= 0) {
        return Response.json({ error: "সঠিক খাত ও টাকার পরিমাণ দিন।" }, { status: 400 });
      }

      const { data, error } = await adminClient
        .from("expenses")
        .insert({
          madrasa_id: madrasaId,
          category,
          amount,
          expense_date: expenseDate,
          description: `${description} (এআই সহায়কের মাধ্যমে এন্ট্রি)`,
        })
        .select("id")
        .single();

      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }

      revalidatePath("/dashboard/accounting/expenses");
      revalidatePath("/dashboard/accounting/reports");
      revalidatePath("/dashboard");

      return Response.json({
        success: true,
        id: data?.id,
        message: `খরচ সফলভাবে সেভ হয়েছে: ${category} — ৳${amount.toLocaleString()}`,
      });
    }

    if (actionType === "create_notice") {
      const allowed =
        permCtx.roles.some((r) => STAFF_ROLES.has(r)) ||
        permCtx.summary.effectivePermissions.includes("notification.view" as any);
      if (!allowed) {
        return Response.json({ error: "নোটিশ প্রকাশ করার অনুমতি আপনার রোলে নেই।" }, { status: 403 });
      }

      const title = String(payload?.noticeTitle || "").trim();
      const content = String(payload?.noticeContent || "").trim();
      const target_audience = String(payload?.targetAudience || "all").trim();

      if (!title || !content) {
        return Response.json({ error: "নোটিশের শিরোনাম ও বিস্তারিত প্রয়োজন।" }, { status: 400 });
      }

      const { data, error } = await adminClient
        .from("notices")
        .insert({
          madrasa_id: madrasaId,
          title,
          content,
          target_audience,
        })
        .select("id")
        .single();

      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }

      revalidatePath("/dashboard/communication/notices");
      revalidatePath("/dashboard/communication");

      return Response.json({
        success: true,
        id: data?.id,
        message: `নোটিশ সফলভাবে প্রকাশিত হয়েছে: "${title}"`,
      });
    }

    if (actionType === "mark_attendance") {
      const allowed =
        permCtx.roles.some((r) => STAFF_ROLES.has(r)) ||
        permCtx.summary.effectivePermissions.includes("attendance.view" as any);
      if (!allowed) {
        return Response.json({ error: "হাজিরা দেওয়ার অনুমতি আপনার রোলে নেই।" }, { status: 403 });
      }

      const studentId = String(payload?.studentId || "").trim();
      const status = String(payload?.attendanceStatus || "").trim();
      const date = String(payload?.attendanceDate || toDhakaDateString()).trim();

      if (!studentId || !["Present", "Absent", "Leave"].includes(status)) {
        return Response.json({ error: "সঠিক শিক্ষার্থী ও হাজিরা স্ট্যাটাস দিন।" }, { status: 400 });
      }

      const { error } = await adminClient
        .from("attendance")
        .upsert(
          {
            madrasa_id: madrasaId,
            student_id: studentId,
            date,
            status,
          },
          { onConflict: "student_id, date" }
        );

      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }

      revalidatePath("/dashboard/attendance");
      revalidatePath("/dashboard");

      const statusBn = status === "Present" ? "উপস্থিত" : status === "Absent" ? "অনুপস্থিত" : "ছুটি";
      return Response.json({
        success: true,
        message: `${payload?.studentName || "শিক্ষার্থী"}-এর ${date} তারিখের হাজিরা "${statusBn}" হিসেবে সেভ হয়েছে।`,
      });
    }

    if (actionType === "create_student") {
      const allowed =
        permCtx.roles.some((r) => STAFF_ROLES.has(r)) ||
        permCtx.summary.effectivePermissions.includes("student.edit" as any);
      if (!allowed) {
        return Response.json({ error: "নতুন শিক্ষার্থী ভর্তি করার অনুমতি আপনার রোলে নেই।" }, { status: 403 });
      }

      const firstName = String(payload?.firstName || "").trim();
      const lastName = String(payload?.lastName || "").trim();
      const classId = String(payload?.classId || "").trim();
      const fatherName = String(payload?.fatherName || "").trim();
      const parentPhone = String(payload?.parentPhone || "").trim();
      const address = String(payload?.address || "").trim();

      if (!firstName || !classId) {
        return Response.json({ error: "শিক্ষার্থীর নাম ও জামাত প্রয়োজন।" }, { status: 400 });
      }

      const [{ data: madrasaRow }, { data: existingStudents }] = await Promise.all([
        adminClient.from("madrasas").select("prefix").eq("id", madrasaId).maybeSingle(),
        adminClient.from("students").select("id, roll_number, class_id").eq("madrasa_id", madrasaId),
      ]);

      const usedIds = new Set<string>(
        (existingStudents || []).map((s: any) => String(s.roll_number || "").trim()).filter(Boolean)
      );
      const madrasaPrefix = (madrasaRow as any)?.prefix || "QM";
      const rollNumber = generateNextUniqueStudentId(
        existingStudents || [],
        { class_id: classId },
        madrasaPrefix,
        usedIds
      );

      const { data, error } = await adminClient
        .from("students")
        .insert({
          madrasa_id: madrasaId,
          first_name: firstName,
          last_name: lastName,
          roll_number: rollNumber,
          class_id: classId,
          father_name: fatherName || null,
          parent_phone: parentPhone || null,
          address: address || null,
        })
        .select("id, roll_number")
        .single();

      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }

      revalidatePath("/dashboard/students");
      revalidatePath("/dashboard");

      return Response.json({
        success: true,
        id: data?.id,
        message: `নতুন শিক্ষার্থী "${`${firstName} ${lastName}`.trim()}" সফলভাবে ভর্তি হয়েছে (আইডি: ${data?.roll_number || rollNumber})।`,
      });
    }

    return Response.json({ error: "অজানা অ্যাকশন টাইপ।" }, { status: 400 });
  } catch (err: any) {
    console.error("AI confirm error:", err);
    return Response.json({ error: err?.message || "কাজটি সম্পন্ন করতে সমস্যা হয়েছে।" }, { status: 500 });
  }
}
