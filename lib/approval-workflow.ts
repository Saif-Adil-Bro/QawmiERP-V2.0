import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableError } from "@/lib/audit-log";
import { mergeJsonStore, readJsonStore } from "@/lib/madrasa-store";
import type { ApprovalRequestType, ApprovalStatus } from "@/lib/permissions";

export type ApprovalWorkflowRequestType = ApprovalRequestType | string;

export interface ApprovalWorkflowStep {
  id: string;
  madrasa_id: string;
  workflow_id: string;
  step_order: number;
  step_name: string;
  approver_role?: string | null;
  required_permission?: string | null;
  approver_user_id?: string | null;
  sla_hours: number;
  allow_delegation?: boolean;
  require_step_up?: boolean;
  is_critical?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ApprovalWorkflow {
  id: string;
  madrasa_id: string;
  name: string;
  name_bn?: string | null;
  request_type: ApprovalWorkflowRequestType;
  description?: string | null;
  min_amount: number;
  min_amount_threshold?: number;
  threshold_amount?: number;
  max_amount?: number | null;
  is_active: boolean;
  priority: number;
  require_two_person: boolean;
  require_step_up?: boolean;
  is_critical?: boolean;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ApprovalWorkflowWithSteps extends ApprovalWorkflow {
  steps: ApprovalWorkflowStep[];
}

export interface ApprovalStepDecisionRecord {
  id: string;
  madrasa_id: string;
  request_id: string;
  step_id?: string | null;
  step_order: number;
  step_name?: string | null;
  decided_by?: string | null;
  decided_by_name?: string | null;
  decided_by_role?: string | null;
  decision: "APPROVED" | "REJECTED" | string;
  notes?: string | null;
  sla_breached: boolean;
  decided_at: string;
  created_at?: string;
}

export interface ApprovalRequestRecord {
  id: string;
  madrasa_id: string;
  workflow_id?: string | null;
  request_type: ApprovalWorkflowRequestType;
  title: string;
  description?: string | null;
  entity_type?: string | null;
  target_id: string;
  target_name?: string | null;
  amount: number;
  threshold_amount: number;
  payload: Record<string, any>;
  requested_by?: string | null;
  requester_id?: string | null;
  requested_by_name?: string | null;
  requested_by_role?: string | null;
  current_step_order: number;
  total_steps: number;
  status: ApprovalStatus | "IN_REVIEW" | string;
  sla_due_at?: string | null;
  final_decision_by?: string | null;
  final_decision_by_name?: string | null;
  final_decision_at?: string | null;
  final_notes?: string | null;
  executed_at?: string | null;
  execution_result?: Record<string, any> | null;
  created_at: string;
  updated_at?: string;
  steps?: ApprovalWorkflowStep[];
  decisions?: ApprovalStepDecisionRecord[];
  sla_breached?: boolean;
}

export interface StepEvaluationResult {
  nextStepOrder: number;
  next_step_order: number;
  nextStatus: "PENDING" | "APPROVED" | "REJECTED";
  status: "PENDING" | "APPROVED" | "REJECTED";
  isFinal: boolean;
  completed: boolean;
  nextStep?: ApprovalWorkflowStep | null;
}

export interface ActorContext {
  userId?: string;
  id?: string;
  role?: string;
  roles?: string[];
  permissions?: string[];
}

export interface StepAuthorizationResult {
  allowed: boolean;
  reason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PURE ENGINE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function getWorkflowMinAmount(wf: Record<string, any>): number {
  const raw = wf.min_amount ?? wf.min_amount_threshold ?? wf.threshold_amount ?? 0;
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
}

export function normalizeWorkflow(raw: Record<string, any>): ApprovalWorkflowWithSteps {
  const minAmount = getWorkflowMinAmount(raw);
  const rawSteps = Array.isArray(raw.steps) ? raw.steps : [];
  const steps: ApprovalWorkflowStep[] = rawSteps
    .map((s: Record<string, any>, idx: number) => ({
      id: String(s.id || `step_${idx + 1}`),
      madrasa_id: String(s.madrasa_id || raw.madrasa_id || ""),
      workflow_id: String(s.workflow_id || raw.id || ""),
      step_order: Number(s.step_order ?? idx + 1),
      step_name: String(s.step_name || `ধাপ ${idx + 1}`),
      approver_role: s.approver_role ? String(s.approver_role) : null,
      required_permission: s.required_permission ? String(s.required_permission) : null,
      approver_user_id: s.approver_user_id ? String(s.approver_user_id) : null,
      sla_hours: Number(s.sla_hours ?? 24),
      allow_delegation: Boolean(s.allow_delegation),
      require_step_up: Boolean(s.require_step_up),
      is_critical: Boolean(s.is_critical),
      created_at: s.created_at,
      updated_at: s.updated_at,
    }))
    .sort((a, b) => a.step_order - b.step_order);

  return {
    id: String(raw.id || ""),
    madrasa_id: String(raw.madrasa_id || ""),
    name: String(raw.name || ""),
    name_bn: raw.name_bn ? String(raw.name_bn) : null,
    request_type: String(raw.request_type || ""),
    description: raw.description ? String(raw.description) : null,
    min_amount: minAmount,
    min_amount_threshold: minAmount,
    threshold_amount: minAmount,
    max_amount:
      raw.max_amount !== null && raw.max_amount !== undefined && raw.max_amount !== ""
        ? Number(raw.max_amount)
        : null,
    is_active: raw.is_active !== false,
    priority: Number(raw.priority ?? 0),
    require_two_person: raw.require_two_person !== false,
    require_step_up: Boolean(raw.require_step_up),
    is_critical: Boolean(raw.is_critical),
    created_by: raw.created_by ? String(raw.created_by) : null,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    steps,
  };
}

/**
 * Selects the highest-matching active workflow tier for the given request type & amount.
 * Returns null if no active workflow matches or amount is below all thresholds.
 */
export function matchApprovalWorkflow(
  workflows: Array<Record<string, any>>,
  requestType: string,
  amount: number
): ApprovalWorkflowWithSteps | null {
  if (!Array.isArray(workflows) || workflows.length === 0) return null;
  const targetType = String(requestType || "").trim().toUpperCase();
  const numericAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;

  const matching = workflows
    .filter((wf) => {
      if (!wf || wf.is_active === false) return false;
      const wfType = String(wf.request_type || "").trim().toUpperCase();
      if (wfType !== targetType) return false;

      const minAmount = getWorkflowMinAmount(wf);
      if (numericAmount < minAmount) return false;

      if (wf.max_amount !== null && wf.max_amount !== undefined && wf.max_amount !== "") {
        const maxAmount = Number(wf.max_amount);
        if (Number.isFinite(maxAmount) && numericAmount > maxAmount) return false;
      }

      return true;
    })
    .sort((a, b) => {
      const minDiff = getWorkflowMinAmount(b) - getWorkflowMinAmount(a);
      if (minDiff !== 0) return minDiff;
      return Number(b.priority ?? 0) - Number(a.priority ?? 0);
    });

  if (matching.length === 0) return null;
  return normalizeWorkflow(matching[0]);
}

/**
 * Evaluates step progression after an APPROVED or REJECTED decision on the current step.
 */
export function evaluateStepProgression(
  request: Record<string, any>,
  steps: Array<Record<string, any>>,
  _decisions: Array<Record<string, any>>,
  decisionInput: Record<string, any>
): StepEvaluationResult {
  const decision = String(decisionInput?.decision || "").trim().toUpperCase();
  const currentStepOrder = Number(request?.current_step_order ?? 1);

  if (decision === "REJECTED") {
    return {
      nextStepOrder: currentStepOrder,
      next_step_order: currentStepOrder,
      nextStatus: "REJECTED",
      status: "REJECTED",
      isFinal: true,
      completed: true,
      nextStep: null,
    };
  }

  const sortedSteps = [...(Array.isArray(steps) ? steps : [])]
    .map((s, idx) => ({
      ...s,
      step_order: Number(s.step_order ?? idx + 1),
    }))
    .sort((a, b) => a.step_order - b.step_order);

  const nextStepRaw = sortedSteps.find((s) => s.step_order > currentStepOrder) || null;
  if (nextStepRaw) {
    const nextOrder = Number(nextStepRaw.step_order);
    return {
      nextStepOrder: nextOrder,
      next_step_order: nextOrder,
      nextStatus: "PENDING",
      status: "PENDING",
      isFinal: false,
      completed: false,
      nextStep: nextStepRaw as ApprovalWorkflowStep,
    };
  }

  const totalSteps = Number(request?.total_steps ?? sortedSteps.length ?? 1);
  if (sortedSteps.length === 0 && totalSteps > currentStepOrder) {
    const nextOrder = currentStepOrder + 1;
    return {
      nextStepOrder: nextOrder,
      next_step_order: nextOrder,
      nextStatus: "PENDING",
      status: "PENDING",
      isFinal: false,
      completed: false,
      nextStep: null,
    };
  }

  return {
    nextStepOrder: currentStepOrder,
    next_step_order: currentStepOrder,
    nextStatus: "APPROVED",
    status: "APPROVED",
    isFinal: true,
    completed: true,
    nextStep: null,
  };
}

/**
 * Calculates the SLA deadline ISO timestamp by adding `slaHours` to `fromDate`.
 */
export function calculateSlaDueAt(fromDate: Date, slaHours: number): string {
  const hours = Number.isFinite(Number(slaHours)) ? Math.max(0, Number(slaHours)) : 24;
  return new Date(fromDate.getTime() + hours * 3600 * 1000).toISOString();
}

/**
 * Returns true if `slaDueAt` is a valid timestamp strictly in the past relative to `now`.
 */
export function isSlaBreached(
  slaDueAt: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!slaDueAt) return false;
  const dueMs = Date.parse(slaDueAt);
  if (Number.isNaN(dueMs)) return false;
  return now.getTime() > dueMs;
}

/**
 * Enforces two-person non-self-approval and step role/permission/user authorization.
 */
export function canActorDecideStep(
  actor: ActorContext & Record<string, any>,
  request: Record<string, any>,
  currentStep?: Record<string, any> | null,
  workflow?: Record<string, any> | null
): StepAuthorizationResult {
  const actorId = String(actor?.userId || actor?.id || "").trim();
  const rawRequester =
    typeof request?.requested_by === "object" && request?.requested_by !== null
      ? request.requested_by.user_id
      : request?.requested_by;
  const requesterId = String(rawRequester || request?.requester_id || "").trim();

  const requireTwoPerson =
    workflow?.require_two_person !== false && request?.require_two_person !== false;

  if (requireTwoPerson && actorId && requesterId && actorId === requesterId) {
    return {
      allowed: false,
      reason:
        "নিরাপত্তা নীতি: যিনি আবেদন করেছেন তিনি নিজেই নিজের আবেদন অনুমোদন করতে পারবেন না।",
    };
  }

  const actorRoles = new Set(
    [
      ...(Array.isArray(actor?.roles) ? actor.roles : []),
      ...(actor?.role ? [actor.role] : []),
    ]
      .map((r) => String(r).trim().toLowerCase())
      .filter(Boolean)
  );

  const actorPerms = new Set(
    (Array.isArray(actor?.permissions) ? actor.permissions : [])
      .map((p) => String(p).trim())
      .filter(Boolean)
  );

  if (actorRoles.has("super_admin")) {
    return { allowed: true };
  }

  if (!currentStep) {
    if (
      actorRoles.has("muhtamim") ||
      actorRoles.has("admin") ||
      actorPerms.has("approval.approve")
    ) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: "এই ধাপটি অনুমোদন করার প্রয়োজনীয় রোল বা পারমিশন আপনার নেই।",
    };
  }

  if (currentStep.approver_user_id) {
    if (String(currentStep.approver_user_id) === actorId) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: "এই ধাপের জন্য নির্দিষ্ট অনুমোদনকারী নির্ধারিত রয়েছেন।",
    };
  }

  const reqRole = currentStep.approver_role
    ? String(currentStep.approver_role).trim().toLowerCase()
    : null;
  const reqPerm = currentStep.required_permission
    ? String(currentStep.required_permission).trim()
    : null;

  if (!reqRole && !reqPerm) {
    return { allowed: true };
  }

  if (reqRole && actorRoles.has(reqRole)) {
    return { allowed: true };
  }

  if (reqPerm && actorPerms.has(reqPerm)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `এই ধাপটি অনুমোদনের জন্য "${reqRole || reqPerm}" অনুমতি প্রয়োজন।`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RELATIONAL PERSISTENCE + GRACEFUL FALLBACK TO MADRASA STORE
// ─────────────────────────────────────────────────────────────────────────────

function genId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

interface FallbackApprovalStore {
  workflows: ApprovalWorkflowWithSteps[];
  requests: ApprovalRequestRecord[];
  decisions: ApprovalStepDecisionRecord[];
}

async function readFallbackStore(madrasaId: string): Promise<FallbackApprovalStore> {
  const store = await readJsonStore(madrasaId, "security");
  return {
    workflows: Array.isArray(store.approval_workflows_v2) ? store.approval_workflows_v2 : [],
    requests: Array.isArray(store.approval_requests_v2) ? store.approval_requests_v2 : [],
    decisions: Array.isArray(store.approval_step_decisions_v2)
      ? store.approval_step_decisions_v2
      : [],
  };
}

export async function listWorkflowsForMadrasa(
  madrasaId: string
): Promise<ApprovalWorkflowWithSteps[]> {
  try {
    const admin = await createAdminClient();
    const { data: wfRows, error: wfError } = await admin
      .from("approval_workflows")
      .select("*")
      .eq("madrasa_id", madrasaId)
      .order("priority", { ascending: false });

    if (wfError) {
      if (isMissingTableError(wfError)) {
        const fb = await readFallbackStore(madrasaId);
        return fb.workflows.map(normalizeWorkflow);
      }
      throw wfError;
    }

    const workflows = (wfRows || []) as Record<string, any>[];
    if (workflows.length === 0) return [];

    const { data: stepRows, error: stepError } = await admin
      .from("approval_workflow_steps")
      .select("*")
      .eq("madrasa_id", madrasaId)
      .order("step_order", { ascending: true });

    if (stepError && !isMissingTableError(stepError)) {
      throw stepError;
    }

    const stepsByWf = new Map<string, Record<string, any>[]>();
    for (const step of (stepRows || []) as Record<string, any>[]) {
      const wfId = String(step.workflow_id || "");
      const arr = stepsByWf.get(wfId) || [];
      arr.push(step);
      stepsByWf.set(wfId, arr);
    }

    return workflows.map((wf) =>
      normalizeWorkflow({
        ...wf,
        steps: stepsByWf.get(String(wf.id)) || [],
      })
    );
  } catch (err) {
    console.warn("listWorkflowsForMadrasa fallback:", err);
    const fb = await readFallbackStore(madrasaId);
    return fb.workflows.map(normalizeWorkflow);
  }
}

export async function upsertWorkflowForMadrasa(
  madrasaId: string,
  userId: string,
  input: {
    id?: string;
    name: string;
    name_bn?: string | null;
    request_type: string;
    description?: string | null;
    min_amount?: number;
    max_amount?: number | null;
    is_active?: boolean;
    priority?: number;
    require_two_person?: boolean;
    steps: Array<{
      step_order?: number;
      step_name: string;
      approver_role?: string | null;
      required_permission?: string | null;
      approver_user_id?: string | null;
      sla_hours?: number;
      allow_delegation?: boolean;
      require_step_up?: boolean;
    }>;
  }
): Promise<ApprovalWorkflowWithSteps> {
  const workflowId = input.id || genId("wf");
  const now = new Date().toISOString();
  const normalizedSteps: ApprovalWorkflowStep[] = (input.steps || []).map((s, idx) => ({
    id: genId("wfs"),
    madrasa_id: madrasaId,
    workflow_id: workflowId,
    step_order: Number(s.step_order ?? idx + 1),
    step_name: String(s.step_name || `ধাপ ${idx + 1}`),
    approver_role: s.approver_role || null,
    required_permission: s.required_permission || null,
    approver_user_id: s.approver_user_id || null,
    sla_hours: Math.max(1, Number(s.sla_hours ?? 24)),
    allow_delegation: Boolean(s.allow_delegation),
    require_step_up: Boolean(s.require_step_up),
    created_at: now,
    updated_at: now,
  }));

  const fullWorkflow: ApprovalWorkflowWithSteps = {
    id: workflowId,
    madrasa_id: madrasaId,
    name: input.name.trim(),
    name_bn: input.name_bn ?? input.name.trim(),
    request_type: input.request_type,
    description: input.description || null,
    min_amount: Math.max(0, Number(input.min_amount ?? 0)),
    min_amount_threshold: Math.max(0, Number(input.min_amount ?? 0)),
    threshold_amount: Math.max(0, Number(input.min_amount ?? 0)),
    max_amount:
      input.max_amount !== null && input.max_amount !== undefined
        ? Number(input.max_amount)
        : null,
    is_active: input.is_active !== false,
    priority: Number(input.priority ?? 0),
    require_two_person: input.require_two_person !== false,
    created_by: userId,
    created_at: now,
    updated_at: now,
    steps: normalizedSteps,
  };

  try {
    const admin = await createAdminClient();
    const { error: wfErr } = await admin.from("approval_workflows").upsert(
      {
        id: workflowId,
        madrasa_id: madrasaId,
        name: fullWorkflow.name,
        name_bn: fullWorkflow.name_bn,
        request_type: fullWorkflow.request_type,
        description: fullWorkflow.description,
        min_amount: fullWorkflow.min_amount,
        max_amount: fullWorkflow.max_amount,
        is_active: fullWorkflow.is_active,
        priority: fullWorkflow.priority,
        require_two_person: fullWorkflow.require_two_person,
        created_by: userId,
        updated_at: now,
      },
      { onConflict: "id" }
    );

    if (wfErr) {
      if (isMissingTableError(wfErr)) {
        await mergeJsonStore(madrasaId, "security", (store) => {
          const existing: ApprovalWorkflowWithSteps[] = Array.isArray(store.approval_workflows_v2)
            ? store.approval_workflows_v2
            : [];
          const filtered = existing.filter((w) => w.id !== workflowId);
          return {
            ...store,
            approval_workflows_v2: [fullWorkflow, ...filtered],
          };
        });
        return fullWorkflow;
      }
      throw wfErr;
    }

    // Replace steps cleanly
    await admin
      .from("approval_workflow_steps")
      .delete()
      .eq("workflow_id", workflowId)
      .eq("madrasa_id", madrasaId);

    if (normalizedSteps.length > 0) {
      const stepRowsWithStepUp = normalizedSteps.map((s) => ({
        id: s.id,
        madrasa_id: madrasaId,
        workflow_id: workflowId,
        step_order: s.step_order,
        step_name: s.step_name,
        approver_role: s.approver_role,
        required_permission: s.required_permission,
        approver_user_id: s.approver_user_id,
        sla_hours: s.sla_hours,
        allow_delegation: s.allow_delegation,
        require_step_up: Boolean(s.require_step_up ?? s.is_critical ?? false),
      }));

      let { error: stepErr } = await admin
        .from("approval_workflow_steps")
        .insert(stepRowsWithStepUp);

      if (
        stepErr &&
        (String((stepErr as any).code || "") === "42703" ||
          String((stepErr as any).code || "") === "PGRST204" ||
          /require_step_up/i.test(String((stepErr as any).message || "")))
      ) {
        const retry = await admin.from("approval_workflow_steps").insert(
          stepRowsWithStepUp.map(({ require_step_up: _omitted, ...rest }) => rest)
        );
        stepErr = retry.error;
      }

      if (stepErr && !isMissingTableError(stepErr)) {
        throw stepErr;
      }
    }

    return fullWorkflow;
  } catch (err) {
    if (isMissingTableError(err)) {
      await mergeJsonStore(madrasaId, "security", (store) => {
        const existing: ApprovalWorkflowWithSteps[] = Array.isArray(store.approval_workflows_v2)
          ? store.approval_workflows_v2
          : [];
        const filtered = existing.filter((w) => w.id !== workflowId);
        return {
          ...store,
          approval_workflows_v2: [fullWorkflow, ...filtered],
        };
      });
      return fullWorkflow;
    }
    throw err;
  }
}

export async function deleteWorkflowForMadrasa(
  madrasaId: string,
  workflowId: string
): Promise<boolean> {
  try {
    const admin = await createAdminClient();
    const { error } = await admin
      .from("approval_workflows")
      .delete()
      .eq("id", workflowId)
      .eq("madrasa_id", madrasaId);

    if (error) {
      if (isMissingTableError(error)) {
        await mergeJsonStore(madrasaId, "security", (store) => ({
          ...store,
          approval_workflows_v2: (store.approval_workflows_v2 || []).filter(
            (w: ApprovalWorkflowWithSteps) => w.id !== workflowId
          ),
        }));
        return true;
      }
      throw error;
    }
    return true;
  } catch (err) {
    if (isMissingTableError(err)) {
      await mergeJsonStore(madrasaId, "security", (store) => ({
        ...store,
        approval_workflows_v2: (store.approval_workflows_v2 || []).filter(
          (w: ApprovalWorkflowWithSteps) => w.id !== workflowId
        ),
      }));
      return true;
    }
    throw err;
  }
}

export async function insertApprovalRequestRecord(
  madrasaId: string,
  record: ApprovalRequestRecord
): Promise<ApprovalRequestRecord> {
  try {
    const admin = await createAdminClient();
    const { data, error } = await admin
      .from("approval_requests")
      .insert({
        id: record.id,
        madrasa_id: madrasaId,
        workflow_id: record.workflow_id || null,
        request_type: record.request_type,
        title: record.title,
        description: record.description || null,
        entity_type: record.entity_type || null,
        target_id: record.target_id,
        target_name: record.target_name || null,
        amount: record.amount,
        threshold_amount: record.threshold_amount,
        payload: record.payload || {},
        requested_by: record.requested_by || null,
        requested_by_name: record.requested_by_name || null,
        requested_by_role: record.requested_by_role || null,
        current_step_order: record.current_step_order,
        total_steps: record.total_steps,
        status: record.status,
        sla_due_at: record.sla_due_at || null,
      })
      .select("*")
      .single();

    if (error) {
      if (isMissingTableError(error)) {
        await mergeJsonStore(madrasaId, "security", (store) => {
          const existing: ApprovalRequestRecord[] = Array.isArray(store.approval_requests_v2)
            ? store.approval_requests_v2
            : [];
          return {
            ...store,
            approval_requests_v2: [record, ...existing].slice(0, 200),
          };
        });
        return record;
      }
      throw error;
    }

    return {
      ...record,
      ...(data as Record<string, any>),
    };
  } catch (err) {
    if (isMissingTableError(err)) {
      await mergeJsonStore(madrasaId, "security", (store) => {
        const existing: ApprovalRequestRecord[] = Array.isArray(store.approval_requests_v2)
          ? store.approval_requests_v2
          : [];
        return {
          ...store,
          approval_requests_v2: [record, ...existing].slice(0, 200),
        };
      });
      return record;
    }
    throw err;
  }
}

export async function listApprovalRequestsForMadrasa(
  madrasaId: string,
  filters?: { status?: string; requestType?: string; limit?: number }
): Promise<ApprovalRequestRecord[]> {
  try {
    const admin = await createAdminClient();
    let query = admin
      .from("approval_requests")
      .select("*")
      .eq("madrasa_id", madrasaId)
      .order("created_at", { ascending: false });

    if (filters?.status && filters.status !== "ALL") {
      query = query.eq("status", filters.status);
    }
    if (filters?.requestType && filters.requestType !== "ALL") {
      query = query.eq("request_type", filters.requestType);
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;
    if (error) {
      if (isMissingTableError(error)) {
        const fb = await readFallbackStore(madrasaId);
        let list = fb.requests;
        if (filters?.status && filters.status !== "ALL") {
          list = list.filter((r) => r.status === filters.status);
        }
        if (filters?.requestType && filters.requestType !== "ALL") {
          list = list.filter((r) => r.request_type === filters.requestType);
        }
        return list.map((r) => ({
          ...r,
          sla_breached: r.status === "PENDING" && isSlaBreached(r.sla_due_at),
          decisions: fb.decisions.filter((d) => d.request_id === r.id),
        }));
      }
      throw error;
    }

    const requests = (data || []) as ApprovalRequestRecord[];
    if (requests.length === 0) return [];

    // Hydrate decisions and workflow steps in batch
    const { data: decisionRows, error: decErr } = await admin
      .from("approval_step_decisions")
      .select("*")
      .eq("madrasa_id", madrasaId)
      .order("step_order", { ascending: true });

    const decisionsByReq = new Map<string, ApprovalStepDecisionRecord[]>();
    if (!decErr && Array.isArray(decisionRows)) {
      for (const d of decisionRows as ApprovalStepDecisionRecord[]) {
        const arr = decisionsByReq.get(d.request_id) || [];
        arr.push(d);
        decisionsByReq.set(d.request_id, arr);
      }
    }

    const workflows = await listWorkflowsForMadrasa(madrasaId);
    const wfMap = new Map(workflows.map((w) => [w.id, w]));

    return requests.map((r) => {
      const wf = r.workflow_id ? wfMap.get(r.workflow_id) : undefined;
      return {
        ...r,
        amount: Number(r.amount ?? 0),
        threshold_amount: Number(r.threshold_amount ?? 0),
        current_step_order: Number(r.current_step_order ?? 1),
        total_steps: Number(r.total_steps ?? wf?.steps.length ?? 1),
        sla_breached: r.status === "PENDING" && isSlaBreached(r.sla_due_at),
        steps: wf?.steps || [],
        decisions: decisionsByReq.get(r.id) || [],
      };
    });
  } catch (err) {
    if (isMissingTableError(err)) {
      const fb = await readFallbackStore(madrasaId);
      return fb.requests.map((r) => ({
        ...r,
        sla_breached: r.status === "PENDING" && isSlaBreached(r.sla_due_at),
        decisions: fb.decisions.filter((d) => d.request_id === r.id),
      }));
    }
    throw err;
  }
}

export async function getApprovalRequestByIdForMadrasa(
  madrasaId: string,
  requestId: string
): Promise<{
  request: ApprovalRequestRecord | null;
  crossTenantDenied?: boolean;
  steps: ApprovalWorkflowStep[];
  decisions: ApprovalStepDecisionRecord[];
  workflow: ApprovalWorkflowWithSteps | null;
}> {
  try {
    const admin = await createAdminClient();
    const { data: row, error } = await admin
      .from("approval_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();

    if (error) {
      if (isMissingTableError(error)) {
        const fb = await readFallbackStore(madrasaId);
        const found = fb.requests.find((r) => r.id === requestId) || null;
        if (!found) {
          return { request: null, steps: [], decisions: [], workflow: null };
        }
        const wf = found.workflow_id
          ? fb.workflows.find((w) => w.id === found.workflow_id) || null
          : null;
        return {
          request: found,
          steps: wf?.steps || [],
          decisions: fb.decisions.filter((d) => d.request_id === requestId),
          workflow: wf,
        };
      }
      throw error;
    }

    if (!row) {
      return { request: null, steps: [], decisions: [], workflow: null };
    }

    if (String((row as any).madrasa_id || "") !== madrasaId) {
      return {
        request: null,
        crossTenantDenied: true,
        steps: [],
        decisions: [],
        workflow: null,
      };
    }

    const req = row as ApprovalRequestRecord;
    let workflow: ApprovalWorkflowWithSteps | null = null;
    if (req.workflow_id) {
      const allWfs = await listWorkflowsForMadrasa(madrasaId);
      workflow = allWfs.find((w) => w.id === req.workflow_id) || null;
    }

    const { data: decRows } = await admin
      .from("approval_step_decisions")
      .select("*")
      .eq("request_id", requestId)
      .eq("madrasa_id", madrasaId)
      .order("step_order", { ascending: true });

    const decisions = (decRows || []) as ApprovalStepDecisionRecord[];
    return {
      request: req,
      steps: workflow?.steps || [],
      decisions,
      workflow,
    };
  } catch (err) {
    if (isMissingTableError(err)) {
      const fb = await readFallbackStore(madrasaId);
      const found = fb.requests.find((r) => r.id === requestId) || null;
      const wf = found?.workflow_id
        ? fb.workflows.find((w) => w.id === found.workflow_id) || null
        : null;
      return {
        request: found,
        steps: wf?.steps || [],
        decisions: fb.decisions.filter((d) => d.request_id === requestId),
        workflow: wf,
      };
    }
    throw err;
  }
}

export async function recordStepDecisionAndUpdateRequest(params: {
  madrasaId: string;
  requestId: string;
  decisionRecord: ApprovalStepDecisionRecord;
  requestPatch: Partial<ApprovalRequestRecord>;
}): Promise<void> {
  const { madrasaId, requestId, decisionRecord, requestPatch } = params;
  try {
    const admin = await createAdminClient();
    const { error: decErr } = await admin.from("approval_step_decisions").insert({
      id: decisionRecord.id,
      madrasa_id: madrasaId,
      request_id: requestId,
      step_id: decisionRecord.step_id || null,
      step_order: decisionRecord.step_order,
      step_name: decisionRecord.step_name || null,
      decided_by: decisionRecord.decided_by || null,
      decided_by_name: decisionRecord.decided_by_name || null,
      decided_by_role: decisionRecord.decided_by_role || null,
      decision: decisionRecord.decision,
      notes: decisionRecord.notes || null,
      sla_breached: decisionRecord.sla_breached,
      decided_at: decisionRecord.decided_at,
    });

    if (decErr && isMissingTableError(decErr)) {
      await mergeJsonStore(madrasaId, "security", (store) => {
        const reqs: ApprovalRequestRecord[] = Array.isArray(store.approval_requests_v2)
          ? store.approval_requests_v2
          : [];
        const decs: ApprovalStepDecisionRecord[] = Array.isArray(
          store.approval_step_decisions_v2
        )
          ? store.approval_step_decisions_v2
          : [];
        return {
          ...store,
          approval_step_decisions_v2: [...decs, decisionRecord],
          approval_requests_v2: reqs.map((r) =>
            r.id === requestId ? { ...r, ...requestPatch } : r
          ),
        };
      });
      return;
    }

    const { error: reqErr } = await admin
      .from("approval_requests")
      .update({
        ...requestPatch,
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .eq("madrasa_id", madrasaId);

    if (reqErr && !isMissingTableError(reqErr)) {
      throw reqErr;
    }
  } catch (err) {
    if (isMissingTableError(err)) {
      await mergeJsonStore(madrasaId, "security", (store) => {
        const reqs: ApprovalRequestRecord[] = Array.isArray(store.approval_requests_v2)
          ? store.approval_requests_v2
          : [];
        const decs: ApprovalStepDecisionRecord[] = Array.isArray(
          store.approval_step_decisions_v2
        )
          ? store.approval_step_decisions_v2
          : [];
        return {
          ...store,
          approval_step_decisions_v2: [...decs, decisionRecord],
          approval_requests_v2: reqs.map((r) =>
            r.id === requestId ? { ...r, ...requestPatch } : r
          ),
        };
      });
      return;
    }
    throw err;
  }
}

export async function updateApprovalRequestStatus(
  madrasaId: string,
  requestId: string,
  patch: Partial<ApprovalRequestRecord>
): Promise<void> {
  try {
    const admin = await createAdminClient();
    const { error } = await admin
      .from("approval_requests")
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .eq("madrasa_id", madrasaId);

    if (error) {
      if (isMissingTableError(error)) {
        await mergeJsonStore(madrasaId, "security", (store) => ({
          ...store,
          approval_requests_v2: (store.approval_requests_v2 || []).map(
            (r: ApprovalRequestRecord) => (r.id === requestId ? { ...r, ...patch } : r)
          ),
        }));
        return;
      }
      throw error;
    }
  } catch (err) {
    if (isMissingTableError(err)) {
      await mergeJsonStore(madrasaId, "security", (store) => ({
        ...store,
        approval_requests_v2: (store.approval_requests_v2 || []).map(
          (r: ApprovalRequestRecord) => (r.id === requestId ? { ...r, ...patch } : r)
        ),
      }));
      return;
    }
    throw err;
  }
}

/**
 * Checks if an active approval workflow matches `(requestType, amount)`.
 * If matched, creates a PENDING approval request with the deferred payload and
 * returns `{ matched: true, approvalRequestId }`. If not matched, returns `{ matched: false }`.
 */
export async function submitWorkflowHookApproval(params: {
  madrasaId: string;
  actorId: string;
  actorName?: string;
  actorRole?: string;
  requestType: ApprovalWorkflowRequestType;
  amount: number;
  title: string;
  description?: string;
  entityType?: string;
  targetId: string;
  targetName?: string;
  payload: Record<string, any>;
}): Promise<
  | { matched: false }
  | { matched: true; approvalRequestId: string; request: ApprovalRequestRecord }
> {
  const workflows = await listWorkflowsForMadrasa(params.madrasaId);
  const matched = matchApprovalWorkflow(workflows, params.requestType, params.amount);
  if (!matched) {
    return { matched: false };
  }

  const now = new Date();
  const steps = matched.steps || [];
  const firstStep = steps[0] || null;
  const slaDueAt = calculateSlaDueAt(now, Number(firstStep?.sla_hours ?? 24));
  const id = genId("appr");

  const record: ApprovalRequestRecord = {
    id,
    madrasa_id: params.madrasaId,
    workflow_id: matched.id,
    request_type: params.requestType,
    title: params.title,
    description: params.description || "",
    entity_type: params.entityType || String(params.requestType).toLowerCase(),
    target_id: params.targetId,
    target_name: params.targetName || undefined,
    amount: Number.isFinite(params.amount) ? params.amount : 0,
    threshold_amount: matched.min_amount,
    payload: params.payload,
    requested_by: params.actorId,
    requester_id: params.actorId,
    requested_by_name: params.actorName || "অফিসার",
    requested_by_role: params.actorRole || "staff",
    current_step_order: 1,
    total_steps: Math.max(1, steps.length),
    status: "PENDING",
    sla_due_at: slaDueAt,
    created_at: now.toISOString(),
    steps,
    decisions: [],
  };

  const saved = await insertApprovalRequestRecord(params.madrasaId, record);

  const { logAuditEvent } = await import("@/lib/audit-log");
  await logAuditEvent({
    madrasaId: params.madrasaId,
    actorId: params.actorId,
    actorName: params.actorName || "অফিসার",
    actorRole: params.actorRole || "staff",
    module: "approvals",
    action: "APPROVAL_REQUESTED",
    entityType: "approval_request",
    entityId: saved.id,
    entityLabel: params.title,
    summary: `ওয়ার্কফ্লো অনুমোদনের আবেদন (${params.requestType}): ${params.title}`,
    newValue: {
      request_type: params.requestType,
      amount: params.amount,
      workflow_id: matched.id,
      total_steps: record.total_steps,
    },
    severity: "INFO",
  });

  return { matched: true, approvalRequestId: saved.id, request: saved };
}

