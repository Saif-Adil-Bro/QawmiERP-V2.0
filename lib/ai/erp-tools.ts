import { tool } from "ai";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { toDhakaDateString } from "@/lib/date-utils";
import type { ServerPermissionContext } from "@/lib/permissions-server";

const PORTAL_ROLES = new Set(["student", "parent", "guardian"]);
const FINANCE_ROLES = new Set(["super_admin", "admin", "muhtamim", "naib_muhtamim", "accountant"]);
const STAFF_ACADEMIC_ROLES = new Set([
  "super_admin",
  "admin",
  "muhtamim",
  "naib_muhtamim",
  "office_staff",
  "teacher",
  "hifz_teacher",
  "hifz_supervisor",
  "ustad",
  "education_secretary",
  "exam_manager",
  "attendance_manager",
  "hr_manager",
]);

function hasPerm(ctx: ServerPermissionContext, perm: string, allowedRoles: Set<string>): boolean {
  if (ctx.status !== "ACTIVE") return false;
  if (ctx.roles.some((r) => PORTAL_ROLES.has(r))) return false;
  if (ctx.roles.some((r) => allowedRoles.has(r))) return true;
  return ctx.summary.effectivePermissions.includes(perm as any);
}

export async function createErpTools(ctx: ServerPermissionContext) {
  const adminClient = await createAdminClient();
  const madrasaId = ctx.madrasaId;

  return {
    searchStudents: tool({
      description:
        "মাদ্রাসার শিক্ষার্থীদের নাম, স্টুডেন্ট আইডি (যেমন AHM-480001) বা মোবাইল নম্বর দিয়ে খুঁজুন।",
      inputSchema: z.object({
        query: z.string().min(1).describe("শিক্ষার্থীর নাম, আইডি বা ফোন নম্বর"),
        limit: z.number().int().min(1).max(15).optional().default(8),
      }),
      execute: async ({ query, limit }) => {
        if (!hasPerm(ctx, "student.view", STAFF_ACADEMIC_ROLES)) {
          return { error: "আপনার রোলে শিক্ষার্থী তালিকা দেখার অনুমতি নেই।" };
        }
        const q = query.trim();
        const { data, error } = await adminClient
          .from("students")
          .select("id, full_name, student_id, guardian_phone, status, classes(name)")
          .eq("madrasa_id", madrasaId)
          .or(`full_name.ilike.%${q}%,student_id.ilike.%${q}%,guardian_phone.ilike.%${q}%`)
          .limit(limit ?? 8);

        if (error) return { error: error.message };
        return {
          count: data?.length || 0,
          students: (data || []).map((s: any) => ({
            id: s.id,
            name: s.full_name,
            studentId: s.student_id,
            className: s.classes?.name || "অনির্ধারিত",
            phone: s.guardian_phone || "-",
            status: s.status || "active",
            profileUrl: `/dashboard/students/${s.id}`,
          })),
        };
      },
    }),

    searchTeachers: tool({
      description: "মাদ্রাসার শিক্ষক ও স্টাফদের নাম, পদবি বা ফোন নম্বর দিয়ে খুঁজুন।",
      inputSchema: z.object({
        query: z.string().optional().default("").describe("শিক্ষকের নাম বা পদবি (খালি রাখলে প্রথম ১০ জন দেখাবে)"),
      }),
      execute: async ({ query }) => {
        if (!hasPerm(ctx, "staff.view", STAFF_ACADEMIC_ROLES)) {
          return { error: "আপনার রোলে শিক্ষক ও স্টাফ তালিকা দেখার অনুমতি নেই।" };
        }
        let dbQuery = adminClient
          .from("teachers")
          .select("id, full_name, designation, phone, email, status")
          .eq("madrasa_id", madrasaId)
          .limit(10);

        const q = (query || "").trim();
        if (q) {
          dbQuery = dbQuery.or(`full_name.ilike.%${q}%,designation.ilike.%${q}%,phone.ilike.%${q}%`);
        }

        const { data, error } = await dbQuery;
        if (error) return { error: error.message };
        return {
          count: data?.length || 0,
          teachers: (data || []).map((t: any) => ({
            id: t.id,
            name: t.full_name,
            designation: t.designation || "শিক্ষক",
            phone: t.phone || "-",
            status: t.status || "active",
          })),
        };
      },
    }),

    getDashboardSummary: tool({
      description:
        "আজকের হাজিরা, মোট শিক্ষার্থী, মোট শিক্ষক, এবং (অনুমতি থাকলে) আজকের ফি সংগ্রহ ও খরচের সারসংক্ষেপ দেখুন।",
      inputSchema: z.object({
        includeFinance: z.boolean().optional().default(true),
      }),
      execute: async ({ includeFinance }) => {
        if (ctx.status !== "ACTIVE" || ctx.roles.some((r) => PORTAL_ROLES.has(r))) {
          return { error: "ড্যাশবোর্ড সারসংক্ষেপ দেখার অনুমতি নেই।" };
        }

        const today = toDhakaDateString();
        const [studentsRes, teachersRes, attendanceRes] = await Promise.all([
          adminClient
            .from("students")
            .select("id", { count: "exact", head: true })
            .eq("madrasa_id", madrasaId),
          adminClient
            .from("teachers")
            .select("id", { count: "exact", head: true })
            .eq("madrasa_id", madrasaId),
          adminClient
            .from("attendance")
            .select("status")
            .eq("madrasa_id", madrasaId)
            .eq("date", today),
        ]);

        const attRows = attendanceRes.data || [];
        const present = attRows.filter((a: any) => a.status === "present").length;
        const absent = attRows.filter((a: any) => a.status === "absent").length;
        const leave = attRows.filter((a: any) => a.status === "leave").length;

        const summary: Record<string, any> = {
          date: today,
          totalStudents: studentsRes.count || 0,
          totalTeachers: teachersRes.count || 0,
          todayAttendance: {
            recorded: attRows.length,
            present,
            absent,
            leave,
          },
        };

        if (includeFinance && hasPerm(ctx, "finance.view", FINANCE_ROLES)) {
          const [paymentsRes, expensesRes] = await Promise.all([
            adminClient
              .from("fee_payments")
              .select("amount_paid, payment_date")
              .eq("madrasa_id", madrasaId)
              .gte("payment_date", today)
              .lte("payment_date", `${today}T23:59:59`),
            adminClient
              .from("expenses")
              .select("amount")
              .eq("madrasa_id", madrasaId)
              .eq("expense_date", today),
          ]);

          const todayFeeCollection = (paymentsRes.data || []).reduce(
            (sum: number, p: any) => sum + Number(p.amount_paid || 0),
            0
          );
          const todayExpense = (expensesRes.data || []).reduce(
            (sum: number, e: any) => sum + Number(e.amount || 0),
            0
          );

          summary.todayFinance = {
            todayFeeCollection,
            todayExpense,
          };
        }

        return summary;
      },
    }),

    getFeeRecords: tool({
      description: "সাম্প্রতিক ফি কালেকশন রসিদ অথবা বকেয়া ফি-র তথ্য খুঁজুন (শুধু হিসাব অনুমোদিত রোলের জন্য)।",
      inputSchema: z.object({
        mode: z.enum(["recent_payments", "due_students"]).default("recent_payments"),
        limit: z.number().int().min(1).max(15).optional().default(8),
      }),
      execute: async ({ mode, limit }) => {
        if (!hasPerm(ctx, "finance.view", FINANCE_ROLES)) {
          return { error: "আপনার রোলে আর্থিক বা ফি-সংক্রান্ত তথ্য দেখার অনুমতি নেই।" };
        }

        if (mode === "recent_payments") {
          const { data, error } = await adminClient
            .from("fee_payments")
            .select("id, receipt_no, amount_paid, payment_date, payment_method, students(full_name, student_id)")
            .eq("madrasa_id", madrasaId)
            .order("created_at", { ascending: false })
            .limit(limit ?? 8);

          if (error) return { error: error.message };
          return {
            mode,
            payments: (data || []).map((p: any) => ({
              receiptNo: p.receipt_no,
              amount: Number(p.amount_paid || 0),
              date: p.payment_date,
              method: p.payment_method || "cash",
              studentName: p.students?.full_name || "অজানা",
              studentId: p.students?.student_id || "-",
            })),
          };
        }

        const { data, error } = await adminClient
          .from("student_fees")
          .select("id, title, total_amount, paid_amount, status, students(full_name, student_id)")
          .eq("madrasa_id", madrasaId)
          .in("status", ["unpaid", "partial"])
          .limit(limit ?? 8);

        if (error) return { error: error.message };
        return {
          mode,
          dues: (data || []).map((f: any) => ({
            title: f.title,
            dueAmount: Math.max(0, Number(f.total_amount || 0) - Number(f.paid_amount || 0)),
            status: f.status,
            studentName: f.students?.full_name || "অজানা",
            studentId: f.students?.student_id || "-",
          })),
        };
      },
    }),

    navigateToPage: tool({
      description:
        "ব্যবহারকারীকে সরাসরি QawmiERP-এর নির্দিষ্ট কোনো পেজে যাওয়ার বাটন দেখাতে এটি কল করুন।",
      inputSchema: z.object({
        path: z.string().startsWith("/dashboard").describe("টার্গেট পেজের URL পাথ, যেমন /dashboard/students"),
        label: z.string().describe("বাটনের বাংলা নাম, যেমন 'শিক্ষার্থী তালিকায় যান'"),
      }),
      execute: async ({ path, label }) => {
        return {
          type: "navigate",
          path,
          label,
        };
      },
    }),

    proposeWriteAction: tool({
      description:
        "নতুন খরচ এন্ট্রি (create_expense) বা নতুন নোটিশ প্রকাশ (create_notice) করার আগে ব্যবহারকারীর কনফার্মেশন কার্ড দেখাতে এটি ব্যবহার করুন। কখনোই সরাসরি ডেটাবেজে লিখবেন না।",
      inputSchema: z.object({
        actionType: z.enum(["create_expense", "create_notice"]),
        title: z.string().describe("কনফার্মেশন কার্ডের শিরোনাম"),
        summary: z.string().describe("কী কাজ করা হবে তার সংক্ষিপ্ত বাংলা বিবরণ"),
        payload: z.object({
          // For create_expense:
          category: z.string().optional().describe("খরচের খাত, যেমন: বিদ্যুৎ বিল, বাজার, মেরামত"),
          amount: z.number().positive().optional().describe("খরচের পরিমাণ (টাকা)"),
          description: z.string().optional().describe("খরচের বিবরণ"),
          expenseDate: z.string().optional().describe("তারিখ YYYY-MM-DD ফরম্যাটে"),
          // For create_notice:
          noticeTitle: z.string().optional().describe("নোটিশের শিরোনাম"),
          noticeContent: z.string().optional().describe("নোটিশের বিস্তারিত"),
          targetAudience: z.enum(["all", "teachers", "students", "parents"]).optional().default("all"),
        }),
      }),
      execute: async ({ actionType, title, summary, payload }) => {
        if (actionType === "create_expense") {
          if (!hasPerm(ctx, "finance.create", FINANCE_ROLES)) {
            return { error: "আপনার রোলে নতুন খরচ এন্ট্রি করার অনুমতি নেই।" };
          }
          if (!payload.amount || !payload.category) {
            return { error: "খরচ এন্ট্রির জন্য খাত (category) এবং টাকার পরিমাণ (amount) প্রয়োজন।" };
          }
        }
        if (actionType === "create_notice") {
          if (!hasPerm(ctx, "notification.view", STAFF_ACADEMIC_ROLES)) {
            return { error: "আপনার রোলে নোটিশ প্রকাশ করার অনুমতি নেই।" };
          }
          if (!payload.noticeTitle || !payload.noticeContent) {
            return { error: "নোটিশের জন্য শিরোনাম ও বিস্তারিত বিবরণ প্রয়োজন।" };
          }
        }

        return {
          requiresConfirmation: true,
          actionId: `${actionType}-${Date.now()}`,
          actionType,
          title,
          summary,
          payload,
        };
      },
    }),
  };
}
