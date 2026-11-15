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
    getClasses: tool({
      description: "মাদ্রাসার সকল জামাত/ক্লাসের তালিকা (id ও নাম) দেখুন।",
      inputSchema: z.object({}),
      execute: async () => {
        if (!hasPerm(ctx, "student.view", STAFF_ACADEMIC_ROLES)) {
          return { error: "আপনার রোলে জামাত তালিকা দেখার অনুমতি নেই।" };
        }
        const { data, error } = await adminClient
          .from("classes")
          .select("id, name")
          .eq("madrasa_id", madrasaId)
          .order("name");
        if (error) return { error: error.message };
        return { classes: data || [] };
      },
    }),

    getExamsAndSubjects: tool({
      description: "মাদ্রাসার পরীক্ষার তালিকা (exams) এবং কিতাব/বিষয়ের তালিকা (subjects) দেখুন।",
      inputSchema: z.object({}),
      execute: async () => {
        if (!hasPerm(ctx, "exam.view", STAFF_ACADEMIC_ROLES)) {
          return { error: "আপনার রোলে পরীক্ষা বা বিষয় দেখার অনুমতি নেই।" };
        }
        const [{ data: exams }, { data: subjects }] = await Promise.all([
          adminClient
            .from("exams")
            .select("id, name, title, class_id")
            .eq("madrasa_id", madrasaId)
            .order("created_at", { ascending: false })
            .limit(15),
          adminClient
            .from("subjects")
            .select("id, name, class_id")
            .eq("madrasa_id", madrasaId)
            .order("name")
            .limit(40),
        ]);
        return {
          exams: (exams || []).map((e: any) => ({
            id: e.id,
            name: e.name || e.title || "পরীক্ষা",
            classId: e.class_id,
          })),
          subjects: subjects || [],
        };
      },
    }),

    searchStudents: tool({
      description:
        "মাদ্রাসার শিক্ষার্থীদের নাম, রোল/স্টুডেন্ট আইডি বা অভিভাবকের মোবাইল নম্বর দিয়ে খুঁজুন।",
      inputSchema: z.object({
        query: z.string().min(1).describe("শিক্ষার্থীর নাম, রোল নম্বর বা ফোন নম্বর"),
        limit: z.number().int().min(1).max(15).optional().default(8),
      }),
      execute: async ({ query, limit }) => {
        if (!hasPerm(ctx, "student.view", STAFF_ACADEMIC_ROLES)) {
          return { error: "আপনার রোলে শিক্ষার্থী তালিকা দেখার অনুমতি নেই।" };
        }
        const q = query.trim();
        const { data, error } = await adminClient
          .from("students")
          .select("id, first_name, last_name, roll_number, parent_phone, father_name, classes(name)")
          .eq("madrasa_id", madrasaId)
          .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,roll_number.ilike.%${q}%,parent_phone.ilike.%${q}%`)
          .limit(limit ?? 8);

        if (error) return { error: error.message };
        return {
          count: data?.length || 0,
          students: (data || []).map((s: any) => ({
            id: s.id,
            name: `${s.first_name || ""} ${s.last_name || ""}`.trim(),
            rollNumber: s.roll_number || "-",
            className: s.classes?.name || "অনির্ধারিত",
            fatherName: s.father_name || "-",
            phone: s.parent_phone || "-",
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
          .select("id, first_name, last_name, designation, phone, email")
          .eq("madrasa_id", madrasaId)
          .limit(10);

        const q = (query || "").trim();
        if (q) {
          dbQuery = dbQuery.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,designation.ilike.%${q}%,phone.ilike.%${q}%`);
        }

        const { data, error } = await dbQuery;
        if (error) return { error: error.message };
        return {
          count: data?.length || 0,
          teachers: (data || []).map((t: any) => ({
            id: t.id,
            name: `${t.first_name || ""} ${t.last_name || ""}`.trim(),
            designation: t.designation || "শিক্ষক",
            phone: t.phone || "-",
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
        const present = attRows.filter((a: any) => String(a.status).toLowerCase() === "present").length;
        const absent = attRows.filter((a: any) => String(a.status).toLowerCase() === "absent").length;
        const leave = attRows.filter((a: any) => String(a.status).toLowerCase() === "leave").length;

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
            .select("id, receipt_no, amount_paid, payment_date, payment_method, students(first_name, last_name, roll_number)")
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
              studentName: `${p.students?.first_name || ""} ${p.students?.last_name || ""}`.trim() || "অজানা",
              rollNumber: p.students?.roll_number || "-",
            })),
          };
        }

        const { data, error } = await adminClient
          .from("student_fees")
          .select("id, title, total_amount, paid_amount, status, students(first_name, last_name, roll_number)")
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
            studentName: `${f.students?.first_name || ""} ${f.students?.last_name || ""}`.trim() || "অজানা",
            rollNumber: f.students?.roll_number || "-",
          })),
        };
      },
    }),

    navigateToPage: tool({
      description:
        "ব্যবহারকারীকে সরাসরি QawmiERP-এর নির্দিষ্ট কোনো পেজে নিয়ে যেতে বা পেজ খুলতে এটি কল করুন।",
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
        "যেকোনো রাইট অ্যাকশন — খরচ এন্ট্রি (create_expense), নোটিশ প্রকাশ (create_notice), হাজিরা মার্ক (mark_attendance), নতুন শিক্ষার্থী ভর্তি (create_student), পরীক্ষার নম্বর এন্ট্রি (enter_exam_mark), বা প্রশ্নব্যাংকে প্রশ্ন সংরক্ষণ (create_question) — করার আগে ব্যবহারকারীর কনফার্মেশন কার্ড দেখাতে এটি কল করুন।",
      inputSchema: z.object({
        actionType: z.enum([
          "create_expense",
          "create_notice",
          "mark_attendance",
          "create_student",
          "enter_exam_mark",
          "create_question",
        ]),
        title: z.string().describe("কনফার্মেশন কার্ডের শিরোনাম"),
        summary: z.string().describe("কী কাজ করা হবে তার সংক্ষিপ্ত বাংলা বিবরণ"),
        payload: z.object({
          // create_expense
          category: z.string().optional().describe("খরচের খাত, যেমন: বিদ্যুৎ বিল, বাজার, মেরামত"),
          amount: z.number().positive().optional().describe("খরচের পরিমাণ (টাকা)"),
          description: z.string().optional().describe("খরচের বিবরণ"),
          expenseDate: z.string().optional().describe("তারিখ YYYY-MM-DD ফরম্যাটে"),
          // create_notice
          noticeTitle: z.string().optional().describe("নোটিশের শিরোনাম"),
          noticeContent: z.string().optional().describe("নোটিশের বিস্তারিত"),
          targetAudience: z.enum(["all", "teachers", "students", "parents"]).optional().default("all"),
          // mark_attendance
          studentId: z.string().optional().describe("শিক্ষার্থীর UUID (searchStudents থেকে পাওয়া)"),
          studentName: z.string().optional().describe("শিক্ষার্থীর নাম"),
          attendanceDate: z.string().optional().describe("তারিখ YYYY-MM-DD (ডিফল্ট আজ)"),
          attendanceStatus: z.enum(["Present", "Absent", "Leave"]).optional(),
          // create_student
          firstName: z.string().optional().describe("শিক্ষার্থীর প্রথম নাম"),
          lastName: z.string().optional().describe("শিক্ষার্থীর শেষ নাম (ঐচ্ছিক)"),
          fatherName: z.string().optional().describe("পিতার নাম"),
          parentPhone: z.string().optional().describe("অভিভাবকের মোবাইল নম্বর"),
          classId: z.string().optional().describe("জামাতের UUID (getClasses থেকে পাওয়া)"),
          className: z.string().optional().describe("জামাতের নাম"),
          address: z.string().optional().describe("ঠিকানা"),
          // enter_exam_mark
          examId: z.string().optional().describe("পরীক্ষার UUID (getExamsAndSubjects থেকে পাওয়া)"),
          examName: z.string().optional().describe("পরীক্ষার নাম"),
          subjectName: z.string().optional().describe("বিষয়/কিতাবের নাম"),
          marksObtained: z.number().min(0).optional().describe("প্রাপ্ত নম্বর"),
          totalMarks: z.number().positive().optional().default(100).describe("পূর্ণমান (ডিফল্ট ১০০)"),
          // create_question
          subjectId: z.string().optional().describe("বিষয়/কিতাবের UUID (getExamsAndSubjects থেকে পাওয়া)"),
          questionType: z.enum(["short", "descriptive", "mcq", "ibarat", "tahqeeq"]).optional().default("short"),
          questionText: z.string().optional().describe("প্রশ্নের মূল লেখা"),
          marks: z.number().positive().optional().default(5),
          difficulty: z.enum(["easy", "medium", "hard"]).optional().default("medium"),
          chapter: z.string().optional(),
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
        } else if (actionType === "create_notice") {
          if (!hasPerm(ctx, "notification.view", STAFF_ACADEMIC_ROLES)) {
            return { error: "আপনার রোলে নোটিশ প্রকাশ করার অনুমতি নেই।" };
          }
          if (!payload.noticeTitle || !payload.noticeContent) {
            return { error: "নোটিশের জন্য শিরোনাম ও বিস্তারিত বিবরণ প্রয়োজন।" };
          }
        } else if (actionType === "mark_attendance") {
          if (!hasPerm(ctx, "attendance.view", STAFF_ACADEMIC_ROLES)) {
            return { error: "আপনার রোলে হাজিরা দেওয়ার অনুমতি নেই।" };
          }
          if (!payload.studentId || !payload.attendanceStatus) {
            return { error: "হাজিরা মার্ক করতে শিক্ষার্থীর ID এবং উপস্থিতি স্ট্যাটাস প্রয়োজন।" };
          }
        } else if (actionType === "create_student") {
          if (!hasPerm(ctx, "student.edit", STAFF_ACADEMIC_ROLES)) {
            return { error: "আপনার রোলে নতুন শিক্ষার্থী ভর্তি করার অনুমতি নেই।" };
          }
          if (!payload.firstName || !payload.classId) {
            return { error: "নতুন শিক্ষার্থী ভর্তি করতে নাম ও জামাত নির্বাচন প্রয়োজন।" };
          }
        } else if (actionType === "enter_exam_mark") {
          if (!hasPerm(ctx, "exam.edit", STAFF_ACADEMIC_ROLES)) {
            return { error: "আপনার রোলে পরীক্ষার নম্বর এন্ট্রি করার অনুমতি নেই।" };
          }
          if (!payload.examId || !payload.studentId || !payload.subjectName || payload.marksObtained === undefined) {
            return { error: "নম্বর এন্ট্রির জন্য পরীক্ষা, শিক্ষার্থী, বিষয় এবং প্রাপ্ত নম্বর প্রয়োজন।" };
          }
        } else if (actionType === "create_question") {
          if (!hasPerm(ctx, "exam.edit", STAFF_ACADEMIC_ROLES)) {
            return { error: "আপনার রোলে প্রশ্নব্যাংকে প্রশ্ন যোগ করার অনুমতি নেই।" };
          }
          if (!payload.classId || !payload.subjectId || !payload.questionText) {
            return { error: "প্রশ্ন সেভ করতে জামাত, বিষয় এবং প্রশ্নের লেখা প্রয়োজন।" };
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
