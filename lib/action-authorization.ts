import { cache } from "react";
import { createAdminClient, createClient, getAuthUser } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions-server";

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
 *
 * `requirePermission`-এর মতোই OR শর্ত: permissions **অথবা** roles-এর যেকোনো একটি মিললেই অনুমতি।
 */

export type ModuleKey =
  | "finance"
  | "zakat"
  | "fundraising"
  | "users"
  | "roles"
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
  | "generic";

type ModulePolicy = {
  permissions?: string[];
  roles?: string[];
  denyRoles?: string[];
  errorMessage?: string;
};

/** পোর্টাল ব্যবহারকারীরা ড্যাশবোর্ডের write action সরাসরি চালাতে পারবেন না। */
const PORTAL_ROLES = ["student", "parent", "guardian"];

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

  // ── ডিফল্ট: পোর্টাল রোল ছাড়া সব সক্রিয় অ্যাকাউন্ট (নতুন মডিউলে ভাঙচুর এড়াতে) ──
  generic: {
    denyRoles: PORTAL_ROLES,
  },
};

export type ActionGuardAllowed = {
  allowed: true;
  userId?: string;
  madrasaId?: string;
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
export type ActionGuardDenied<T = never> = {
  allowed: false;
  error: string;
  fallback: T;
  errorCode?: "UNAUTHENTICATED" | "NO_MADRASA" | "FORBIDDEN" | "INTERNAL";
};

export type ActionGuardResult<T = never> = ActionGuardAllowed | ActionGuardDenied<T>;

const UNAUTHENTICATED_ERROR = "অননুমোদিত অ্যাক্সেস। অনুগ্রহ করে লগইন করুন।";
const NO_MADRASA_ERROR =
  "আপনার অ্যাকাউন্ট কোনো মাদ্রাসার সাথে যুক্ত নয়। মাদ্রাসা প্রশাসনের সাথে যোগাযোগ করুন।";
const INTERNAL_ERROR = "নিরাপত্তা যাচাই করা যায়নি — অনুগ্রহ করে আবার চেষ্টা করুন।";

function denied<T = never>(
  error: string,
  errorCode: ActionGuardDenied<T>["errorCode"]
): ActionGuardDenied<T> {
  return {
    allowed: false,
    error,
    // রানটাইমে সবসময় `{ error }` — টাইপ স্তরে T (ডিফল্ট never) যাতে কলারদের রিটার্ন-টাইপ অটুট থাকে
    fallback: { error } as unknown as T,
    errorCode,
  };
}

/**
 * write action-এর জন্য কেন্দ্রীয় guard।
 *
 * ব্যবহার (প্রতিটি write action-এর শুরুতে):
 * ```ts
 * const __authz = await writeGuard("finance");
 * if (!__authz.allowed) return __authz.fallback;
 * ```
 */
export async function writeGuard<T = never>(
  module: ModuleKey = "generic"
): Promise<ActionGuardResult<T>> {
  // একই রিকোয়েস্টে একাধিক guarded action পরপর ডাকা হলে (নেস্টেড কল, বাল্ক অপারেশন)
  // যাচাইয়ের ফলাফল-ই যথেষ্ট; React `cache()` দিয়ে per-request memoize করা হয় —
  // ফলে অতিরিক্ত DB round-trip হয় না, কিন্তু নিরাপত্তা এক বিন্দুও কমে না।
  return (await resolveGuard(module)) as ActionGuardResult<T>;
}

const resolveGuard = cache(async (module: ModuleKey): Promise<ActionGuardResult> => {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return denied(UNAUTHENTICATED_ERROR, "UNAUTHENTICATED");

    const adminClient = await createAdminClient();
    const { data: userRow, error: userErr } = await adminClient
      .from("users")
      .select("madrasa_id")
      .eq("id", user.id)
      .maybeSingle();

    if (userErr) {
      console.error(`writeGuard(${module}) — user row পড়া যায়নি:`, userErr);
    }

    const madrasaId = (userRow as any)?.madrasa_id as string | undefined;
    if (!madrasaId) return denied(NO_MADRASA_ERROR, "NO_MADRASA");

    const policy = MODULE_POLICIES[module] || MODULE_POLICIES.generic;

    const result = await requirePermission({
      userId: user.id,
      madrasaId,
      permissions: policy.permissions,
      roles: policy.roles,
      errorMessage: policy.errorMessage,
      denyRoles: policy.denyRoles,
    });

    if (!result.allowed) {
      return denied(result.error || "অনুমতি নেই।", "FORBIDDEN");
    }

    return { allowed: true, userId: user.id, madrasaId };
  } catch (err) {
    console.error(`writeGuard(${module}) ব্যর্থ:`, err);
    return denied(INTERNAL_ERROR, "INTERNAL");
  }
});
