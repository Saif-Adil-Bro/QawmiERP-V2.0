// Internal API/Server Action helpers. Caller-supplied actor contexts are never exported as Next actions.
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/audit-log";
import { requirePermission } from "@/lib/permissions-server";
import { dispatchNotification } from "@/lib/notifications/orchestrator";
import {
  calculateSlaDueAt,
  canActorDecideStep,
  evaluateStepProgression,
  getApprovalRequestByIdForMadrasa,
  insertApprovalRequestRecord,
  isSlaBreached,
  listWorkflowsForMadrasa,
  matchApprovalWorkflow,
  recordStepDecisionAndUpdateRequest,
  updateApprovalRequestStatus,
  type ApprovalRequestRecord,
  type ApprovalWorkflowStep,
} from "@/lib/approval-workflow";
import {
  financeApprovalError,
  hasFinanceAction,
  isFinancialRequest,
  canReadApproval,
  publicApproval,
  financeWorkflowTerms,
} from "@/lib/finance/approval-terms";

import { cashierPayment } from "@/lib/finance/cashier";
import { postExpense } from "@/lib/finance/expense";
import { editStaff, promoteStaff } from "@/lib/finance/staff-edit";
import { publishExam } from "@/lib/portal/publish";
import { issueStudentCertificate } from "@/app/actions/certificates";

function generateUuid(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `appr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export interface SubmitApprovalRequestInput {
  requestType?: string;
  request_type?: string;
  type?: string;
  title: string;
  description?: string;
  entityType?: string;
  entity_type?: string;
  targetId?: string;
  target_id?: string;
  targetName?: string;
  target_name?: string;
  amount?: number;
  payload?: Record<string, any>;
  payloadData?: Record<string, any>;
  slaHours?: number;
}

// Filing a manual request or cancelling your own one does not confer the
// right to inspect the school's routing rules, threshold or other contracts.
function submissionReceipt(record: ApprovalRequestRecord) {
  const {
    id,
    madrasa_id,
    request_type,
    title,
    description,
    target_id,
    target_name,
    amount,
    payload,
    requested_by,
    requester_id,
    requested_by_name,
    requested_by_role,
    created_at,
    status,
  } = publicApproval(record);
  return {
    id,
    madrasa_id,
    request_type,
    title,
    description,
    target_id,
    target_name,
    amount,
    payload,
    requested_by,
    requester_id,
    requested_by_name,
    requested_by_role,
    created_at,
    status,
  };
}

export async function submitApprovalRequestForActor(
  actor: {
    userId: string;
    madrasaId: string;
    actorName: string;
    actorRole: string;
  },
  input: SubmitApprovalRequestInput,
): Promise<{
  success?: boolean;
  error?: string;
  message?: string;
  request?: Pick<ApprovalRequestRecord, keyof ReturnType<typeof submissionReceipt>>;
  id?: string;
}> {
  const requestType = String(
    input.requestType || input.request_type || input.type || "",
  ).trim();
  if (!requestType) {
    return { error: "অনুমোদনের ধরন (requestType) আবশ্যক।" };
  }

  const title = String(input.title || "").trim();
  if (!title) {
    return { error: "অনুমোদনের শিরোনাম আবশ্যক।" };
  }

  const amount = Number(input.amount ?? 0);
  if (hasFinanceAction(input.payload || input.payloadData))
    return {
      error: "আর্থিক আবেদনটি সংশ্লিষ্ট ফি, খরচ বা কর্মীর ফর্ম থেকে জমা দিন।",
    };
  const workflows = await listWorkflowsForMadrasa(actor.madrasaId);
  const matched = matchApprovalWorkflow(workflows, requestType, amount);

  const steps = matched?.steps || [];
  const totalSteps = Math.max(1, steps.length);
  const firstStep = steps[0] || null;
  const slaHours = Number(firstStep?.sla_hours ?? input.slaHours ?? 24);
  const now = new Date();
  const slaDueAt = calculateSlaDueAt(now, slaHours);

  const requestId = generateUuid();
  const record: ApprovalRequestRecord = {
    id: requestId,
    madrasa_id: actor.madrasaId,
    workflow_id: matched?.id || null,
    request_type: requestType,
    title,
    description: input.description?.trim() || "",
    entity_type:
      input.entityType || input.entity_type || requestType.toLowerCase(),
    target_id: String(input.targetId || input.target_id || requestId),
    target_name: input.targetName || input.target_name || undefined,
    amount: Number.isFinite(amount) ? amount : 0,
    threshold_amount: matched?.min_amount ?? 0,
    payload: input.payload || input.payloadData || {},
    requested_by: actor.userId,
    requester_id: actor.userId,
    requested_by_name: actor.actorName,
    requested_by_role: actor.actorRole,
    current_step_order: 1,
    total_steps: totalSteps,
    status: "PENDING",
    sla_due_at: slaDueAt,
    created_at: now.toISOString(),
    steps,
    decisions: [],
  };

  const saved = await insertApprovalRequestRecord(actor.madrasaId, record);

  await logAuditEvent({
    madrasaId: actor.madrasaId,
    actorId: actor.userId,
    actorName: actor.actorName,
    actorRole: actor.actorRole,
    module: "approvals",
    action: "APPROVAL_REQUESTED",
    entityType: "approval_request",
    entityId: saved.id,
    entityLabel: title,
    summary: `নতুন অনুমোদনের আবেদন (${requestType}): ${title}`,
    newValue: {
      request_type: requestType,
      amount: record.amount,
      workflow_id: record.workflow_id,
      total_steps: totalSteps,
    },
    severity: "INFO",
  });

  try {
    await dispatchNotification("approval.requested", {
      madrasaId: actor.madrasaId,
      recipientUserId: firstStep?.approver_user_id || null,
      channels: ["in_app", "push", "sms", "email"],
      subject: `নতুন অনুমোদনের আবেদন (${requestType}): ${title}`,
      body: `${actor.actorName} একটি নতুন ${requestType} অনুমোদনের আবেদন (${title}) দাখিল করেছেন। অনুগ্রহ করে পর্যালোচনা করুন।`,
      variables: {
        RequestType: requestType,
        Title: title,
        Amount: record.amount ?? 0,
        ActorName: actor.actorName,
      },
      actorId: actor.userId,
      metadata: {
        requestId: saved.id,
        requestType,
        stepOrder: 1,
        approverRole: firstStep?.approver_role || null,
      },
    });
  } catch {
    // non-blocking notification dispatch
  }

  revalidatePath("/dashboard/approvals");
  revalidatePath("/dashboard/users");

  return {
    success: true,
    id: saved.id,
    request: isFinancialRequest(saved) ? submissionReceipt(saved) : saved,
    message: "অনুমোদনের আবেদন সফলভাবে দাখিল করা হয়েছে!",
  };
}

function isStepOrRequestCritical(
  request: ApprovalRequestRecord,
  currentStep?: ApprovalWorkflowStep | null,
): boolean {
  if (
    currentStep?.require_step_up ||
    currentStep?.is_critical ||
    (hasFinanceAction(request.payload) &&
      request.current_step_order >= request.total_steps)
  )
    return true;
  if (
    currentStep &&
    currentStep.require_step_up === false &&
    !currentStep.is_critical &&
    Number(request.current_step_order ?? 1) < Number(request.total_steps ?? 1)
  ) {
    return false;
  }
  if (request.payload?.is_critical || request.payload?.require_step_up)
    return true;
  if (String(request.payload?.risk_level || "").toUpperCase() === "CRITICAL")
    return true;
  if (request.request_type === "STAFF_TERMINATION") return true;
  if (
    request.request_type === "LARGE_EXPENSE" &&
    Number(request.amount || 0) >= 50000
  ) {
    return true;
  }
  return false;
}

/**
 * Executes the deferred business payload once an approval request reaches final APPROVED.
 */
async function executeApprovedPayload(
  madrasaId: string,
  request: ApprovalRequestRecord,
): Promise<Record<string, any>> {
  if (isFinancialRequest(request) && !hasFinanceAction(request.payload))
    return {
      executed: false,
      note: "Approval only; no financial posting requested",
    };
  const invalid = financeApprovalError(madrasaId, request);
  if (invalid) return { executed: false, error: invalid };
  const payload = request.payload || {};
  const actionKind = String(payload.action || "").toLowerCase();

  try {
    if (
      actionKind === "collect_fee_payment" &&
      payload.paymentData &&
      typeof payload.paymentData === "object"
    ) {
      if (!["FEE_DISCOUNT", "FEE_WAIVER"].includes(request.request_type))
        return { executed: false, error: "আবেদনের ধরন মেলেনি।" };
      const res = await cashierPayment(
        {
          ...payload.paymentData,
          idempotency_key:
            payload.paymentData.idempotency_key || `approval:${request.id}`,
        },
        madrasaId,
        payload.approvedPlan,
      );
      return { executed: !res?.error, result: res };
    }

    if (
      actionKind === "create_expense" &&
      payload.expenseData &&
      typeof payload.expenseData === "object"
    ) {
      const fd = new FormData();
      for (const [k, v] of Object.entries(payload.expenseData)) {
        if (v !== undefined && v !== null) fd.set(k, String(v));
      }
      if (request.request_type !== "LARGE_EXPENSE")
        return { executed: false, error: "আবেদনের ধরন মেলেনি।" };
      const res = await postExpense(fd, {
        tenant: madrasaId,
        requestId: request.id,
      });
      return { executed: !res?.error, result: res };
    }

    if (
      actionKind === "update_staff_salary" &&
      payload.staffId &&
      payload.staffPayload
    ) {
      const res = await editStaff(request.target_id, payload.staffPayload, {
        tenant: madrasaId,
        requestId: request.id,
      });
      return { executed: !res?.error, result: res };
    }

    if (actionKind === "promote_staff" && payload.promotePayload) {
      const res = await promoteStaff(payload.promotePayload, {
        tenant: madrasaId,
        requestId: request.id,
      });
      return { executed: !res?.error, result: res };
    }

    if (actionKind === "publish_exam_result" && payload.examId) {
      const res = await publishExam(
        String(payload.examId),
        Boolean(payload.isPublished ?? true),
        payload.note,
        true,
      );
      return { executed: !res?.error, result: res };
    }

    if (actionKind === "issue_certificate" && payload.certificatePayload) {
      const res = await issueStudentCertificate({
        ...payload.certificatePayload,
        _approvalBypass: true,
      });
      return { executed: !res?.error, result: res };
    }

    return { executed: true, note: "No deferred action handler required" };
  } catch (err: any) {
    console.error(
      `executeApprovedPayload error (${madrasaId}/${request.id}):`,
      err,
    );
    return { executed: false, error: err?.message || "Execution failed" };
  }
}

export async function decideApprovalStepForActor(params: {
  madrasaId: string;
  userId: string;
  actorName: string;
  actorRole: string;
  roles: string[];
  permissions: string[];
  requestId: string;
  decision: "APPROVED" | "REJECTED";
  notes?: string;
  stepUpToken?: string | null;
}) {
  const {
    madrasaId,
    userId,
    actorName,
    actorRole,
    roles,
    permissions,
    requestId,
    decision,
    notes = "",
    stepUpToken,
  } = params;

  const normalizedDecision = String(decision || "").toUpperCase() as
    "APPROVED" | "REJECTED";
  if (normalizedDecision !== "APPROVED" && normalizedDecision !== "REJECTED") {
    return {
      error: "অবৈধ সিদ্ধান্ত। APPROVED অথবা REJECTED হতে হবে।",
      statusCode: 400,
    };
  }

  const loaded = await getApprovalRequestByIdForMadrasa(madrasaId, requestId);
  if (loaded.crossTenantDenied) {
    return {
      error: "ভিন্ন মাদ্রাসার অনুমোদন আবেদনে অ্যাক্সেস অনুমোদিত নয়।",
      statusCode: 403,
    };
  }
  if (!loaded.request) {
    return { error: "অনুমোদনের আবেদনটি খুঁজে পাওয়া যায়নি।", statusCode: 404 };
  }

  const req = loaded.request;
  if (!canReadApproval(req, [actorRole, ...roles], permissions))
    return { error: "আর্থিক আবেদনের অনুমতি নেই।", statusCode: 403 };
  if (req.status !== "PENDING" && req.status !== "IN_REVIEW") {
    return {
      error: `এই আবেদনটি ইতিমধ্যে "${req.status}" অবস্থায় রয়েছে।`,
      statusCode: 400,
    };
  }

  const currentStepOrder = Number(req.current_step_order ?? 1);
  const currentStep =
    loaded.steps.find((s) => Number(s.step_order) === currentStepOrder) || null;

  const finance = hasFinanceAction(req.payload);
  if (finance && req.requested_by === userId)
    return { error: "আর্থিক আবেদনে ভিন্ন অনুমোদনকারী প্রয়োজন।", statusCode: 403 };
  // Seeing a request is not permission to decide an unassigned step.
  if (
    isFinancialRequest(req) &&
    !currentStep?.approver_role &&
    !currentStep?.approver_user_id &&
    !currentStep?.required_permission &&
    !roles.some((r) => ["super_admin", "admin", "muhtamim"].includes(r)) &&
    !permissions.some((p) =>
      [
        "approval.approve",
        req.request_type === "SALARY_CHANGE"
          ? "staff.salary.manage"
          : req.request_type === "LARGE_EXPENSE"
            ? "finance.approve"
            : "fee.approve",
      ].includes(p),
    )
  )
    return { error: "আর্থিক সিদ্ধান্তের অনুমতি নেই।", statusCode: 403 };
  if (finance && normalizedDecision === "APPROVED") {
    const invalid = financeApprovalError(madrasaId, req);
    if (
      invalid ||
      !currentStep ||
      !loaded.workflow?.is_active ||
      JSON.stringify(req.payload?.financeWorkflow) !==
        JSON.stringify(financeWorkflowTerms(loaded.workflow))
    )
      return {
        error: invalid || "পুরোনো আবেদন বা ওয়ার্কফ্লোর শর্ত বদলেছে। নতুন আবেদন করুন।",
        statusCode: 409,
      };
  }
  const authCheck = canActorDecideStep(
    {
      userId,
      id: userId,
      role: actorRole,
      roles,
      permissions,
    },
    req,
    currentStep,
    loaded.workflow,
  );

  if (!authCheck.allowed) {
    return {
      error: authCheck.reason || "এই ধাপে সিদ্ধান্ত নেওয়ার অনুমতি আপনার নেই।",
      statusCode: 403,
    };
  }

  // Step-Up 2FA check for critical steps/requests
  if (isStepOrRequestCritical(req, currentStep)) {
    const stepUpRes = await requirePermission({
      userId,
      madrasaId,
      riskLevel: "CRITICAL",
      requireStepUp: true,
      stepUpToken: stepUpToken ?? null,
      actionScope: `approval.decide.${req.request_type.toLowerCase()}`,
    });

    if (!stepUpRes.allowed) {
      return {
        error:
          stepUpRes.error ||
          "এই সংবেদনশীল অনুমোদনের জন্য Step-Up 2FA যাচাইকরণ প্রয়োজন।",
        stepUpRequired: true,
        errorCode: "STEP_UP_REQUIRED",
        actionScope: stepUpRes.actionScope,
        statusCode: 403,
      };
    }
  }

  const now = new Date();
  const slaBreached = isSlaBreached(req.sla_due_at, now);
  const progression = evaluateStepProgression(
    req,
    loaded.steps,
    loaded.decisions,
    {
      decision: normalizedDecision,
      actorId: userId,
      notes,
    },
  );

  const decisionRecord = {
    id: generateUuid(),
    madrasa_id: madrasaId,
    request_id: requestId,
    step_id: currentStep?.id || null,
    step_order: currentStepOrder,
    step_name: currentStep?.step_name || `ধাপ ${currentStepOrder}`,
    decided_by: userId,
    decided_by_name: actorName,
    decided_by_role: actorRole,
    decision: normalizedDecision,
    notes: notes.trim() || null,
    sla_breached: slaBreached,
    decided_at: now.toISOString(),
  };

  const nextSlaDueAt = progression.isFinal
    ? req.sla_due_at || null
    : calculateSlaDueAt(now, Number(progression.nextStep?.sla_hours ?? 24));

  const requestPatch: Partial<ApprovalRequestRecord> = {
    current_step_order: progression.nextStepOrder,
    status: progression.nextStatus,
    sla_due_at: nextSlaDueAt,
    ...(progression.isFinal
      ? {
          final_decision_by: userId,
          final_decision_by_name: actorName,
          final_decision_at: now.toISOString(),
          final_notes: notes.trim() || null,
        }
      : {}),
  };

  if (finance) {
    const db = await createAdminClient();
    const { error } = await db.rpc("finance_decide_request", {
      t: madrasaId,
      rid: requestId,
      expected: {
        status: req.status,
        amount: req.amount,
        request_type: req.request_type,
        target_id: req.target_id,
        requested_by: req.requested_by,
        workflow_id: req.workflow_id,
        payload: req.payload,
      },
      d: decisionRecord,
      patch: requestPatch,
    });
    if (error) return { error: error.message, statusCode: 409 };
  } else {
    await recordStepDecisionAndUpdateRequest({
      madrasaId,
      requestId,
      decisionRecord,
      requestPatch,
    });
  }

  let executionResult: Record<string, any> | null = null;
  if (progression.isFinal && progression.nextStatus === "APPROVED") {
    executionResult = await executeApprovedPayload(madrasaId, req);
    const outcome = {
      executed_at: executionResult.executed ? new Date().toISOString() : null,
      execution_result: executionResult,
    };
    if (finance) {
      const { data, error } = await (
        await createAdminClient()
      )
        .from("approval_requests")
        .update(outcome)
        .eq("madrasa_id", madrasaId)
        .eq("id", requestId)
        .eq("status", "APPROVED")
        .eq("final_decision_by", userId)
        .select("id")
        .single();
      if (error || !data)
        return {
          error:
            "সিদ্ধান্ত সংরক্ষিত; পোস্টের ফলাফল নিশ্চিত হয়নি। আবার পোস্ট না করে মূল খাতা মিলিয়ে নিন।",
          statusCode: 409,
        };
    } else await updateApprovalRequestStatus(madrasaId, requestId, outcome);

    const payload = req.payload || {};
    const alreadyTriggeredToggle =
      String(payload.action || "").toLowerCase() === "publish_exam_result" &&
      Boolean(payload.examId);
    if (req.request_type === "RESULT_PUBLISH" && !alreadyTriggeredToggle) {
      try {
        const { dispatchWebhookEvent } =
          await import("@/lib/webhooks/dispatcher");
        await dispatchWebhookEvent(madrasaId, "exam.result_published", {
          exam_id: req.target_id,
          title: req.target_name || req.title,
          approval_request_id: requestId,
          approved_by: actorName,
          approved_at: now.toISOString(),
        });
      } catch {
        // non-blocking webhook dispatch
      }
    }
  }

  await logAuditEvent({
    madrasaId,
    actorId: userId,
    actorName,
    actorRole,
    module: "approvals",
    action: "APPROVAL_STEP_DECIDED",
    entityType: "approval_request",
    entityId: requestId,
    entityLabel: req.title,
    summary: `ধাপ ${currentStepOrder} সিদ্ধান্ত: ${normalizedDecision} (${req.title})`,
    newValue: {
      step_order: currentStepOrder,
      decision: normalizedDecision,
      next_status: progression.nextStatus,
      next_step_order: progression.nextStepOrder,
      sla_breached: slaBreached,
    },
    severity: normalizedDecision === "REJECTED" ? "WARNING" : "INFO",
  });

  try {
    const recipientUserId = progression.isFinal
      ? req.requester_id || req.requested_by || null
      : progression.nextStep?.approver_user_id || null;
    const notifEvent = progression.isFinal
      ? "approval.decided"
      : "approval.step_advanced";
    const notifSubject = progression.isFinal
      ? progression.nextStatus === "APPROVED"
        ? `অনুমোদন সম্পন্ন: ${req.title}`
        : `অনুমোদন প্রত্যাখ্যাত: ${req.title}`
      : `পরবর্তী অনুমোদনের ধাপ (ধাপ ${progression.nextStepOrder}): ${req.title}`;
    const notifBody = progression.isFinal
      ? `${actorName} আপনার "${req.title}" (${req.request_type}) আবেদনটি ${
          progression.nextStatus === "APPROVED"
            ? "চূড়ান্তভাবে অনুমোদন"
            : "প্রত্যাখ্যান"
        } করেছেন।`
      : `${actorName} "${req.title}" (${req.request_type}) আবেদনের ধাপ ${currentStepOrder} অনুমোদন করেছেন। পরবর্তী ধাপ (${progression.nextStepOrder}) পর্যালোচনার জন্য অনুরোধ করা হলো।`;

    await dispatchNotification(notifEvent, {
      madrasaId,
      recipientUserId,
      channels: ["in_app", "push", "sms", "email"],
      subject: notifSubject,
      body: notifBody,
      variables: {
        RequestType: req.request_type,
        Title: req.title,
        StepOrder: progression.nextStepOrder,
        Status: progression.nextStatus,
        ActorName: actorName,
      },
      actorId: userId,
      metadata: {
        requestId,
        requestType: req.request_type,
        decision: normalizedDecision,
        nextStatus: progression.nextStatus,
        nextStepOrder: progression.nextStepOrder,
        isFinal: progression.isFinal,
      },
    });
  } catch {
    // non-blocking notification dispatch
  }

  revalidatePath("/dashboard/approvals");
  revalidatePath("/dashboard/users");

  return {
    success: true,
    status: progression.nextStatus,
    nextStepOrder: progression.nextStepOrder,
    isFinal: progression.isFinal,
    decision: decisionRecord,
    executionResult,
    message: progression.isFinal
      ? progression.nextStatus === "APPROVED"
        ? executionResult?.executed === false
          ? "আবেদন অনুমোদিত হলেও কাজটি সম্পন্ন হয়নি। মূল রেকর্ড ও কার্যফল যাচাই করুন।"
          : "আবেদনটি চূড়ান্তভাবে অনুমোদিত হয়েছে।"
        : "আবেদনটি প্রত্যাখ্যান করা হয়েছে।"
      : `ধাপ ${currentStepOrder} অনুমোদিত হয়েছে; পরবর্তী ধাপ (${progression.nextStepOrder}) এ পাঠানো হয়েছে।`,
  };
}
