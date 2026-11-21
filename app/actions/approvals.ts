"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "./students";
import { writeGuard } from "@/lib/action-authorization";
import { logAuditEvent } from "@/lib/audit-log";
import { loadServerPermissions, requirePermission } from "@/lib/permissions-server";
import { dispatchNotification } from "@/lib/notifications/orchestrator";
import {
  calculateSlaDueAt,
  canActorDecideStep,
  deleteWorkflowForMadrasa,
  evaluateStepProgression,
  getApprovalRequestByIdForMadrasa,
  insertApprovalRequestRecord,
  isSlaBreached,
  listApprovalRequestsForMadrasa,
  listWorkflowsForMadrasa,
  matchApprovalWorkflow,
  recordStepDecisionAndUpdateRequest,
  updateApprovalRequestStatus,
  upsertWorkflowForMadrasa,
  type ApprovalRequestRecord,
  type ApprovalWorkflowStep,
  type ApprovalWorkflowWithSteps,
} from "@/lib/approval-workflow";
import { collectFeePayment } from "./fee-management";
import { createExpense } from "./accounting";
import { promoteStaffMember, updateStaffMember } from "./staff";
import { publishExam } from "@/lib/portal/publish";
import { issueStudentCertificate } from "./certificates";

function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `appr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function resolveActionActor() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "অননুমোদিত অ্যাক্সেস। অনুগ্রহ করে লগইন করুন।" as const };

  const madrasaId = await getAuthMadrasaId(supabase, user);
  if (!madrasaId) return { error: "মাদরাসা আইডি পাওয়া যায়নি।" as const };

  const permCtx = await loadServerPermissions(user.id, madrasaId);
  return {
    user,
    madrasaId,
    actorName:
      permCtx?.profile?.fullName ||
      user.user_metadata?.full_name ||
      user.email ||
      "ব্যবহারকারী",
    actorRole: permCtx?.role || user.user_metadata?.role || "staff",
    roles: permCtx?.roles || [user.user_metadata?.role || "staff"],
    permissions: permCtx?.summary?.effectivePermissions || [],
    status: permCtx?.status || "ACTIVE",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. WORKFLOW CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function getApprovalWorkflows(): Promise<{
  workflows: ApprovalWorkflowWithSteps[];
  error?: string;
}> {
  try {
    const actor = await resolveActionActor();
    if ("error" in actor) return { workflows: [], error: actor.error };

    const workflows = await listWorkflowsForMadrasa(actor.madrasaId);
    return { workflows };
  } catch (err: any) {
    console.error("getApprovalWorkflows error:", err);
    return { workflows: [], error: err?.message || "ওয়ার্কফ্লো লোড করতে সমস্যা হয়েছে।" };
  }
}

export async function saveApprovalWorkflow(input: {
  id?: string;
  name: string;
  name_bn?: string | null;
  request_type?: string;
  requestType?: string;
  description?: string | null;
  min_amount?: number;
  minAmount?: number;
  max_amount?: number | null;
  maxAmount?: number | null;
  is_active?: boolean;
  isActive?: boolean;
  priority?: number;
  require_two_person?: boolean;
  requireTwoPerson?: boolean;
  steps: Array<{
    step_order?: number;
    stepOrder?: number;
    step_name?: string;
    stepName?: string;
    approver_role?: string | null;
    approverRole?: string | null;
    required_permission?: string | null;
    requiredPermission?: string | null;
    approver_user_id?: string | null;
    approverUserId?: string | null;
    sla_hours?: number;
    slaHours?: number;
    allow_delegation?: boolean;
    require_step_up?: boolean;
    requireStepUp?: boolean;
  }>;
}) {
  try {
    const guard = await writeGuard("approvals");
    if (!guard.allowed) return { error: guard.error || "অনুমতি নেই।" };

    const actor = await resolveActionActor();
    if ("error" in actor) return { error: actor.error };

    const manageGuard = await requirePermission({
      userId: actor.user.id,
      madrasaId: actor.madrasaId,
      permissions: ["approval.manage", "role.assign"],
      roles: ["super_admin", "admin", "muhtamim"],
      errorMessage: "অনুমোদন ওয়ার্কফ্লো কনফিগার করার অনুমতি আপনার নেই।",
    });
    if (!manageGuard.allowed) return { error: manageGuard.error };

    const name = String(input.name || "").trim();
    const requestType = String(input.request_type || input.requestType || "").trim();
    if (!name || !requestType) {
      return { error: "ওয়ার্কফ্লোর নাম এবং ধরন (Request Type) আবশ্যক।" };
    }

    const stepsInput = Array.isArray(input.steps) ? input.steps : [];
    if (stepsInput.length === 0) {
      return { error: "কমপক্ষে একটি অনুমোদন ধাপ যুক্ত করতে হবে।" };
    }

    const workflow = await upsertWorkflowForMadrasa(actor.madrasaId, actor.user.id, {
      id: input.id,
      name,
      name_bn: input.name_bn ?? name,
      request_type: requestType,
      description: input.description ?? null,
      min_amount: Number(input.min_amount ?? input.minAmount ?? 0),
      max_amount:
        input.max_amount !== undefined
          ? input.max_amount
          : input.maxAmount !== undefined
          ? input.maxAmount
          : null,
      is_active: input.is_active ?? input.isActive ?? true,
      priority: Number(input.priority ?? 0),
      require_two_person: input.require_two_person ?? input.requireTwoPerson ?? true,
      steps: stepsInput.map((s, idx) => ({
        step_order: Number(s.step_order ?? s.stepOrder ?? idx + 1),
        step_name: String(s.step_name ?? s.stepName ?? `ধাপ ${idx + 1}`),
        approver_role: s.approver_role ?? s.approverRole ?? null,
        required_permission: s.required_permission ?? s.requiredPermission ?? null,
        approver_user_id: s.approver_user_id ?? s.approverUserId ?? null,
        sla_hours: Number(s.sla_hours ?? s.slaHours ?? 24),
        allow_delegation: Boolean(s.allow_delegation),
        require_step_up: Boolean(s.require_step_up ?? s.requireStepUp),
      })),
    });

    revalidatePath("/dashboard/approvals");
    revalidatePath("/dashboard/users");
    return {
      success: true,
      workflow,
      message: "অনুমোদন ওয়ার্কফ্লো সফলভাবে সংরক্ষিত হয়েছে!",
    };
  } catch (err: any) {
    console.error("saveApprovalWorkflow error:", err);
    return { error: err?.message || "ওয়ার্কফ্লো সংরক্ষণে ত্রুটি হয়েছে।" };
  }
}

export async function deleteApprovalWorkflow(id: string) {
  try {
    const guard = await writeGuard("approvals");
    if (!guard.allowed) return { error: guard.error || "অনুমতি নেই।" };

    const actor = await resolveActionActor();
    if ("error" in actor) return { error: actor.error };

    const manageGuard = await requirePermission({
      userId: actor.user.id,
      madrasaId: actor.madrasaId,
      permissions: ["approval.manage", "role.assign"],
      roles: ["super_admin", "admin", "muhtamim"],
    });
    if (!manageGuard.allowed) return { error: manageGuard.error };

    await deleteWorkflowForMadrasa(actor.madrasaId, id);
    revalidatePath("/dashboard/approvals");
    return { success: true, message: "ওয়ার্কফ্লো মুছে ফেলা হয়েছে।" };
  } catch (err: any) {
    console.error("deleteApprovalWorkflow error:", err);
    return { error: err?.message || "ওয়ার্কফ্লো মুছে ফেলতে সমস্যা হয়েছে।" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. REQUEST SUBMISSION, DECISION & CANCELLATION
// ─────────────────────────────────────────────────────────────────────────────

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

export async function submitApprovalRequestForActor(
  actor: {
    userId: string;
    madrasaId: string;
    actorName: string;
    actorRole: string;
  },
  input: SubmitApprovalRequestInput
): Promise<{
  success?: boolean;
  error?: string;
  message?: string;
  request?: ApprovalRequestRecord;
  id?: string;
}> {
  const requestType = String(
    input.requestType || input.request_type || input.type || ""
  ).trim();
  if (!requestType) {
    return { error: "অনুমোদনের ধরন (requestType) আবশ্যক।" };
  }

  const title = String(input.title || "").trim();
  if (!title) {
    return { error: "অনুমোদনের শিরোনাম আবশ্যক।" };
  }

  const amount = Number(input.amount ?? 0);
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
    entity_type: input.entityType || input.entity_type || requestType.toLowerCase(),
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
    request: saved,
    message: "অনুমোদনের আবেদন সফলভাবে দাখিল করা হয়েছে!",
  };
}

export async function submitApprovalRequest(input: SubmitApprovalRequestInput) {
  try {
    const actor = await resolveActionActor();
    if ("error" in actor) return { error: actor.error };
    if (actor.status === "SUSPENDED" || actor.status === "DISABLED") {
      return { error: "আপনার অ্যাকাউন্ট স্থগিত করা হয়েছে।" };
    }

    return await submitApprovalRequestForActor(
      {
        userId: actor.user.id,
        madrasaId: actor.madrasaId,
        actorName: actor.actorName,
        actorRole: actor.actorRole,
      },
      input
    );
  } catch (err: any) {
    console.error("submitApprovalRequest error:", err);
    return { error: err?.message || "অনুমোদনের আবেদন দাখিলে ত্রুটি হয়েছে।" };
  }
}

function isStepOrRequestCritical(
  request: ApprovalRequestRecord,
  currentStep?: ApprovalWorkflowStep | null
): boolean {
  if (currentStep?.require_step_up || currentStep?.is_critical) return true;
  if (
    currentStep &&
    currentStep.require_step_up === false &&
    !currentStep.is_critical &&
    Number(request.current_step_order ?? 1) < Number(request.total_steps ?? 1)
  ) {
    return false;
  }
  if (request.payload?.is_critical || request.payload?.require_step_up) return true;
  if (String(request.payload?.risk_level || "").toUpperCase() === "CRITICAL") return true;
  if (request.request_type === "STAFF_TERMINATION") return true;
  if (request.request_type === "LARGE_EXPENSE" && Number(request.amount || 0) >= 50000) {
    return true;
  }
  return false;
}

/**
 * Executes the deferred business payload once an approval request reaches final APPROVED.
 */
async function executeApprovedPayload(
  madrasaId: string,
  request: ApprovalRequestRecord
): Promise<Record<string, any>> {
  const payload = request.payload || {};
  const actionKind = String(payload.action || "").toLowerCase();

  try {
    if (
      actionKind === "collect_fee_payment" &&
      payload.paymentData &&
      typeof payload.paymentData === "object"
    ) {
      const res = await collectFeePayment({
        ...payload.paymentData,
        _approvalBypass: true,
      });
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
      fd.set("_approvalBypass", "true");
      const res = await createExpense({}, fd);
      return { executed: !res?.error, result: res };
    }

    if (actionKind === "update_staff_salary" && payload.staffId && payload.staffPayload) {
      const res = await updateStaffMember(String(payload.staffId), {
        ...payload.staffPayload,
        _approvalBypass: true,
      });
      return { executed: !res?.error, result: res };
    }

    if (actionKind === "promote_staff" && payload.promotePayload) {
      const res = await promoteStaffMember({
        ...payload.promotePayload,
        _approvalBypass: true,
      });
      return { executed: !res?.error, result: res };
    }

    if (actionKind === "publish_exam_result" && payload.examId) {
      const res = await publishExam(
        String(payload.examId),
        Boolean(payload.isPublished ?? true),
        payload.note,
        true
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
    console.error(`executeApprovedPayload error (${madrasaId}/${request.id}):`, err);
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

  const normalizedDecision = String(decision || "").toUpperCase() as "APPROVED" | "REJECTED";
  if (normalizedDecision !== "APPROVED" && normalizedDecision !== "REJECTED") {
    return { error: "অবৈধ সিদ্ধান্ত। APPROVED অথবা REJECTED হতে হবে।", statusCode: 400 };
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
  if (req.status !== "PENDING" && req.status !== "IN_REVIEW") {
    return {
      error: `এই আবেদনটি ইতিমধ্যে "${req.status}" অবস্থায় রয়েছে।`,
      statusCode: 400,
    };
  }

  const currentStepOrder = Number(req.current_step_order ?? 1);
  const currentStep =
    loaded.steps.find((s) => Number(s.step_order) === currentStepOrder) || null;

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
    loaded.workflow
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
        error: stepUpRes.error || "এই সংবেদনশীল অনুমোদনের জন্য Step-Up 2FA যাচাইকরণ প্রয়োজন।",
        stepUpRequired: true,
        errorCode: "STEP_UP_REQUIRED",
        actionScope: stepUpRes.actionScope,
        statusCode: 403,
      };
    }
  }

  const now = new Date();
  const slaBreached = isSlaBreached(req.sla_due_at, now);
  const progression = evaluateStepProgression(req, loaded.steps, loaded.decisions, {
    decision: normalizedDecision,
    actorId: userId,
    notes,
  });

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

  await recordStepDecisionAndUpdateRequest({
    madrasaId,
    requestId,
    decisionRecord,
    requestPatch,
  });

  let executionResult: Record<string, any> | null = null;
  if (progression.isFinal && progression.nextStatus === "APPROVED") {
    executionResult = await executeApprovedPayload(madrasaId, req);
    await updateApprovalRequestStatus(madrasaId, requestId, {
      executed_at: new Date().toISOString(),
      execution_result: executionResult,
    });

    const payload = req.payload || {};
    const alreadyTriggeredToggle =
      String(payload.action || "").toLowerCase() === "publish_exam_result" &&
      Boolean(payload.examId);
    if (req.request_type === "RESULT_PUBLISH" && !alreadyTriggeredToggle) {
      try {
        const { dispatchWebhookEvent } = await import("@/lib/webhooks/dispatcher");
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
    const notifEvent = progression.isFinal ? "approval.decided" : "approval.step_advanced";
    const notifSubject = progression.isFinal
      ? progression.nextStatus === "APPROVED"
        ? `অনুমোদন সম্পন্ন: ${req.title}`
        : `অনুমোদন প্রত্যাখ্যাত: ${req.title}`
      : `পরবর্তী অনুমোদনের ধাপ (ধাপ ${progression.nextStepOrder}): ${req.title}`;
    const notifBody = progression.isFinal
      ? `${actorName} আপনার "${req.title}" (${req.request_type}) আবেদনটি ${
          progression.nextStatus === "APPROVED" ? "চূড়ান্তভাবে অনুমোদন" : "প্রত্যাখ্যান"
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
        ? "আবেদনটি চূড়ান্তভাবে অনুমোদিত ও সম্পন্ন হয়েছে!"
        : "আবেদনটি প্রত্যাখ্যান করা হয়েছে।"
      : `ধাপ ${currentStepOrder} অনুমোদিত হয়েছে; পরবর্তী ধাপ (${progression.nextStepOrder}) এ পাঠানো হয়েছে।`,
  };
}

export async function decideApprovalStep(
  requestId: string,
  decision: "APPROVED" | "REJECTED",
  notes: string = "",
  stepUpToken?: string | null
) {
  try {
    const guard = await writeGuard("approvals");
    if (!guard.allowed) return { error: guard.error || "অনুমতি নেই।" };

    const actor = await resolveActionActor();
    if ("error" in actor) return { error: actor.error };

    return await decideApprovalStepForActor({
      madrasaId: actor.madrasaId,
      userId: actor.user.id,
      actorName: actor.actorName,
      actorRole: actor.actorRole,
      roles: actor.roles,
      permissions: actor.permissions,
      requestId,
      decision,
      notes,
      stepUpToken,
    });
  } catch (err: any) {
    console.error("decideApprovalStep error:", err);
    return { error: err?.message || "সিদ্ধান্ত প্রক্রিয়ায় ত্রুটি ঘটেছে।" };
  }
}

export async function cancelApprovalRequest(requestId: string) {
  try {
    const actor = await resolveActionActor();
    if ("error" in actor) return { error: actor.error };

    const loaded = await getApprovalRequestByIdForMadrasa(actor.madrasaId, requestId);
    if (loaded.crossTenantDenied) {
      return { error: "ভিন্ন মাদ্রাসার আবেদন বাতিল করা যাবে না।" };
    }
    if (!loaded.request) {
      return { error: "আবেদনটি খুঁজে পাওয়া যায়নি।" };
    }

    const req = loaded.request;
    if (req.status !== "PENDING" && req.status !== "IN_REVIEW") {
      return { error: "শুধুমাত্র অপেক্ষমান আবেদন বাতিল করা যায়।" };
    }

    const requesterId = String(req.requested_by || req.requester_id || "");
    const isAdmin =
      actor.roles.includes("super_admin") || actor.roles.includes("muhtamim");
    if (requesterId && requesterId !== actor.user.id && !isAdmin) {
      return { error: "শুধুমাত্র আবেদনকারী বা মুহতামিম আবেদনটি বাতিল করতে পারবেন।" };
    }

    await updateApprovalRequestStatus(actor.madrasaId, requestId, {
      status: "CANCELLED",
      final_decision_by: actor.user.id,
      final_decision_by_name: actor.actorName,
      final_decision_at: new Date().toISOString(),
      final_notes: "আবেদনকারী কর্তৃক বাতিল",
    });

    revalidatePath("/dashboard/approvals");
    revalidatePath("/dashboard/users");
    return { success: true, message: "অনুমোদনের আবেদনটি বাতিল করা হয়েছে।" };
  } catch (err: any) {
    console.error("cancelApprovalRequest error:", err);
    return { error: err?.message || "আবেদন বাতিলে ত্রুটি হয়েছে।" };
  }
}

export async function getApprovalRequests(filters?: {
  status?: string;
  requestType?: string;
  limit?: number;
}): Promise<ApprovalRequestRecord[]> {
  try {
    const actor = await resolveActionActor();
    if ("error" in actor) return [];
    return await listApprovalRequestsForMadrasa(actor.madrasaId, filters);
  } catch (err) {
    console.error("getApprovalRequests error:", err);
    return [];
  }
}
