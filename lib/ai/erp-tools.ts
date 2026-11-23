import {canReadApproval,publicApproval} from '@/lib/finance/approval-terms';
import {canReadSchoolFinance} from "@/lib/action-authorization";
import {readBooks} from "@/lib/finance/read-books";
import {getFeeMetadata} from "@/lib/fee-store";
import {ledgerEntries} from "@/lib/finance/entries";
import { assertExamUnlocked } from "@/lib/lock-guards";
import { tool } from "ai";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { toDhakaDateString, toDhakaMonthString } from "@/lib/date-utils";
import type { ServerPermissionContext } from "@/lib/permissions-server";
import { getStudentRiskScores } from "@/lib/early-warning-service";
import { getFinancialAnomalies as fetchFinancialAnomalies } from "@/lib/anomaly-detection-service";
import { listApprovalRequestsForMadrasa } from "@/lib/approval-workflow";
import { getExecutiveBiSnapshot } from "@/lib/bi/executive-bi-service";

const PORTAL_ROLES = new Set(["student", "parent", "guardian"]);
const FINANCE_ROLES = new Set([
  "super_admin",
  "admin",
  "muhtamim",
  "naib_muhtamim",
  "accountant",
]);
const APPROVAL_VIEW_ROLES = new Set([
  "super_admin",
  "admin",
  "muhtamim",
  "naib_muhtamim",
  "accountant",
  "education_secretary",
  "hr_manager",
]);
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

function hasPerm(
  ctx: ServerPermissionContext,
  perm: string,
  allowedRoles: Set<string>
): boolean {
  if (!ctx || ctx.status !== "ACTIVE") return false;
  if (allowedRoles===FINANCE_ROLES && perm==='finance.view') return canReadSchoolFinance([ctx.role,...(ctx.roles||[])],ctx.summary?.effectivePermissions||[]);
  if (Array.isArray(ctx.roles) && ctx.roles.some((r) => PORTAL_ROLES.has(r))) {
    return false;
  }
  if (Array.isArray(ctx.roles) && ctx.roles.some((r) => allowedRoles.has(r))) {
    return true;
  }
  return Boolean(ctx.summary?.effectivePermissions?.includes(perm as any));
}

export function createErpTools(ctx: ServerPermissionContext) {
  const madrasaId = ctx.madrasaId;

  return {
    getClasses: tool({
      description: "মাদ্রাসার সকল জামাত/ক্লাসের তালিকা (id ও নাম) দেখুন।",
      inputSchema: z.object({}),
      execute: async () => {
        if (!hasPerm(ctx, "student.view", STAFF_ACADEMIC_ROLES)) {
          return { error: "আপনার রোলে জামাত তালিকা দেখার অনুমতি নেই।" };
        }
        const adminClient = await createAdminClient();
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
      description:
        "মাদ্রাসার পরীক্ষার তালিকা (exams) এবং কিতাব/বিষয়ের তালিকা (subjects) দেখুন।",
      inputSchema: z.object({}),
      execute: async () => {
        if (!hasPerm(ctx, "exam.view", STAFF_ACADEMIC_ROLES)) {
          return { error: "আপনার রোলে পরীক্ষা বা বিষয় দেখার অনুমতি নেই।" };
        }
        const adminClient = await createAdminClient();
        const [{ data: exams, error: examErr }, { data: subjects, error: subErr }] =
          await Promise.all([
            adminClient
              .from("exams")
              .select("id, title, year, status, session_id")
              .eq("madrasa_id", madrasaId)
              .order("created_at", { ascending: false })
              .limit(15),
            adminClient
              .from("subjects")
              .select("id, name, code")
              .eq("madrasa_id", madrasaId)
              .order("name")
              .limit(40),
          ]);
        if (examErr) return { error: examErr.message };
        if (subErr) return { error: subErr.message };
        return {
          exams: (exams || []).map((e: any) => ({
            id: e.id,
            title: e.title || "পরীক্ষা",
            year: e.year,
            status: e.status,
            sessionId: e.session_id,
          })),
          subjects: subjects || [],
        };
      },
    }),

    getExamResultsSummary: tool({
      description:
        "নির্দিষ্ট পরীক্ষা বা বিষয়ের ফলাফলের সারসংক্ষেপ (গড় নম্বর, পাস/ফেল, সর্বোচ্চ নম্বর) দেখুন।",
      inputSchema: z.object({
        examId: z.string().optional().describe("পরীক্ষার UUID"),
        examTitle: z.string().optional().describe("পরীক্ষার শিরোনাম"),
        subjectName: z.string().optional().describe("বিষয়/কিতাবের নাম"),
        limit: z.number().int().min(1).max(100).optional().default(50),
      }),
      execute: async ({ examId, examTitle, subjectName, limit }) => {
        if (!hasPerm(ctx, "exam.view", STAFF_ACADEMIC_ROLES)) {
          return { error: "আপনার রোলে পরীক্ষার ফলাফল দেখার অনুমতি নেই।" };
        }
        const adminClient = await createAdminClient();

        const [{ data: exams, error: examsErr }, { data: subjects }] =
          await Promise.all([
            adminClient
              .from("exams")
              .select("id, title, year, status, session_id")
              .eq("madrasa_id", madrasaId)
              .order("created_at", { ascending: false }),
            adminClient
              .from("subjects")
              .select("id, name, code")
              .eq("madrasa_id", madrasaId),
          ]);

        if (examsErr) return { error: examsErr.message };

        const matchedExam = (exams || []).find((e: any) => {
          if (examId && e.id === examId) return true;
          if (
            examTitle &&
            String(e.title || "")
              .toLowerCase()
              .includes(examTitle.trim().toLowerCase())
          ) {
            return true;
          }
          return false;
        });

        let query = adminClient
          .from("exam_results")
          .select("id, exam_id, student_id, subject_name, marks_obtained, total_marks")
          .eq("madrasa_id", madrasaId)
          .limit(limit ?? 50);

        if (matchedExam?.id || examId) {
          query = query.eq("exam_id", matchedExam?.id || examId);
        }
        if (subjectName) {
          query = query.ilike("subject_name", `%${subjectName.trim()}%`);
        }

        const { data: results, error: resErr } = await query;
        if (resErr) return { error: resErr.message };

        const rows = results || [];
        const totalMarksSum = rows.reduce(
          (acc: number, r: any) => acc + Number(r.total_marks || 100),
          0
        );
        const obtainedSum = rows.reduce(
          (acc: number, r: any) => acc + Number(r.marks_obtained || 0),
          0
        );
        const avgPercentage =
          totalMarksSum > 0
            ? Math.round((obtainedSum / totalMarksSum) * 1000) / 10
            : 0;
        const passCount = rows.filter((r: any) => {
          const total = Number(r.total_marks || 100);
          return total > 0 && Number(r.marks_obtained || 0) / total >= 0.33;
        }).length;

        return {
          exam: matchedExam || null,
          subjectsCount: (subjects || []).length,
          totalRecords: rows.length,
          passCount,
          avgPercentage,
          results: rows.slice(0, 20),
        };
      },
    }),

    searchStudents: tool({
      description:
        "মাদ্রাসার শিক্ষার্থীদের নাম, রোল/স্টুডেন্ট আইডি বা অভিভাবকের মোবাইল নম্বর দিয়ে খুঁজুন।",
      inputSchema: z.object({
        query: z
          .string()
          .min(1)
          .describe("শিক্ষার্থীর নাম, রোল নম্বর বা ফোন নম্বর"),
        limit: z.number().int().min(1).max(15).optional().default(8),
      }),
      execute: async ({ query, limit }) => {
        if (!hasPerm(ctx, "student.view", STAFF_ACADEMIC_ROLES)) {
          return { error: "আপনার রোলে শিক্ষার্থী তালিকা দেখার অনুমতি নেই।" };
        }
        const adminClient = await createAdminClient();
        const q = query.trim();
        const { data, error } = await adminClient
          .from("students")
          .select(
            "id, first_name, last_name, roll_number, parent_phone, father_name, classes(name)"
          )
          .eq("madrasa_id", madrasaId)
          .or(
            `first_name.ilike.%${q}%,last_name.ilike.%${q}%,roll_number.ilike.%${q}%,parent_phone.ilike.%${q}%`
          )
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
      description:
        "মাদ্রাসার শিক্ষক ও স্টাফদের নাম, পদবি বা ফোন নম্বর দিয়ে খুঁজুন।",
      inputSchema: z.object({
        query: z
          .string()
          .optional()
          .default("")
          .describe("শিক্ষকের নাম বা পদবি (খালি রাখলে প্রথম ১০ জন দেখাবে)"),
      }),
      execute: async ({ query }) => {
        if (!hasPerm(ctx, "staff.view", STAFF_ACADEMIC_ROLES)) {
          return { error: "আপনার রোলে শিক্ষক ও স্টাফ তালিকা দেখার অনুমতি নেই।" };
        }
        const adminClient = await createAdminClient();
        let dbQuery = adminClient
          .from("teachers")
          .select("id, first_name, last_name, designation, phone, email")
          .eq("madrasa_id", madrasaId)
          .limit(10);

        const q = (query || "").trim();
        if (q) {
          dbQuery = dbQuery.or(
            `first_name.ilike.%${q}%,last_name.ilike.%${q}%,designation.ilike.%${q}%,phone.ilike.%${q}%`
          );
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
        if (
          ctx.status !== "ACTIVE" ||
          ctx.roles.some((r) => PORTAL_ROLES.has(r))
        ) {
          return { error: "ড্যাশবোর্ড সারসংক্ষেপ দেখার অনুমতি নেই।" };
        }

        const adminClient = await createAdminClient();
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
        const present = attRows.filter(
          (a: any) => String(a.status).toLowerCase() === "present"
        ).length;
        const absent = attRows.filter(
          (a: any) => String(a.status).toLowerCase() === "absent"
        ).length;
        const leave = attRows.filter(
          (a: any) => String(a.status).toLowerCase() === "leave"
        ).length;

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
          const posted=ledgerEntries(await readBooks(ctx.madrasaId,getFeeMetadata)).filter(e=>e.status!=="VOID" && e.date===today);
          const todayFeeCollection=posted.filter(e=>e.source==='fee').reduce((s,e)=>s+e.amount,0);
          const todayExpense=posted.filter(e=>!e.income).reduce((s,e)=>s+e.amount,0);
          summary.todayFinance = {
            todayFeeCollection,
            todayExpense,
          };
        }

        return summary;
      },
    }),

    getFeeRecords: tool({
      description:
        "সাম্প্রতিক ফি কালেকশন রসিদ অথবা বকেয়া ফি-র তথ্য খুঁজুন (শুধু হিসাব অনুমোদিত রোলের জন্য)।",
      inputSchema: z.object({
        mode: z
          .enum(["recent_payments", "due_students"])
          .default("recent_payments"),
        limit: z.number().int().min(1).max(15).optional().default(8),
      }),
      execute: async ({ mode, limit }) => {
        if (!hasPerm(ctx, "finance.view", FINANCE_ROLES)) {
          return {
            error: "আপনার রোলে আর্থিক বা ফি-সংক্রান্ত তথ্য দেখার অনুমতি নেই।",
          };
        }

        const adminClient = await createAdminClient();
        if (mode === "recent_payments") {
          const { data, error } = await adminClient
            .from("fee_payments")
            .select(
              "id, receipt_no, total_amount_received, payment_date, payment_method, students(first_name, last_name, roll_number)"
            )
            .eq("madrasa_id", madrasaId)
            .order("created_at", { ascending: false })
            .limit(limit ?? 8);

          if (error) return { error: error.message };
          return {
            mode,
            payments: (data || []).map((p: any) => ({
              receiptNo: p.receipt_no,
              amount: Number(p.total_amount_received ?? p.amount_paid ?? 0),
              date: p.payment_date,
              method: p.payment_method || "cash",
              studentName:
                `${p.students?.first_name || ""} ${p.students?.last_name || ""}`.trim() ||
                "অজানা",
              rollNumber: p.students?.roll_number || "-",
            })),
          };
        }

        const { data, error } = await adminClient
          .from("student_fees")
          .select(
            "id, fee_type_name, billing_period, payable_amount, paid_amount, due_amount, status, students(first_name, last_name, roll_number)"
          )
          .eq("madrasa_id", madrasaId)
          .in("status", ["UNPAID", "PARTIAL", "OVERDUE"])
          .limit(limit ?? 8);

        if (error) return { error: error.message };
        return {
          mode,
          dues: (data || []).map((f: any) => ({
            id: f.id,
            title: f.fee_type_name || "মাসিক বেতন",
            billingPeriod: f.billing_period,
            dueAmount: Number(
              f.due_amount ??
                Math.max(
                  0,
                  Number(f.payable_amount || 0) - Number(f.paid_amount || 0)
                )
            ),
            status: f.status,
            studentName:
              `${f.students?.first_name || ""} ${f.students?.last_name || ""}`.trim() ||
              "অজানা",
            rollNumber: f.students?.roll_number || "-",
          })),
        };
      },
    }),

    getClassOverdueFees: tool({
      description:
        "জামাত (className/classId) ও মাস/বিলিং পিরিয়ড অনুযায়ী মোট বকেয়া ফি ও বকেয়া শিক্ষার্থীদের তালিকা দেখুন।",
      inputSchema: z.object({
        className: z.string().optional().describe("জামাতের নাম, যেমন: মিজান জামাত"),
        classId: z.string().optional().describe("জামাতের UUID"),
        billingPeriod: z
          .string()
          .optional()
          .describe("বিলিং মাস YYYY-MM ফরম্যাটে, যেমন 2026-10"),
        month: z
          .string()
          .optional()
          .describe("মাস YYYY-MM ফরম্যাটে (billingPeriod-এর বিকল্প)"),
      }),
      execute: async ({ className, classId, billingPeriod, month }) => {
        if (!hasPerm(ctx, "finance.view", FINANCE_ROLES)) {
          return {
            error: "আপনার রোলে জামাতভিত্তিক বকেয়া ফি দেখার অনুমতি নেই।",
          };
        }

        const adminClient = await createAdminClient();
        const targetPeriod = (billingPeriod || month || "").trim();
        const targetClassName = (className || "").trim().toLowerCase();

        const [{ data: fees, error: feeErr }, { data: classes }, { data: students }] =
          await Promise.all([
            adminClient
              .from("student_fees")
              .select(
                "id, student_id, student_name, class_id, class_name, fee_type_name, billing_period, payable_amount, paid_amount, due_amount, status"
              )
              .eq("madrasa_id", madrasaId)
              .in("status", ["UNPAID", "PARTIAL", "OVERDUE"]),
            adminClient
              .from("classes")
              .select("id, name")
              .eq("madrasa_id", madrasaId),
            adminClient
              .from("students")
              .select("id, first_name, last_name, roll_number, class_id")
              .eq("madrasa_id", madrasaId),
          ]);

        if (feeErr) return { error: feeErr.message };

        const classMap = new Map<string, string>();
        for (const c of classes || []) {
          classMap.set(c.id, String(c.name || ""));
        }
        const studentMap = new Map<string, any>();
        for (const s of students || []) {
          studentMap.set(s.id, s);
        }

        const matchedClassIds = new Set<string>();
        if (classId) matchedClassIds.add(classId);
        if (targetClassName) {
          for (const c of classes || []) {
            if (String(c.name || "").toLowerCase().includes(targetClassName)) {
              matchedClassIds.add(c.id);
            }
          }
        }

        const filtered = (fees || []).filter((f: any) => {
          const st = studentMap.get(f.student_id);
          const rowClassId = f.class_id || st?.class_id || "";
          const rowClassName = String(
            f.class_name || classMap.get(rowClassId) || ""
          ).toLowerCase();

          if (classId && rowClassId !== classId) return false;
          if (targetClassName) {
            const nameMatches = rowClassName.includes(targetClassName);
            const idMatches =
              matchedClassIds.size > 0 && matchedClassIds.has(rowClassId);
            if (!nameMatches && !idMatches) return false;
          }
          if (targetPeriod && String(f.billing_period || "") !== targetPeriod) {
            return false;
          }
          return true;
        });

        const dues = filtered.map((f: any) => {
          const st = studentMap.get(f.student_id);
          const due = Number(
            f.due_amount ??
              Math.max(
                0,
                Number(f.payable_amount || 0) - Number(f.paid_amount || 0)
              )
          );
          return {
            id: f.id,
            studentId: f.student_id,
            studentName:
              f.student_name ||
              (st
                ? `${st.first_name || ""} ${st.last_name || ""}`.trim()
                : "অজানা"),
            rollNumber: st?.roll_number || "-",
            className: f.class_name || classMap.get(f.class_id || st?.class_id) || "-",
            feeTypeName: f.fee_type_name || "মাসিক বেতন",
            billingPeriod: f.billing_period || "-",
            dueAmount: due,
            status: f.status,
          };
        });

        const totalDue = dues.reduce((sum, d) => sum + d.dueAmount, 0);

        return {
          className: className || null,
          billingPeriod: targetPeriod || null,
          count: dues.length,
          totalDue,
          totalOverdueAmount: totalDue,
          dues: dues.slice(0, 25),
        };
      },
    }),

    getTodayAbsentStudents: tool({
      description:
        "আজকের (বা নির্দিষ্ট তারিখের) অনুপস্থিত শিক্ষার্থীদের তালিকা দেখুন।",
      inputSchema: z.object({
        date: z
          .string()
          .optional()
          .describe("তারিখ YYYY-MM-DD ফরম্যাটে (ডিফল্ট আজ)"),
        classId: z.string().optional().describe("নির্দিষ্ট জামাতের UUID"),
      }),
      execute: async ({ date, classId }) => {
        if (!hasPerm(ctx, "attendance.view", STAFF_ACADEMIC_ROLES)) {
          return {
            error: "আপনার রোলে অনুপস্থিত শিক্ষার্থীদের তালিকা দেখার অনুমতি নেই।",
          };
        }
        const adminClient = await createAdminClient();
        const targetDate = (date || toDhakaDateString()).trim();

        const [{ data: attRows, error: attErr }, { data: students }] =
          await Promise.all([
            adminClient
              .from("attendance")
              .select("id, student_id, date, status")
              .eq("madrasa_id", madrasaId)
              .eq("date", targetDate),
            adminClient
              .from("students")
              .select("id, first_name, last_name, roll_number, parent_phone, class_id")
              .eq("madrasa_id", madrasaId),
          ]);

        if (attErr) return { error: attErr.message };

        const studentMap = new Map<string, any>();
        for (const s of students || []) {
          studentMap.set(s.id, s);
        }

        const absentRows = (attRows || []).filter(
          (r: any) => String(r.status || "").toLowerCase() === "absent"
        );

        const absentStudents = absentRows
          .map((r: any) => {
            const s = studentMap.get(r.student_id);
            if (classId && s?.class_id !== classId) return null;
            return {
              studentId: r.student_id,
              name: s
                ? `${s.first_name || ""} ${s.last_name || ""}`.trim()
                : "অজানা শিক্ষার্থী",
              rollNumber: s?.roll_number || "-",
              parentPhone: s?.parent_phone || "-",
              classId: s?.class_id || null,
              date: r.date,
            };
          })
          .filter(Boolean);

        return {
          date: targetDate,
          count: absentStudents.length,
          students: absentStudents,
          absentStudents,
        };
      },
    }),

    getEarlyWarningRisks: tool({
      description:
        "AI আর্লি ওয়ার্নিং সিস্টেম থেকে ড্রপআউট বা বকেয়া ঝুঁকিপূর্ণ শিক্ষার্থীদের তালিকা দেখুন।",
      inputSchema: z.object({
        riskLevel: z
          .enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"])
          .optional()
          .describe("ঝুঁকির মাত্রা ফিল্টার"),
        classId: z.string().optional().describe("জামাতের UUID"),
        limit: z.number().int().min(1).max(50).optional().default(15),
      }),
      execute: async ({ riskLevel, classId, limit }) => {
        if (!hasPerm(ctx, "analytics.early_warning", STAFF_ACADEMIC_ROLES)) {
          return {
            error: "আপনার রোলে আর্লি ওয়ার্নিং ঝুঁকি রিপোর্ট দেখার অনুমতি নেই।",
          };
        }
        try {
          const risks = await getStudentRiskScores(madrasaId, {
            riskLevel,
            classId,
            limit: limit ?? 15,
          });
          return {
            count: risks.length,
            risks,
          };
        } catch (err: any) {
          return { error: err?.message || "ঝুঁকি তথ্য আনা যায়নি।" };
        }
      },
    }),

    getFinancialAnomalies: tool({
      description:
        "শনাক্তকৃত আর্থিক ও বোর্ডিং অসঙ্গতি (Financial Anomalies) দেখুন।",
      inputSchema: z.object({
        status: z
          .enum(["OPEN", "INVESTIGATING", "RESOLVED", "DISMISSED"])
          .optional(),
        severity: z.enum(["INFO", "WARNING", "CRITICAL"]).optional(),
        limit: z.number().int().min(1).max(50).optional().default(15),
      }),
      execute: async ({ status, severity, limit }) => {
        if (!hasPerm(ctx, "anomaly.view", FINANCE_ROLES)) {
          return {
            error: "আপনার রোলে আর্থিক অসঙ্গতি রিপোর্ট দেখার অনুমতি নেই।",
          };
        }
        try {
          const anomalies = await fetchFinancialAnomalies(madrasaId, {
            status,
            severity,
            limit: limit ?? 15,
          });
          return {
            count: anomalies.length,
            anomalies,
          };
        } catch (err: any) {
          return { error: err?.message || "অসঙ্গতি তথ্য আনা যায়নি।" };
        }
      },
    }),

    getPendingApprovals: tool({
      description:
        "অপেক্ষমাণ অনুমোদনের অনুরোধসমূহ (Pending Approvals — খরচ, ফি মওকুফ, রেজাল্ট ইত্যাদি) দেখুন।",
      inputSchema: z.object({
        requestType: z.string().optional().describe("রিকোয়েস্টের ধরন"),
        limit: z.number().int().min(1).max(50).optional().default(15),
      }),
      execute: async ({ requestType, limit }) => {
        if (!hasPerm(ctx, "approval.view", APPROVAL_VIEW_ROLES)) {
          return {
            error: "আপনার রোলে অনুমোদন তালিকা দেখার অনুমতি নেই।",
          };
        }
        try {
          const requests = await listApprovalRequestsForMadrasa(
            madrasaId,
            {
              status: "PENDING",
              requestType,
            }
          );
          const visible=requests.filter(r=>canReadApproval(r,[ctx.role,...ctx.roles],ctx.summary.effectivePermissions));
          const sliced = visible.slice(0, limit ?? 15).map(publicApproval);
          return {
            count: sliced.length,
            totalPending: visible.length,
            requests: sliced,
          };
        } catch (err: any) {
          return { error: err?.message || "অনুমোদন তালিকা আনা যায়নি।" };
        }
      },
    }),

    getExecutiveBiSummary: tool({
      description:
        "মুহতামিমের জন্য এক্সিকিউটিভ BI সারসংক্ষেপ (বোর্ডিং খরচ বনাম আয়, যাকাত ফান্ড, বকেয়া অনুপাত, পরীক্ষার ফলাফল) দেখুন।",
      inputSchema: z.object({
        months: z.number().int().min(1).max(24).optional().default(6),
        sessionId: z.string().optional(),
      }),
      execute: async ({ months, sessionId }) => {
        if (!hasPerm(ctx, "finance.view", FINANCE_ROLES)) {
          return {
            error: "আপনার রোলে এক্সিকিউটিভ BI সারসংক্ষেপ দেখার অনুমতি নেই।",
          };
        }
        try {
          const snapshot = await getExecutiveBiSnapshot(madrasaId, {
            months: months ?? 6,
            sessionId: sessionId || null,
          });
          return { snapshot };
        } catch (err: any) {
          return { error: err?.message || "BI সারসংক্ষেপ আনা যায়নি।" };
        }
      },
    }),

    navigateToPage: tool({
      description:
        "ব্যবহারকারীকে সরাসরি QawmiERP-এর নির্দিষ্ট কোনো পেজে নিয়ে যেতে বা পেজ খুলতে এটি কল করুন।",
      inputSchema: z.object({
        path: z
          .string()
          .startsWith("/dashboard")
          .describe("টার্গেট পেজের URL পাথ, যেমন /dashboard/students"),
        label: z
          .string()
          .describe("বাটনের বাংলা নাম, যেমন 'শিক্ষার্থী তালিকায় যান'"),
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
        "যেকোনো রাইট অ্যাকশন — খরচ এন্ট্রি (create_expense/add_expense), ফি আদায় (collect_fee), বকেয়া ফি তৈরি (create_student_fee), বকেয়া তাগাদা পাঠানো (send_due_fee_reminders), অনুপস্থিত অভিভাবক নোটিশ (send_absent_guardian_notices), ঝুঁকি পুনরায় গণনা (trigger_risk_recalculation), অসঙ্গতি স্ক্যান (trigger_anomaly_scan), অনুমোদন সিদ্ধান্ত (submit_approval_decision), নোটিশ প্রকাশ (create_notice), হাজিরা মার্ক (mark_attendance), নতুন শিক্ষার্থী ভর্তি (create_student), পরীক্ষার নম্বর এন্ট্রি (enter_exam_mark), বা প্রশ্নব্যাংকে প্রশ্ন সংরক্ষণ (create_question) — করার আগে ব্যবহারকারীর কনফার্মেশন কার্ড দেখাতে এটি কল করুন।",
      inputSchema: z.object({
        actionType: z.enum([
          "create_expense",
          "add_expense",
          "collect_fee",
          "create_student_fee",
          "send_due_fee_reminders",
          "send_absent_guardian_notices",
          "trigger_risk_recalculation",
          "trigger_anomaly_scan",
          "submit_approval_decision",
          "create_notice",
          "mark_attendance",
          "create_student",
          "enter_exam_mark",
          "create_question",
        ]),
        title: z.string().describe("কনফার্মেশন কার্ডের শিরোনাম"),
        summary: z
          .string()
          .describe("কী কাজ করা হবে তার সংক্ষিপ্ত বাংলা বিবরণ"),
        payload: z.object({
          // create_expense / add_expense
          fund_id: z.string().optional().describe("ব্যবহারকারীর নির্বাচিত ফান্ডের সঠিক আইডি — অনুমান নয়"),
          restricted_beneficiary: z.string().max(300).optional(),
          category: z.string().optional(),
          amount: z.number().positive().optional(),
          description: z.string().optional(),
          expenseDate: z.string().optional(),
          sessionId: z.string().optional(),
          // collect_fee / create_student_fee
          studentFeeId: z.string().optional(),
          paymentMethod: z.string().optional(),
          paymentDate: z.string().optional(),
          feeTypeName: z.string().optional(),
          feeTypeId: z.string().optional().describe("প্রতিষ্ঠানের সচল ফি খাত"),
          billingPeriod: z.string().optional(),
          // send_absent_guardian_notices / send_due_fee_reminders
          date: z.string().optional(),
          // trigger_anomaly_scan
          lookbackDays: z.number().int().min(1).max(365).optional(),
          // submit_approval_decision
          requestId: z.string().optional(),
          decision: z.enum(["APPROVED", "REJECTED"]).optional(),
          notes: z.string().optional(),
          // create_notice
          noticeTitle: z.string().optional(),
          noticeContent: z.string().optional(),
          targetAudience: z
            .enum(["all", "teachers", "students", "parents"])
            .optional()
            .default("all"),
          // mark_attendance
          studentId: z.string().optional(),
          studentName: z.string().optional(),
          attendanceDate: z.string().optional(),
          attendanceStatus: z.enum(["Present", "Absent", "Leave"]).optional(),
          // create_student
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          fatherName: z.string().optional(),
          parentPhone: z.string().optional(),
          classId: z.string().optional(),
          className: z.string().optional(),
          address: z.string().optional(),
          // enter_exam_mark
          examId: z.string().optional(),
          examName: z.string().optional(),
          subjectName: z.string().optional(),
          marksObtained: z.number().min(0).optional(),
          totalMarks: z.number().positive().optional().default(100),
          // create_question
          subjectId: z.string().optional(),
          questionType: z
            .enum(["short", "descriptive", "mcq", "ibarat", "tahqeeq"])
            .optional()
            .default("short"),
          questionText: z.string().optional(),
          marks: z.number().positive().optional().default(5),
          difficulty: z
            .enum(["easy", "medium", "hard"])
            .optional()
            .default("medium"),
          chapter: z.string().optional(),
        }),
      }),
      execute: async ({ actionType, title, summary, payload }) => {
        const preview: Record<string, unknown> = { ...payload };

        if (actionType === "create_expense" || actionType === "add_expense") {
          if (!hasPerm(ctx, "finance.create", FINANCE_ROLES)) {
            return { error: "আপনার রোলে নতুন খরচ এন্ট্রি করার অনুমতি নেই।" };
          }
          if (!payload.amount || !payload.category || !payload.fund_id) {
            return {
              error:
                "খরচ এন্ট্রির জন্য ফান্ডের আইডি (fund_id), খাত (category) এবং টাকার পরিমাণ (amount) প্রয়োজন।",
            };
          }
        } else if (actionType === "collect_fee") {
          if (!hasPerm(ctx, "finance.create", FINANCE_ROLES)) {
            return { error: "আপনার রোলে ফি আদায় করার অনুমতি নেই।" };
          }
          if (!payload.studentId || !payload.amount) {
            return {
              error:
                "ফি আদায়ের জন্য শিক্ষার্থী (studentId) এবং টাকার পরিমাণ (amount) প্রয়োজন।",
            };
          }
        } else if (actionType === "create_student_fee") {
          if (!hasPerm(ctx, "finance.create", FINANCE_ROLES)) {
            return { error: "আপনার রোলে বকেয়া ফি তৈরি করার অনুমতি নেই।" };
          }
          if (!payload.studentId || !payload.amount) {
            return {
              error:
                "বকেয়া ফি তৈরির জন্য শিক্ষার্থী (studentId) এবং টাকার পরিমাণ (amount) প্রয়োজন।",
            };
          }
        } else if (actionType === "send_due_fee_reminders") {
          if (!hasPerm(ctx, "finance.view", FINANCE_ROLES)) {
            return {
              error: "আপনার রোলে বকেয়া ফি রিমাইন্ডার পাঠানোর অনুমতি নেই।",
            };
          }
        } else if (actionType === "send_absent_guardian_notices") {
          if (!hasPerm(ctx, "attendance.view", STAFF_ACADEMIC_ROLES)) {
            return {
              error:
                "আপনার রোলে অনুপস্থিত অভিভাবক নোটিশ পাঠানোর অনুমতি নেই।",
            };
          }
        } else if (actionType === "trigger_risk_recalculation") {
          if (
            !hasPerm(ctx, "analytics.early_warning.manage", STAFF_ACADEMIC_ROLES)
          ) {
            return {
              error: "আপনার রোলে ঝুঁকি স্কোর পুনরায় গণনার অনুমতি নেই।",
            };
          }
        } else if (actionType === "trigger_anomaly_scan") {
          if (!hasPerm(ctx, "anomaly.manage", FINANCE_ROLES)) {
            return {
              error: "আপনার রোলে আর্থিক অসঙ্গতি স্ক্যান চালানোর অনুমতি নেই।",
            };
          }
        } else if (actionType === "submit_approval_decision") {
          if (!hasPerm(ctx, "approval.approve", FINANCE_ROLES)) {
            return {
              error: "আপনার রোলে অনুমোদনের সিদ্ধান্ত দেওয়ার অনুমতি নেই।",
            };
          }
          if (!payload.requestId || !payload.decision) {
            return {
              error:
                "অনুমোদন সিদ্ধান্তের জন্য requestId এবং decision (APPROVED/REJECTED) প্রয়োজন।",
            };
          }
        } else if (actionType === "create_notice") {
          if (!hasPerm(ctx, "notification.view", STAFF_ACADEMIC_ROLES)) {
            return { error: "আপনার রোলে নোটিশ প্রকাশ করার অনুমতি নেই।" };
          }
          if (!payload.noticeTitle || !payload.noticeContent) {
            return {
              error: "নোটিশের জন্য শিরোনাম ও বিস্তারিত বিবরণ প্রয়োজন।",
            };
          }
        } else if (actionType === "mark_attendance") {
          if (!hasPerm(ctx, "attendance.view", STAFF_ACADEMIC_ROLES)) {
            return { error: "আপনার রোলে হাজিরা দেওয়ার অনুমতি নেই।" };
          }
          if (!payload.studentId || !payload.attendanceStatus) {
            return {
              error:
                "হাজিরা মার্ক করতে শিক্ষার্থীর ID এবং উপস্থিতি স্ট্যাটাস প্রয়োজন।",
            };
          }
        } else if (actionType === "create_student") {
          if (!hasPerm(ctx, "student.edit", STAFF_ACADEMIC_ROLES)) {
            return {
              error: "আপনার রোলে নতুন শিক্ষার্থী ভর্তি করার অনুমতি নেই।",
            };
          }
          if (!payload.firstName || !payload.classId) {
            return {
              error: "নতুন শিক্ষার্থী ভর্তি করতে নাম ও জামাত নির্বাচন প্রয়োজন।",
            };
          }
        } else if (actionType === "enter_exam_mark") {
          if (!hasPerm(ctx, "exam.edit", STAFF_ACADEMIC_ROLES)) {
            return {
              error: "আপনার রোলে পরীক্ষার নম্বর এন্ট্রি করার অনুমতি নেই।",
            };
          }
          if (
            !payload.examId ||
            !payload.studentId ||
            !payload.subjectName ||
            payload.marksObtained === undefined
          ) {
            return {
              error:
                "নম্বর এন্ট্রির জন্য পরীক্ষা, শিক্ষার্থী, বিষয় এবং প্রাপ্ত নম্বর প্রয়োজন।",
            };
          }
          const lock = await assertExamUnlocked(madrasaId, payload.examId);
          if (lock.locked) return {error: lock.error};
        } else if (actionType === "create_question") {
          if (!hasPerm(ctx, "exam.edit", STAFF_ACADEMIC_ROLES)) {
            return {
              error: "আপনার রোলে প্রশ্নব্যাংকে প্রশ্ন যোগ করার অনুমতি নেই।",
            };
          }
          if (!payload.classId || !payload.subjectId || !payload.questionText) {
            return {
              error: "প্রশ্ন সেভ করতে জামাত, বিষয় এবং প্রশ্নের লেখা প্রয়োজন।",
            };
          }
        }

        return {
          requiresConfirmation: true,
          actionId: `${actionType}-${Date.now()}`,
          actionType,
          title,
          summary,
          payload: {
            ...payload,
            billingPeriod: payload.billingPeriod || toDhakaMonthString(),
          },
          preview,
        };
      },
    }),
  };
}
