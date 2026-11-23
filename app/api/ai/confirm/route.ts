import {decideApprovalStepForActor} from "@/lib/approval-execution";
import {canReadSchoolFinance} from "@/lib/finance/access";
import {billingSession} from '@/lib/finance/billing-session';
import {saveUnpaidBill} from "@/lib/finance/invoice";
import {postExpenseForActor} from "@/lib/finance/expense";
import {collectSingleFee} from "@/lib/finance/fee-api";
import { saveExamMarks } from "@/app/actions/exams";
import { revalidatePath } from "next/cache";
import { getAuthUser, createAdminClient } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "@/app/actions/students";
import { loadServerPermissions } from "@/lib/permissions-server";
import { logAuditEvent } from "@/lib/audit-log";
import { toDhakaDateString, toDhakaMonthString } from "@/lib/date-utils";
import { generateNextUniqueStudentId } from "@/lib/student-utils";
import { dispatchNotification } from "@/lib/notifications/orchestrator";
import { recalculateStudentRiskScores } from "@/lib/early-warning-service";
import { runFinancialAnomalyScan } from "@/lib/anomaly-detection-service";
const PORTAL_ROLES = new Set(["student", "parent", "guardian"]);
const FINANCE_ROLES = new Set([
  "super_admin",
  "admin",
  "muhtamim",
  "naib_muhtamim",
  "accountant",
]);
const STAFF_ROLES = new Set([
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

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // ignore outside Next.js request lifecycle
  }
}

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
    if (
      !permCtx ||
      permCtx.status !== "ACTIVE" ||
      permCtx.roles.some((r) => PORTAL_ROLES.has(r))
    ) {
      return Response.json({ error: "এই কাজের অনুমতি নেই।" }, { status: 403 });
    }

    const body = await req.json();
    const actionType = String(body?.actionType || body?.action || "").trim();
    const payload = body?.payload || {};
    if (['create_expense','add_expense','collect_fee','create_student_fee','send_due_fee_reminders','trigger_anomaly_scan'].includes(actionType) &&
        !canReadSchoolFinance([permCtx.role,...permCtx.roles,permCtx.profile.primaryRole],permCtx.summary.effectivePermissions)) return Response.json({error:'হিসাবের অনুমতি নেই।'},{status:403});
    const adminClient = await createAdminClient();

    const recordAiAudit = async (params: {
      entityType: string;
      entityId?: string | null;
      summary: string;
      newValue?: unknown;
    }) => {
      await logAuditEvent({
        madrasaId,
        actorId: user.id,
        actorName: permCtx.profile.fullName || user.email || "AI Copilot User",
        actorEmail: user.email || null,
        actorRole: permCtx.role,
        module: "ai",
        action: "AI_ACTION_EXECUTED",
        entityType: params.entityType,
        entityId: params.entityId || null,
        summary: params.summary,
        newValue: params.newValue,
        metadata: { actionType, source: "ai_copilot" },
      });
    };

    if (actionType === "create_expense" || actionType === "add_expense") {
      const allowed =
        permCtx.roles.some((r) => FINANCE_ROLES.has(r)) ||
        permCtx.summary.effectivePermissions.includes("finance.create" as any);
      if (!allowed) {
        return Response.json(
          { error: "খরচ এন্ট্রি করার অনুমতি আপনার রোলে নেই।" },
          { status: 403 }
        );
      }

      const amount = Number(payload?.amount || 0);
      const category = String(payload?.category || "").trim();
      const description = String(payload?.description || category).trim();
      const expenseDate = String(
        payload?.expenseDate || toDhakaDateString()
      ).trim();

      if (!category || isNaN(amount) || amount <= 0) {
        return Response.json(
          { error: "সঠিক খাত ও টাকার পরিমাণ দিন।" },
          { status: 400 }
        );
      }

      // BUG-AI-2: Check academic_sessions lock / ARCHIVED status before inserting expense
      const { data: sessions,error:sessionError } = await adminClient
        .from("academic_sessions")
        .select("*")
        .eq("madrasa_id", madrasaId);

      if(sessionError) return Response.json({error:"শিক্ষাবর্ষ যাচাই করা যায়নি।"},{status:503});
      const sessionList = sessions || [];
      let targetSession: any = null;
      if (payload?.sessionId) {
        targetSession = sessionList.find((s: any) => s.id === payload.sessionId);
        if(!targetSession) return Response.json({error:"শিক্ষাবর্ষ মেলেনি।"},{status:400});
      } else {
        targetSession =
          sessionList.find(
            (s: any) =>
              s.start_date &&
              s.end_date &&
              expenseDate >= s.start_date &&
              expenseDate <= s.end_date
          ) || sessionList.find((s: any) => s.is_current);
      }

      if (
        targetSession &&
        (targetSession.is_locked === true ||
          String(targetSession.status || "").toUpperCase() === "ARCHIVED")
      ) {
        return Response.json(
          {
            error:
              "লক করা বা আর্কাইভড শিক্ষাবর্ষে (Academic Session) খরচ এন্ট্রি করা যাবে না।",
          },
          { status: 403 }
        );
      }

      const form=new FormData();
      for(const [k,v] of Object.entries({category,amount,expense_date:expenseDate,description,fund_id:payload.fund_id,fund_name:payload.fund_name,restricted_beneficiary:payload.restricted_beneficiary})) if(v!=null) form.set(k,String(v));
      const result=await postExpenseForActor(madrasaId,user.id,form);
      if(result.error) return Response.json({error:result.error},{status:400});
      if(result.pendingApproval) return Response.json({success:true,pendingApproval:true,approvalRequestId:result.approvalRequestId,message:result.message},{status:202});
      const data=result.expense;
      await recordAiAudit({
        entityType: "expense",
        entityId: data?.id,
        summary: `এআই কো-পাইলটের মাধ্যমে খরচ এন্ট্রি: ${category} (৳${amount})`,
        newValue: { category, amount, expenseDate },
      });

      safeRevalidate("/dashboard/accounting/expenses");
      safeRevalidate("/dashboard/accounting/reports");
      safeRevalidate("/dashboard");

      return Response.json({
        success: true,
        id: data?.id,
        message: `খরচ সফলভাবে সেভ হয়েছে: ${category} — ৳${amount.toLocaleString()}`,
      });
    }

    if (actionType === "collect_fee") {
      const allowed =
        permCtx.roles.some((r) => FINANCE_ROLES.has(r)) ||
        permCtx.summary.effectivePermissions.includes("finance.create" as any);
      if (!allowed) {
        return Response.json(
          { error: "ফি আদায় করার অনুমতি আপনার রোলে নেই।" },
          { status: 403 }
        );
      }

      const studentId = String(payload?.studentId || "").trim();
      const studentFeeId = payload?.studentFeeId
        ? String(payload.studentFeeId).trim()
        : null;
      const amount = Number(payload?.amount || 0);
      const paymentMethod = String(payload?.paymentMethod || "Cash").trim();
      const paymentDate = String(
        payload?.paymentDate || toDhakaDateString()
      ).trim();

      if (!studentId || isNaN(amount) || amount <= 0) {
        return Response.json(
          { error: "সঠিক শিক্ষার্থী ও টাকার পরিমাণ দিন।" },
          { status: 400 }
        );
      }

      let paymentRow;
      try {paymentRow=await collectSingleFee(adminClient,madrasaId,user.id,{student_id:studentId,student_fee_id:studentFeeId,amount,payment_method:paymentMethod,payment_date:paymentDate,idempotency_key:payload.idempotency_key,receipt_no:payload.receiptNo,fund_id:payload.fund_id});}
      catch (err:any) {return Response.json({error:err.message},{status:400});}
      const receiptNo=paymentRow.receipt_no;
      await recordAiAudit({
        entityType: "fee_payment",
        entityId: paymentRow?.id,
        summary: `এআই কো-পাইলটের মাধ্যমে ফি আদায়: ৳${amount} (রসিদ: ${receiptNo})`,
        newValue: { studentId, studentFeeId, amount, paymentMethod, receiptNo },
      });

      safeRevalidate("/dashboard/accounting");
      safeRevalidate("/dashboard/accounting/due");
      safeRevalidate("/dashboard");

      return Response.json({
        success: true,
        id: paymentRow?.id,
        receiptNo,
        message: `ফি সফলভাবে আদায় হয়েছে: ৳${amount.toLocaleString()} (রসিদ: ${receiptNo})`,
      });
    }

    if (actionType === "create_student_fee") {
      const allowed =
        permCtx.roles.some((r) => FINANCE_ROLES.has(r)) ||
        permCtx.summary.effectivePermissions.includes("finance.create" as any);
      if (!allowed) {
        return Response.json(
          { error: "বকেয়া ফি তৈরি করার অনুমতি আপনার রোলে নেই।" },
          { status: 403 }
        );
      }

      const studentId = String(payload?.studentId || "").trim();
      const feeTypeName = String(
        payload?.feeTypeName || payload?.fee_type_name || "মাসিক বেতন"
      ).trim();
      const billingPeriod = String(
        payload?.billingPeriod || payload?.billing_period || toDhakaMonthString()
      ).trim();
      const amount = Number(payload?.amount || 0);

      if (!studentId || isNaN(amount) || amount <= 0) {
        return Response.json(
          { error: "সঠিক শিক্ষার্থী ও ফি-র পরিমাণ দিন।" },
          { status: 400 }
        );
      }

      let feeRow;
      try {
        const sessionId=await billingSession(adminClient,madrasaId,payload.sessionId);
        feeRow=await saveUnpaidBill(adminClient,madrasaId,{student_id:studentId,fee_type_id:payload.feeTypeId,fee_type_name:feeTypeName,
          session_id:sessionId,billing_period:billingPeriod,base_amount:amount,fund_id:payload.fund_id});
      } catch(e:any) { return Response.json({error:e.message},{status:400}); }

      await recordAiAudit({
        entityType: "student_fee",
        entityId: feeRow?.id,
        summary: `এআই কো-পাইলটের মাধ্যমে বকেয়া ফি তৈরি: ${feeTypeName} (${billingPeriod}) — ৳${amount}`,
        newValue: {
          studentId,
          fee_type_name: feeTypeName,
          billing_period: billingPeriod,
          payable_amount: amount,
        },
      });

      safeRevalidate("/dashboard/accounting");
      safeRevalidate("/dashboard/accounting/due");

      return Response.json({
        success: true,
        id: feeRow?.id,
        message: `শিক্ষার্থীর ফি সফলভাবে তৈরি হয়েছে: ${feeTypeName} — ৳${amount.toLocaleString()}`,
      });
    }

    if (actionType === "send_due_fee_reminders") {
      // BUG-AI-5: Finance RBAC + real summed student_fees.due_amount
      const allowed =
        permCtx.roles.some((r) => FINANCE_ROLES.has(r)) ||
        permCtx.summary.effectivePermissions.includes("finance.view" as any);
      if (!allowed) {
        return Response.json(
          { error: "বকেয়া ফি রিমাইন্ডার পাঠানোর অনুমতি আপনার রোলে নেই।" },
          { status: 403 }
        );
      }

      const targetClassId = String(payload?.classId || "").trim();
      const targetClassName = String(payload?.className || "")
        .trim()
        .toLowerCase();

      const [{ data: fees, error: feeErr }, { data: students }, { data: classes }] =
        await Promise.all([
          adminClient
            .from("student_fees")
            .select(
              "id, student_id, class_id, class_name, due_amount, payable_amount, paid_amount, status"
            )
            .eq("madrasa_id", madrasaId)
            .in("status", ["UNPAID", "PARTIAL", "OVERDUE"]),
          adminClient
            .from("students")
            .select("id, first_name, last_name, parent_phone, class_id")
            .eq("madrasa_id", madrasaId),
          adminClient
            .from("classes")
            .select("id, name")
            .eq("madrasa_id", madrasaId),
        ]);

      if (feeErr) {
        return Response.json({ error: feeErr.message }, { status: 500 });
      }

      const studentMap = new Map<string, any>();
      for (const s of students || []) studentMap.set(s.id, s);

      const classMap = new Map<string, string>();
      for (const c of classes || []) classMap.set(c.id, String(c.name || ""));

      const dueByStudent = new Map<string, number>();
      for (const f of fees || []) {
        const due = Number(
          f.due_amount ??
            Math.max(
              0,
              Number(f.payable_amount || 0) - Number(f.paid_amount || 0)
            )
        );
        if (due <= 0) continue;

        const st = studentMap.get(f.student_id);
        const rowClassId = f.class_id || st?.class_id || "";
        const rowClassName = String(
          f.class_name || classMap.get(rowClassId) || ""
        ).toLowerCase();

        if (targetClassId && rowClassId !== targetClassId) continue;
        if (targetClassName && !rowClassName.includes(targetClassName)) continue;

        dueByStudent.set(
          f.student_id,
          (dueByStudent.get(f.student_id) || 0) + due
        );
      }

      let sentCount = 0;
      for (const [studentId, totalDue] of dueByStudent.entries()) {
        const st = studentMap.get(studentId);
        const studentName = st
          ? `${st.first_name || ""} ${st.last_name || ""}`.trim()
          : "শিক্ষার্থী";
        const bodyText = `প্রিয় অভিভাবক, ${studentName}-এর মোট বকেয়া ফি ৳${totalDue}। অনুগ্রহ করে দ্রুত পরিশোধ করুন।`;

        await dispatchNotification("fee.overdue", {
          madrasaId,
          recipientStudentId: studentId,
          recipientPhone: st?.parent_phone || null,
          subject: "বকেয়া ফি তাগাদা",
          body: bodyText,
          variables: {
            StudentName: studentName,
            DueAmount: totalDue,
            TotalDue: totalDue,
          },
          actorId: user.id,
        });
        sentCount++;
      }

      await recordAiAudit({
        entityType: "due_fee_reminders",
        summary: `এআই কো-পাইলটের মাধ্যমে ${sentCount} জন অভিভাবককে বকেয়া ফি রিমাইন্ডার পাঠানো হয়েছে`,
        newValue: { sentCount, className: payload?.className || null },
      });

      return Response.json({
        success: true,
        sentCount,
        message: `${sentCount} জন শিক্ষার্থীর অভিভাবককে প্রকৃত বকেয়ার তাগাদা পাঠানো হয়েছে।`,
      });
    }

    if (actionType === "send_absent_guardian_notices") {
      const allowed =
        permCtx.roles.some((r) => STAFF_ROLES.has(r)) ||
        permCtx.summary.effectivePermissions.includes("attendance.view" as any);
      if (!allowed) {
        return Response.json(
          { error: "অনুপস্থিত অভিভাবক নোটিশ পাঠানোর অনুমতি আপনার রোলে নেই।" },
          { status: 403 }
        );
      }

      const targetDate = String(payload?.date || toDhakaDateString()).trim();
      const [{ data: attRows, error: attErr }, { data: students }] =
        await Promise.all([
          adminClient
            .from("attendance")
            .select("id, student_id, date, status")
            .eq("madrasa_id", madrasaId)
            .eq("date", targetDate),
          adminClient
            .from("students")
            .select("id, first_name, last_name, parent_phone, class_id")
            .eq("madrasa_id", madrasaId),
        ]);

      if (attErr) {
        return Response.json({ error: attErr.message }, { status: 500 });
      }

      const studentMap = new Map<string, any>();
      for (const s of students || []) studentMap.set(s.id, s);

      const absentRows = (attRows || []).filter(
        (r: any) => String(r.status || "").toLowerCase() === "absent"
      );

      let sentCount = 0;
      for (const r of absentRows) {
        const st = studentMap.get(r.student_id);
        if (payload?.classId && st?.class_id !== payload.classId) continue;
        const studentName = st
          ? `${st.first_name || ""} ${st.last_name || ""}`.trim()
          : "শিক্ষার্থী";

        await dispatchNotification("attendance.absent", {
          madrasaId,
          recipientStudentId: r.student_id,
          recipientPhone: st?.parent_phone || null,
          subject: "অনুপস্থিতি নোটিশ",
          body: `আসসালামু আলাইকুম, আপনার সন্তান ${studentName} আজ (${targetDate}) মাদ্রাসায় অনুপস্থিত।`,
          variables: {
            StudentName: studentName,
            Date: targetDate,
          },
          actorId: user.id,
        });
        sentCount++;
      }

      await recordAiAudit({
        entityType: "absent_guardian_notices",
        summary: `এআই কো-পাইলটের মাধ্যমে ${targetDate} তারিখের ${sentCount} জন অনুপস্থিত শিক্ষার্থীর অভিভাবককে নোটিশ পাঠানো হয়েছে`,
        newValue: { date: targetDate, sentCount },
      });

      return Response.json({
        success: true,
        sentCount,
        message: `${sentCount} জন অনুপস্থিত শিক্ষার্থীর অভিভাবককে নোটিশ পাঠানো হয়েছে।`,
      });
    }

    if (actionType === "trigger_risk_recalculation") {
      const allowed =
        permCtx.roles.some((r) => STAFF_ROLES.has(r) || FINANCE_ROLES.has(r)) ||
        permCtx.summary.effectivePermissions.includes(
          "analytics.early_warning.manage" as any
        );
      if (!allowed) {
        return Response.json(
          { error: "ঝুঁকি স্কোর পুনরায় গণনার অনুমতি আপনার রোলে নেই।" },
          { status: 403 }
        );
      }

      const summary = await recalculateStudentRiskScores(madrasaId, {
        classId: payload?.classId || undefined,
      });

      await recordAiAudit({
        entityType: "early_warning",
        summary: `এআই কো-পাইলটের মাধ্যমে আর্লি ওয়ার্নিং ঝুঁকি স্কোর পুনরায় গণনা সম্পন্ন হয়েছে`,
        newValue: summary,
      });

      safeRevalidate("/dashboard/analytics/early-warning");
      safeRevalidate("/dashboard");

      return Response.json({
        success: true,
        summary,
        message: `সকল শিক্ষার্থীর আর্লি ওয়ার্নিং ঝুঁকি স্কোর সফলভাবে পুনরায় গণনা হয়েছে।`,
      });
    }

    if (actionType === "trigger_anomaly_scan") {
      const allowed =
        permCtx.roles.some((r) => FINANCE_ROLES.has(r)) ||
        permCtx.summary.effectivePermissions.includes("anomaly.manage" as any);
      if (!allowed) {
        return Response.json(
          { error: "আর্থিক অসঙ্গতি স্ক্যান চালানোর অনুমতি আপনার রোলে নেই।" },
          { status: 403 }
        );
      }

      const lookbackDays = payload?.lookbackDays
        ? Number(payload.lookbackDays)
        : 30;
      const scanResult = await runFinancialAnomalyScan(madrasaId, {
        lookbackDays,
      });

      await recordAiAudit({
        entityType: "financial_anomalies",
        summary: `এআই কো-পাইলটের মাধ্যমে আর্থিক অসঙ্গতি স্ক্যান সম্পন্ন হয়েছে (${lookbackDays} দিন)`,
        newValue: scanResult,
      });

      safeRevalidate("/dashboard/accounting/anomalies");
      safeRevalidate("/dashboard");

      return Response.json({
        success: true,
        scanResult,
        message: `আর্থিক ও বোর্ডিং অসঙ্গতি স্ক্যান সম্পন্ন হয়েছে।`,
      });
    }

    if (actionType === "submit_approval_decision") {
      const allowed =
        permCtx.roles.some((r) => FINANCE_ROLES.has(r)) ||
        permCtx.summary.effectivePermissions.includes("approval.approve" as any);
      if (!allowed) {
        return Response.json(
          { error: "অনুমোদনের সিদ্ধান্ত দেওয়ার অনুমতি আপনার রোলে নেই।" },
          { status: 403 }
        );
      }

      const requestId = String(payload?.requestId || "").trim();
      const decision = String(payload?.decision || "")
        .trim()
        .toUpperCase() as "APPROVED" | "REJECTED";
      const notes = String(payload?.notes || "").trim();

      if (!requestId || !["APPROVED", "REJECTED"].includes(decision)) {
        return Response.json(
          { error: "সঠিক requestId এবং decision (APPROVED/REJECTED) দিন।" },
          { status: 400 }
        );
      }

      // Confirmation is not approval. Use the same decision, step-up and execution
      // service as the approvals page instead of merely setting APPROVED here.
      const result=await decideApprovalStepForActor({madrasaId,userId:user.id,
        actorName:permCtx.profile.fullName || 'অনুমোদনকারী',actorRole:permCtx.role,roles:permCtx.roles,
        permissions:permCtx.summary.effectivePermissions,requestId,decision,notes,stepUpToken:req.headers.get('x-step-up-token')});
      if(result.error) return Response.json({error:result.error,stepUpRequired:result.stepUpRequired,code:result.errorCode,actionScope:result.actionScope},{status:result.statusCode || 400});
      await recordAiAudit({entityType:'approval_request',entityId:requestId,summary:`অনুমোদনের সিদ্ধান্ত: ${decision}`,
        newValue:{requestId,decision,status:result.status,executed:result.executionResult?.executed}});
      return Response.json(result);
    }

    if (actionType === "create_notice") {
      const allowed =
        permCtx.roles.some((r) => STAFF_ROLES.has(r)) ||
        permCtx.summary.effectivePermissions.includes(
          "notification.view" as any
        );
      if (!allowed) {
        return Response.json(
          { error: "নোটিশ প্রকাশ করার অনুমতি আপনার রোলে নেই।" },
          { status: 403 }
        );
      }

      const title = String(payload?.noticeTitle || "").trim();
      const content = String(payload?.noticeContent || "").trim();
      const target_audience = String(payload?.targetAudience || "all").trim();

      if (!title || !content) {
        return Response.json(
          { error: "নোটিশের শিরোনাম ও বিস্তারিত প্রয়োজন।" },
          { status: 400 }
        );
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

      await recordAiAudit({
        entityType: "notice",
        entityId: data?.id,
        summary: `এআই কো-পাইলটের মাধ্যমে নোটিশ প্রকাশ: "${title}"`,
        newValue: { title, target_audience },
      });

      safeRevalidate("/dashboard/communication/notices");
      safeRevalidate("/dashboard/communication");

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
        return Response.json(
          { error: "হাজিরা দেওয়ার অনুমতি আপনার রোলে নেই।" },
          { status: 403 }
        );
      }

      const studentId = String(payload?.studentId || "").trim();
      const status = String(payload?.attendanceStatus || "").trim();
      const date = String(
        payload?.attendanceDate || toDhakaDateString()
      ).trim();

      if (!studentId || !["Present", "Absent", "Leave"].includes(status)) {
        return Response.json(
          { error: "সঠিক শিক্ষার্থী ও হাজিরা স্ট্যাটাস দিন।" },
          { status: 400 }
        );
      }

      const { error } = await adminClient.from("attendance").upsert(
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

      await recordAiAudit({
        entityType: "attendance",
        entityId: studentId,
        summary: `এআই কো-পাইলটের মাধ্যমে হাজিরা: ${studentId} (${date} -> ${status})`,
        newValue: { studentId, date, status },
      });

      safeRevalidate("/dashboard/attendance");
      safeRevalidate("/dashboard");

      const statusBn =
        status === "Present"
          ? "উপস্থিত"
          : status === "Absent"
          ? "অনুপস্থিত"
          : "ছুটি";
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
        return Response.json(
          { error: "নতুন শিক্ষার্থী ভর্তি করার অনুমতি আপনার রোলে নেই।" },
          { status: 403 }
        );
      }

      const firstName = String(payload?.firstName || "").trim();
      const lastName = String(payload?.lastName || "").trim();
      const classId = String(payload?.classId || "").trim();
      const fatherName = String(payload?.fatherName || "").trim();
      const parentPhone = String(payload?.parentPhone || "").trim();
      const address = String(payload?.address || "").trim();

      if (!firstName || !classId) {
        return Response.json(
          { error: "শিক্ষার্থীর নাম ও জামাত প্রয়োজন।" },
          { status: 400 }
        );
      }

      const [{ data: madrasaRow }, { data: existingStudents }] =
        await Promise.all([
          adminClient
            .from("madrasas")
            .select("prefix")
            .eq("id", madrasaId)
            .maybeSingle(),
          adminClient
            .from("students")
            .select("id, roll_number, class_id")
            .eq("madrasa_id", madrasaId),
        ]);

      const usedIds = new Set<string>(
        (existingStudents || [])
          .map((s: any) => String(s.roll_number || "").trim())
          .filter(Boolean)
      );
      const madrasaPrefix = (madrasaRow as any)?.prefix || "QM";
      const requestedRoll = String(
        payload?.rollNumber ?? payload?.roll_number ?? ""
      ).trim();
      const rollNumber =
        requestedRoll && !usedIds.has(requestedRoll)
          ? requestedRoll
          : generateNextUniqueStudentId(
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

      const finalRoll = data?.roll_number || rollNumber;

      await recordAiAudit({
        entityType: "student",
        entityId: data?.id,
        summary: `এআই কো-পাইলটের মাধ্যমে শিক্ষার্থী ভর্তি: ${firstName} ${lastName}`,
        newValue: { firstName, lastName, classId, rollNumber: finalRoll },
      });

      try {
        const { dispatchWebhookEvent } = await import("@/lib/webhooks/dispatcher");
        await dispatchWebhookEvent(madrasaId, "student.admitted", {
          student_id: data?.id,
          first_name: firstName,
          last_name: lastName || "",
          roll_number: finalRoll || null,
          class_id: classId || null,
          parent_phone: parentPhone || null,
        });
      } catch {
        // non-blocking webhook dispatch
      }

      if (parentPhone) {
        try {
          await dispatchNotification("student.admitted", {
            madrasaId,
            recipientPhone: parentPhone,
            variables: {
              StudentName: `${firstName} ${lastName}`.trim(),
              RollNumber: finalRoll,
              ClassId: classId,
            },
          });
        } catch {
          // non-blocking welcome notification
        }
      }

      safeRevalidate("/dashboard/students");
      safeRevalidate("/dashboard");

      return Response.json({
        success: true,
        id: data?.id,
        message: `নতুন শিক্ষার্থী "${`${firstName} ${lastName}`.trim()}" সফলভাবে ভর্তি হয়েছে (আইডি: ${finalRoll})।`,
      });
    }

    if (actionType === "enter_exam_mark") {
      const allowed =
        permCtx.roles.some((r) => STAFF_ROLES.has(r)) ||
        permCtx.summary.effectivePermissions.includes("exam.edit" as any);
      if (!allowed) {
        return Response.json(
          { error: "পরীক্ষার নম্বর এন্ট্রি করার অনুমতি আপনার রোলে নেই।" },
          { status: 403 }
        );
      }

      const examId = String(payload?.examId || "").trim();
      const studentId = String(payload?.studentId || "").trim();
      const subjectName = String(payload?.subjectName || "").trim();
      const marksObtained = Number(payload?.marksObtained);
      const totalMarks = Number(payload?.totalMarks || 100);

      if (
        !examId ||
        !studentId ||
        !subjectName ||
        isNaN(marksObtained) ||
        marksObtained < 0
      ) {
        return Response.json(
          { error: "সঠিক পরীক্ষা, শিক্ষার্থী, বিষয় ও নম্বর দিন।" },
          { status: 400 }
        );
      }

      const { data: student } = await adminClient.from("students").select("class_id")
        .eq("madrasa_id", madrasaId).eq("id", studentId).maybeSingle();
      // Use the same exam freeze, roster/subject, component and audit rules as manual entry.
      const result = await saveExamMarks(examId, subjectName, [{ student_id: studentId,
        marks_obtained: marksObtained, total_marks: totalMarks }], payload.classId || student?.class_id);
      if (result.error) return Response.json(result, { status: "code" in result && result.code === "EXAM_LOCKED" ? 409 : 403 });

      await recordAiAudit({
        entityType: "exam_result",
        entityId: `${examId}:${studentId}`,
        summary: `এআই কো-পাইলটের মাধ্যমে পরীক্ষার নম্বর: ${subjectName} (${marksObtained}/${totalMarks})`,
        newValue: { examId, studentId, subjectName, marksObtained, totalMarks },
      });

      safeRevalidate(`/dashboard/exams/${examId}/marks`);
      safeRevalidate("/dashboard/exams");

      return Response.json({
        success: true,
        message: `${payload?.studentName || "শিক্ষার্থী"}-এর "${subjectName}" বিষয়ে ${marksObtained}/${totalMarks} নম্বর সেভ হয়েছে।`,
      });
    }

    if (actionType === "create_question") {
      const allowed =
        permCtx.roles.some((r) => STAFF_ROLES.has(r)) ||
        permCtx.summary.effectivePermissions.includes("exam.edit" as any);
      if (!allowed) {
        return Response.json(
          { error: "প্রশ্নব্যাংকে প্রশ্ন যোগ করার অনুমতি আপনার রোলে নেই।" },
          { status: 403 }
        );
      }

      const classId = String(payload?.classId || "").trim();
      const subjectId = String(payload?.subjectId || "").trim();
      const questionText = String(payload?.questionText || "").trim();
      const questionType = String(payload?.questionType || "short").trim();
      const marks = Number(payload?.marks || 5);
      const difficulty = String(payload?.difficulty || "medium").trim();
      const chapter = String(payload?.chapter || "সাধারণ").trim();

      if (!classId || !subjectId || !questionText) {
        return Response.json(
          { error: "প্রশ্ন সংরক্ষণের জন্য জামাত, বিষয় ও প্রশ্ন প্রয়োজন।" },
          { status: 400 }
        );
      }

      const optionsPayload = { chapter, difficulty };
      let { error } = await adminClient.from("question_bank").insert({
        madrasa_id: madrasaId,
        class_id: classId,
        subject_id: subjectId,
        question_type: questionType,
        question_text: questionText,
        marks,
        chapter,
        difficulty,
        options: optionsPayload,
      });

      if (error) {
        const retry = await adminClient.from("question_bank").insert({
          madrasa_id: madrasaId,
          class_id: classId,
          subject_id: subjectId,
          question_type: questionType,
          question_text: questionText,
          marks,
          options: optionsPayload,
        });
        error = retry.error;
      }

      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }

      await recordAiAudit({
        entityType: "question_bank",
        summary: `এআই কো-পাইলটের মাধ্যমে প্রশ্নব্যাংকে প্রশ্ন যোগ (${marks} নম্বর)`,
        newValue: { classId, subjectId, questionType, marks },
      });

      safeRevalidate("/dashboard/exams/question-bank");

      return Response.json({
        success: true,
        message: `প্রশ্নটি সফলভাবে প্রশ্নব্যাংকে সংরক্ষিত হয়েছে (${marks} নম্বর)।`,
      });
    }

    return Response.json({ error: "অজানা অ্যাকশন টাইপ।" }, { status: 400 });
  } catch (err: any) {
    console.error("AI confirm error:", err);
    return Response.json(
      { error: err?.message || "কাজটি সম্পন্ন করতে সমস্যা হয়েছে।" },
      { status: 500 }
    );
  }
}
