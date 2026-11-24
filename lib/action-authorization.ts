import { HEALTH_ROLES } from "@/lib/student-health/model";
import { cache } from "react";
import { createAdminClient, getWebAppSession } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions-server";
import { logAuditEvent, type AuditSeverity } from "@/lib/audit-log";
import type { PermissionRiskLevel } from "@/lib/permissions";

export { logAuditEvent };

/**
 * ============================================================================
 * CR-2 · সব Server Action-এর জন্য কেন্দ্রীয় authorization choke point
 * ============================================================================
 *
 * সমস্যা: প্রায় ৫০টি action ফাইলে ৪০০+ server action ছিল, যেগুলোতে কেবল
 * `if (!user) return { error: "Unauthorized" }` ছিল — কোনো Permission/role যাচাই নয়।
 * ফলে কোনো লগইন করা অ্যাকাউন্ট (এমনকি অভিভাবক/শিক্ষার্থী পোর্টালের টোকেন বা সাসপেন্ডেড
 * অ্যাকাউন্টও) ব্রাউজার থেকে সরাসরি যেকোনো action invoke করে ডেটা লেখা/মুছে ফেলতে পারত।
 * RLS থাকলেও একই মাদ্রাসার সব ইউজারের জন্য সমান অনুমতি দেয়, তাই সেটি রক্ষা করে না।
 *
 * সমাধান: প্রতিটি write action-এর শুরুতে একটি একক guard যুক্ত করা হয় (স্ক্রিপ্টে
 * স্বয়ংক্রিয়ভাবে বসানো) — `writeGuard("<module>")`। এটি:
 *   ১. লগইন + অ্যাকাউন্ট স্ট্যাটাস (SUSPENDED/DISABLED → বন্ধ) যাচাই করে
 *   ২. ইউজারের মাদ্রাসা (tenant) রেজলভ করে — না পেলে fail-closed
 *   ৩. মডিউল-ভিত্তিক পারমিশন/রোল নীতি প্রয়োগ করে
 *   ৪. পোর্টাল-রোল (student/parent) কে ড্যাশবোর্ড write path থেকে সরাসরি ব্লক করে
 *   ৫. ইউনিফাইড `logAuditEvent` মিডলওয়্যার সংযুক্ত করে (অননুমোদিত চেষ্টা অটো-লগ + বাউন্ড `logAudit`)
 *
 * `requirePermission`-এর মতোই OR শর্ত: permissions **অথবা** roles-এর যেকোনো একটি মিললেই অনুমতি।
 */

export type ModuleKey =
  | "finance"
  | "zakat"
  | "fundraising"
  | "users"
  | "roles"
  | "student_health"
  | "students"
  | "teachers"
  | "attendance"
  | "exams"
  | "hifz"
  | "routine"
  | "classes"
  | "subjects"
  | "library"
  | "inventory"
  | "communication"
  | "boarding"
  | "staff"
  | "sessions"
  | "admissions"
  | "certificates"
  | "backup"
  | "kitab"
  | "leaves"
  | "holidays"
  | "syllabus"
  | "questions"
  | "biometric"
  | "approvals"
  | "security"
  | "automation"
  | "webhooks"
  | "analytics"
  | "anomaly"
  | "bi"
  | "generic";

type ModulePolicy = {
  permissions?: string[];
  roles?: string[];
  denyRoles?: string[];
  errorMessage?: string;
};

/** পোর্টাল ব্যবহারকারীরা ড্যাশবোর্ডের write action সরাসরি চালাতে পারবেন না। */
const PORTAL_ROLES = ["student", "parent", "guardian", "guardian_student"];

const FINANCE_PERMS = [
  "finance.create",
  "finance.edit",
  "finance.approve",
  "fee.create",
  "fee.edit",
  "fee.approve",
];

const FINANCE_ROLE_NAMES = [
  "super_admin",
  "admin",
  "muhtamim",
  "naib_muhtamim",
  "accountant",
];

const ACADEMIC_ROLES = [
  "super_admin",
  "admin",
  "muhtamim",
  "naib_muhtamim",
  "teacher",
  "hifz_teacher",
  "ustad",
  "hifz_supervisor",
  "exam_manager",
  "attendance_manager",
  "office_staff",
];

export const MODULE_POLICIES: Record<ModuleKey, ModulePolicy> = {
  // ── টাকার লেনদেন: কঠোর নীতি ───────────────────────────────────────────────
  finance: {
    permissions: FINANCE_PERMS,
    roles: FINANCE_ROLE_NAMES,
    errorMessage: "আর্থিক লেনদেন করার অনুমতি আপনার নেই।",
  },
  zakat: {
    permissions: FINANCE_PERMS,
    roles: FINANCE_ROLE_NAMES,
    errorMessage: "যাকাত/অনুদান সংক্রান্ত কাজের অনুমতি আপনার নেই।",
  },
  fundraising: {
    permissions: FINANCE_PERMS,
    roles: FINANCE_ROLE_NAMES,
    errorMessage: "ফান্ডরেইজিং/ফান্ড পরিচালনার অনুমতি আপনার নেই।",
  },

  // ── ইউজার ও রোল: সর্বোচ্চ সতর্কতা ────────────────────────────────────────
  users: {
    permissions: ["user.create", "user.edit", "user.disable", "user.reset"],
    roles: ["super_admin", "admin", "muhtamim"],
    denyRoles: PORTAL_ROLES,
    errorMessage: "ইউজার পরিচালনার অনুমতি আপনার নেই।",
  },
  roles: {
    permissions: ["role.assign", "role.create", "role.edit", "role.delete"],
    roles: ["super_admin", "admin", "muhtamim"],
    denyRoles: PORTAL_ROLES,
    errorMessage: "রোল/নিরাপত্তা সেটিংস পরিবর্তনের অনুমতি আপনার নেই।",
  },

  // ── পড়াশোনা ও প্রশাসন: স্টাফ রোল + সংশ্লিষ্ট পারমিশন ──────────────────────
  student_health: { roles: HEALTH_ROLES, denyRoles: PORTAL_ROLES, errorMessage: "স্বাস্থ্য নথি দেখার বা পরিবর্তনের অনুমতি নেই।" },
  students: {
    permissions: [
      "student.create",
      "student.edit",
      "student.archive",
      "student.documents.manage",
      "student.profile.approve",
      "student.view",
    ],
    roles: [...ACADEMIC_ROLES, "accountant", "office_staff", "hr_manager"],
    denyRoles: PORTAL_ROLES,
  },
  teachers: {
    permissions: ["teacher.create", "teacher.edit", "teacher.archive"],
    roles: [...ACADEMIC_ROLES, "hr_manager"],
    denyRoles: PORTAL_ROLES,
  },
  attendance: {
    permissions: ["attendance.create", "attendance.edit", "attendance.approve"],
    roles: [...ACADEMIC_ROLES, "office_staff"],
    denyRoles: PORTAL_ROLES,
  },
  exams: {
    permissions: [
      "exam.create",
      "exam.edit",
      "exam.marks.enter",
      "exam.marks.edit",
      "exam.result.publish",
      "exam.result.approve",
    ],
    roles: [...ACADEMIC_ROLES, "office_staff"],
    denyRoles: PORTAL_ROLES,
  },
  hifz: {
    permissions: ["hifz.create", "hifz.edit", "hifz.approve"],
    roles: [...ACADEMIC_ROLES, "office_staff"],
    denyRoles: PORTAL_ROLES,
  },
  routine: {
    permissions: ["routine.create", "routine.edit", "routine.delete", "routine.publish"],
    roles: [...ACADEMIC_ROLES, "office_staff"],
    denyRoles: PORTAL_ROLES,
  },
  classes: {
    permissions: ["academic.manage"],
    roles: [...ACADEMIC_ROLES, "office_staff"],
    denyRoles: PORTAL_ROLES,
  },
  subjects: {
    permissions: ["academic.manage"],
    roles: [...ACADEMIC_ROLES, "office_staff"],
    denyRoles: PORTAL_ROLES,
  },
  syllabus: {
    permissions: ["academic.manage"],
    roles: [...ACADEMIC_ROLES, "office_staff"],
    denyRoles: PORTAL_ROLES,
  },
  questions: {
    permissions: ["exam.create", "exam.edit", "academic.manage"],
    roles: [...ACADEMIC_ROLES, "office_staff"],
    denyRoles: PORTAL_ROLES,
  },
  library: {
    permissions: ["library.manage", "library.issue", "library.return"],
    roles: ["super_admin", "admin", "muhtamim", "naib_muhtamim", "librarian", "office_staff"],
    denyRoles: PORTAL_ROLES,
  },
  inventory: {
    permissions: ["inventory.create", "inventory.edit", "inventory.delete"],
    roles: ["super_admin", "admin", "muhtamim", "naib_muhtamim", "office_staff", "accountant"],
    denyRoles: PORTAL_ROLES,
  },
  kitab: {
    permissions: ["kitab.create", "kitab.edit", "kitab.delete"],
    // শিক্ষক/ওস্তাদরা শিক্ষার্থীর কিতাব পাঠের দরস-ডায়েরি এন্ট্রি করেন (হিফজের মতোই) —
    // তাই ACADEMIC_ROLES এখানে যুক্ত। পোর্টাল রোল এখনো সম্পূর্ণ নিষিদ্ধ।
    roles: [...ACADEMIC_ROLES, "librarian", "office_staff"],
    denyRoles: PORTAL_ROLES,
  },
  boarding: {
    permissions: ["boarding.create", "boarding.edit", "boarding.delete", "finance.create"],
    roles: ["super_admin", "admin", "muhtamim", "naib_muhtamim", "office_staff", "accountant"],
    denyRoles: PORTAL_ROLES,
  },
  staff: {
    permissions: ["staff.create", "staff.edit", "staff.archive", "staff.salary.manage", "hr.manage"],
    roles: ["super_admin", "admin", "muhtamim", "naib_muhtamim", "hr_manager", "office_staff"],
    denyRoles: PORTAL_ROLES,
  },
  communication: {
    permissions: ["communication.send", "communication.manage", "notice.create", "notice.manage"],
    roles: [...ACADEMIC_ROLES, "office_staff"],
    denyRoles: PORTAL_ROLES,
  },
  sessions: {
    permissions: ["academic.manage", "session.manage"],
    roles: [...ACADEMIC_ROLES, "office_staff"],
    denyRoles: PORTAL_ROLES,
  },
  admissions: {
    permissions: ["admission.create", "admission.edit", "admission.approve", "student.create"],
    roles: [...ACADEMIC_ROLES, "office_staff"],
    denyRoles: PORTAL_ROLES,
  },
  certificates: {
    permissions: ["certificate.issue", "certificate.manage", "academic.manage"],
    roles: [...ACADEMIC_ROLES, "office_staff"],
    denyRoles: PORTAL_ROLES,
  },
  leaves: {
    permissions: ["staff.leave", "staff.leave.approve", "leave.create", "leave.approve"],
    roles: [...ACADEMIC_ROLES, "hr_manager", "office_staff"],
    denyRoles: PORTAL_ROLES,
  },
  holidays: {
    permissions: ["holiday.manage", "academic.manage"],
    roles: [...ACADEMIC_ROLES, "office_staff"],
    denyRoles: PORTAL_ROLES,
  },
  biometric: {
    permissions: ["biometric.manage", "attendance.edit", "attendance.create"],
    roles: [...ACADEMIC_ROLES, "office_staff"],
    denyRoles: PORTAL_ROLES,
  },
  backup: {
    permissions: ["settings.backup", "settings.manage", "system.backup"],
    roles: ["super_admin", "admin", "muhtamim"],
    denyRoles: PORTAL_ROLES,
    errorMessage: "ব্যাকআপ/রিস্টোর করার অনুমতি কেবল প্রশাসনের আছে।",
  },
  approvals: {
    permissions: [
      "approval.view",
      "approval.manage",
      "approval.approve",
      "fee.approve",
      "finance.approve",
    ],
    roles: ["super_admin", "admin", "muhtamim", "naib_muhtamim"],
    denyRoles: PORTAL_ROLES,
    errorMessage: "অনুমোদন ওয়ার্কফ্লো পরিচালনার অনুমতি আপনার নেই।",
  },
  security: {
    permissions: ["security.sessions.manage", "security.2fa.manage", "role.assign", "audit.view"],
    roles: ["super_admin", "admin", "muhtamim"],
    denyRoles: PORTAL_ROLES,
    errorMessage: "নিরাপত্তা সেটিংস পরিচালনার অনুমতি আপনার নেই।",
  },
  automation: {
    permissions: ["automation.manage", "automation.view", "settings.edit"],
    roles: ["super_admin", "admin", "muhtamim"],
    denyRoles: PORTAL_ROLES,
    errorMessage: "অটোমেশন ও ক্রন পরিচালনার অনুমতি আপনার নেই।",
  },
  webhooks: {
    permissions: ["webhook.manage", "webhook.view", "settings.edit"],
    roles: ["super_admin", "admin", "muhtamim"],
    denyRoles: PORTAL_ROLES,
    errorMessage: "ওয়েবহুক পরিচালনার অনুমতি আপনার নেই।",
  },
  analytics: {
    permissions: [
      "analytics.early_warning",
      "analytics.early_warning.manage",
      "dashboard.analytics",
    ],
    roles: [...ACADEMIC_ROLES, "accountant"],
    denyRoles: PORTAL_ROLES,
    errorMessage: "বিশ্লেষণ ও আর্লি ওয়ার্নিং দেখার অনুমতি আপনার নেই।",
  },
  anomaly: {
    permissions: ["anomaly.view", "anomaly.manage", "finance.view", "audit.view"],
    roles: ["super_admin", "admin", "muhtamim", "naib_muhtamim", "accountant"],
    denyRoles: PORTAL_ROLES,
    errorMessage: "আর্থিক ও বোর্ডিং অসঙ্গতি দেখার অনুমতি আপনার নেই।",
  },
  bi: {
    permissions: ["dashboard.analytics", "finance.view", "audit.view"],
    roles: ["super_admin", "admin", "muhtamim", "naib_muhtamim", "accountant"],
    denyRoles: PORTAL_ROLES,
    errorMessage: "এক্সিকিউটিভ BI ড্যাশবোর্ড দেখার অনুমতি আপনার নেই।",
  },

  // ── ডিফল্ট: পোর্টাল রোল ছাড়া সব সক্রিয় অ্যাকাউন্ট (নতুন মডিউলে ভাঙচুর এড়াতে) ──
  generic: {
    denyRoles: PORTAL_ROLES,
  },
};

export interface BoundAuditPayload {
  action: string;
  module?: string;
  entityType?: string | null;
  entityId?: string | null;
  entityLabel?: string | null;
  summary: string;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
  severity?: AuditSeverity;
}

export type ActionGuardAllowed = {
  allowed: true;
  userId?: string;
  madrasaId?: string;
  actorName?: string;
  actorEmail?: string;
  actorRole?: string;
  roles?: string[];
  /** বাউন্ড অডিট লগার — `writeGuard` থেকেই সরাসরি অপরিবর্তনীয় `system_audit_logs`-এ লগ করার জন্য */
  logAudit: (payload: BoundAuditPayload) => Promise<{
    success: boolean;
    storage: "sql" | "fallback" | "none";
    id?: string;
  }>;
};

/**
 * অনুমতি না থাকলে guard যা ফেরত দেয়।
 *
 * `T` হলো action-এর নিজের রিটার্ন টাইপ — ডিফল্ট `never`। কেন এত জটিলতা?
 *   • `any` হলে guarded action-এর infer হওয়া রিটার্ন টাইপ `any` হয়ে যেত → কলারদের সব
 *     টাইপ-সুরক্ষা নীরবে হারিয়ে যেত (যেমন `getStaffMetadataFull()`-এর `staff_members`)।
 *   • `{ error: string }` হলে সেই union member কলারদের `res.success` ধাঁচের কোড ভেঙে দিত।
 *   • `never` যেকোনো টাইপে assignable, union-এ কিছু যোগ করে না — অর্থাৎ টাইপ-সুরক্ষা অটুট
 *     থাকে এবং `return guard.fallback;` সব ধরনের action-এ (object, array, void) চলে।
 * রানটাইমে এর আসল মান `{ error: "..." }`।
 */
export interface WriteGuardStepUpOptions {
  riskLevel?: PermissionRiskLevel;
  requireStepUp?: boolean;
  stepUpToken?: string | null;
  actionScope?: string;
}

export type ActionGuardDenied<T = never> = {
  allowed: false;
  error: string;
  fallback: T;
  errorCode?: "UNAUTHENTICATED" | "NO_MADRASA" | "FORBIDDEN" | "STEP_UP_REQUIRED" | "INTERNAL";
  stepUpRequired?: boolean;
  actionScope?: string;
};

export type ActionGuardResult<T = never> = ActionGuardAllowed | ActionGuardDenied<T>;

const UNAUTHENTICATED_ERROR = "অননুমোদিত অ্যাক্সেস। অনুগ্রহ করে লগইন করুন।";
const NO_MADRASA_ERROR =
  "আপনার অ্যাকাউন্ট কোনো মাদ্রাসার সাথে যুক্ত নয়। মাদ্রাসা প্রশাসনের সাথে যোগাযোগ করুন।";
const INTERNAL_ERROR = "নিরাপত্তা যাচাই করা যায়নি — অনুগ্রহ করে আবার চেষ্টা করুন।";

function denied<T = never>(
  error: string,
  errorCode: ActionGuardDenied<T>["errorCode"],
  extra?: { stepUpRequired?: boolean; actionScope?: string }
): ActionGuardDenied<T> {
  const stepUpRequired = extra?.stepUpRequired || errorCode === "STEP_UP_REQUIRED";
  const runtimeFallback = stepUpRequired
    ? {
        error,
        stepUpRequired: true,
        errorCode: "STEP_UP_REQUIRED" as const,
        actionScope: extra?.actionScope,
      }
    : { error };

  return {
    allowed: false,
    error,
    // রানটাইমে `{ error }` (বা Step-Up হলে `{ error, stepUpRequired: true, errorCode }`)
    fallback: runtimeFallback as unknown as T,
    errorCode,
    ...(stepUpRequired ? { stepUpRequired: true, actionScope: extra?.actionScope } : {}),
  };
}

async function resolveGuardUncached(
  module: ModuleKey,
  stepUpOptions?: WriteGuardStepUpOptions
): Promise<ActionGuardResult> {
  try {
    const verified = await getWebAppSession();
    if (!verified) return denied(UNAUTHENTICATED_ERROR, "UNAUTHENTICATED");
    const { user, session } = verified;

    const madrasaId = session.madrasa_id as string | undefined;
    if (!madrasaId) return denied(NO_MADRASA_ERROR, "NO_MADRASA");

    const policy = MODULE_POLICIES[module] || MODULE_POLICIES.generic;

    const result = await requirePermission({
      userId: user.id,
      madrasaId,
      permissions: policy.permissions,
      roles: policy.roles,
      errorMessage: policy.errorMessage,
      denyRoles: policy.denyRoles,
      riskLevel: stepUpOptions?.riskLevel,
      requireStepUp: stepUpOptions?.requireStepUp,
      stepUpToken: stepUpOptions?.stepUpToken,
      actionScope: stepUpOptions?.actionScope,
    });

    const actorName =
      result.context?.profile?.fullName ||
      user.email ||
      "সিস্টেম ব্যবহারকারী";
    const actorEmail =
      result.context?.profile?.email || user.email || undefined;
    const actorRole = result.context?.role || undefined;

    if (!result.allowed) {
      if (result.stepUpRequired || result.errorCode === "STEP_UP_REQUIRED") {
        // Step-Up 2FA challenge required — DO NOT mislog as UNAUTHORIZED_WRITE_ATTEMPT
        return denied(
          result.error || "এই সংবেদনশীল কাজটি সম্পন্ন করতে ২-ধাপ যাচাইকরণ (Step-Up OTP/2FA) প্রয়োজন।",
          "STEP_UP_REQUIRED",
          { stepUpRequired: true, actionScope: result.actionScope || stepUpOptions?.actionScope }
        );
      }

      // স্বয়ংক্রিয়ভাবে অননুমোদিত রাইট অ্যাক্সেস চেষ্টা অডিট লগে রেকর্ড করুন
      logAuditEvent({
        madrasaId,
        actorId: user.id,
        actorName,
        actorEmail,
        actorRole,
        module: "security",
        action: "UNAUTHORIZED_WRITE_ATTEMPT",
        entityType: module,
        summary: `"${module}" মডিউলে অননুমোদিত পরিবর্তনের চেষ্টা ব্লক করা হয়েছে (${actorRole || "unknown"})।`,
        metadata: { target_module: module, reason: result.error || "FORBIDDEN" },
        severity: "CRITICAL",
      }).catch(() => {});

      return denied(result.error || "অনুমতি নেই।", "FORBIDDEN");
    }

    const boundLogAudit: ActionGuardAllowed["logAudit"] = async (payload) => {
      return logAuditEvent({
        madrasaId,
        actorId: user.id,
        actorName,
        actorEmail,
        actorRole,
        module: payload.module || module,
        action: payload.action,
        entityType: payload.entityType,
        entityId: payload.entityId,
        entityLabel: payload.entityLabel,
        summary: payload.summary,
        oldValue: payload.oldValue,
        newValue: payload.newValue,
        metadata: payload.metadata,
        severity: payload.severity || "INFO",
      });
    };

    return {
      allowed: true,
      userId: user.id,
      madrasaId,
      actorName,
      actorEmail,
      actorRole,
      roles: result.context?.roles || (actorRole ? [actorRole] : []),
      logAudit: boundLogAudit,
    };
  } catch (err) {
    console.error(`writeGuard(${module}) ব্যর্থ:`, err);
    return denied(INTERNAL_ERROR, "INTERNAL");
  }
}

const resolveGuard = cache(async (module: ModuleKey): Promise<ActionGuardResult> => {
  return resolveGuardUncached(module);
});

/**
 * write action-এর জন্য কেন্দ্রীয় guard + অডিট মিডলওয়্যার।
 */
export async function writeGuard<T = never>(
  module: ModuleKey = "generic",
  autoAudit?: BoundAuditPayload,
  stepUpOptions?: WriteGuardStepUpOptions
): Promise<ActionGuardResult<T>> {
  const hasStepUp = Boolean(
    stepUpOptions &&
      (stepUpOptions.requireStepUp ||
        stepUpOptions.riskLevel === "CRITICAL" ||
        stepUpOptions.stepUpToken ||
        stepUpOptions.actionScope)
  );

  // Bypass React `cache()` when step-up options are supplied so earlier non-step-up calls never mask step-up enforcement
  const res = (
    hasStepUp
      ? await resolveGuardUncached(module, stepUpOptions)
      : await resolveGuard(module)
  ) as ActionGuardResult<T>;

  if (res.allowed && autoAudit) {
    // Non-blocking audit record when caller provides autoAudit metadata
    res.logAudit(autoAudit).catch(() => {});
  }
  return res;
}
