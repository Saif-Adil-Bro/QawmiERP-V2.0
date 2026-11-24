"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "./students";
import { writeGuard } from "@/lib/action-authorization";
import {loadServerPermissions,requirePermission} from '@/lib/permissions-server';
import {deleteWorkflowForMadrasa,getApprovalRequestByIdForMadrasa,listApprovalRequestsForMadrasa,listWorkflowsForMadrasa,updateApprovalRequestStatus,upsertWorkflowForMadrasa,type ApprovalWorkflowWithSteps,type ApprovalRequestRecord} from '@/lib/approval-workflow';
import {decideApprovalStepForActor,submitApprovalRequestForActor,type SubmitApprovalRequestInput} from '@/lib/approval-execution';
import {logAuditEvent} from '@/lib/audit-log';
import {canReadApproval,isFinancialRequest,publicApproval} from '@/lib/finance/approval-terms';
export type {SubmitApprovalRequestInput} from '@/lib/approval-execution';

async function resolveActionActor() {
  const guard=await writeGuard("approvals");if(!guard.allowed)return {error:guard.error};
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
    return { workflows:workflows.filter(w=>canReadApproval(w,actor.roles,actor.permissions)) };
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

    await deleteWorkflowForMadrasa(actor.madrasaId,actor.user.id,id);
    revalidatePath("/dashboard/approvals");
    return { success: true, message: "ওয়ার্কফ্লো নিষ্ক্রিয় হয়েছে।" };
  } catch (err: any) {
    console.error("deleteApprovalWorkflow error:", err);
    return { error: err?.message || "ওয়ার্কফ্লো মুছে ফেলতে সমস্যা হয়েছে।" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. REQUEST SUBMISSION, DECISION & CANCELLATION
// ─────────────────────────────────────────────────────────────────────────────

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
    if (requesterId !== actor.user.id && (!isAdmin || !canReadApproval(req,actor.roles,actor.permissions))) {
      return { error: "শুধুমাত্র আবেদনকারী বা মুহতামিম আবেদনটি বাতিল করতে পারবেন।" };
    }

    const patch={
      status: "CANCELLED" as const,
      final_decision_by: actor.user.id,
      final_decision_by_name: actor.actorName,
      final_decision_at: new Date().toISOString(),
      final_notes: "আবেদনকারী কর্তৃক বাতিল",
    };

    if(isFinancialRequest(req)) {
      const {data,error}=await (await createAdminClient()).from('approval_requests').update(patch).eq('madrasa_id',actor.madrasaId).eq('id',requestId).eq('status',req.status).eq('current_step_order',req.current_step_order).select('id').single();
      if(error || !data) return {error:'অনুমোদনের অবস্থা বদলেছে। রিফ্রেশ করুন।'};
      await logAuditEvent({madrasaId:actor.madrasaId,actorId:actor.user.id,actorName:actor.actorName,actorRole:actor.actorRole,module:'approvals',action:'APPROVAL_CANCELLED',entityType:'approval_request',entityId:requestId,summary:'আর্থিক আবেদন বাতিল',newValue:{status:'CANCELLED'}});
    } else await updateApprovalRequestStatus(actor.madrasaId,requestId,patch);

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
    const requests=await listApprovalRequestsForMadrasa(actor.madrasaId,filters);
    return requests.filter(r=>canReadApproval(r,actor.roles,actor.permissions)).map(publicApproval);
  } catch (err) {
    console.error("getApprovalRequests error:", err);
    return [];
  }
}
