import { getAuthUser, createAdminClient } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "@/app/actions/students";
import { loadServerPermissions } from "@/lib/permissions-server";
import { toDhakaDateString } from "@/lib/date-utils";
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
]);

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return Response.json({ error: "অননুমোদিত প্রবেশ।" }, { status: 401 });
    }

    const madrasaId = await getAuthMadrasaId();
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

    return Response.json({ error: "অজানা অ্যাকশন টাইপ।" }, { status: 400 });
  } catch (err: any) {
    console.error("AI confirm error:", err);
    return Response.json({ error: err?.message || "কাজটি সম্পন্ন করতে সমস্যা হয়েছে।" }, { status: 500 });
  }
}
