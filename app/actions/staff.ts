"use server";
import {requirePermission} from "@/lib/permissions-server";
import {listWorkflowsForMadrasa,matchApprovalWorkflow} from "@/lib/approval-workflow";
import {salaryApprovalAmount,salaryTerms} from "@/lib/finance/salary-terms";
import {salaryAccess,staffForView} from "@/lib/finance/staff-access";
import {rows} from "@/lib/portal/queries";
import { postingError } from "@/lib/finance/funds";

import { toDhakaDateStringFrom, toDhakaDateString, getDhakaYear } from "@/lib/date-utils";
import { writeGuard } from "@/lib/action-authorization";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "@/app/actions/students";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";
import { editStaff, promoteStaff, type StaffEdit, type StaffPromotion } from '@/lib/finance/staff-edit';
import {
  listStructuredStaffLeaves,
  upsertStructuredStaffLeave,
  deleteStructuredStaffLeavesForStaff,
} from "@/lib/structured-config";
import { logAuditEvent } from "@/lib/audit-log";
import { getMadrasaInfo,toPublicMadrasaInfo } from "@/lib/getMadrasaInfo";
import {
  StaffMember,
  StaffCategory,
  StaffDepartment,
  StaffDesignation,
  StaffLeaveRequest,
  StaffSalaryPaymentRecord,
  StaffEmploymentHistoryRecord,
  StaffAuditLogRecord,
  StaffStatus,
  DEFAULT_STAFF_CATEGORIES,
  DEFAULT_STAFF_DEPARTMENTS,
  DEFAULT_STAFF_DESIGNATIONS,
  formatStaffIdCode,
  generateStaffVerificationToken,
  isCategory,
  isTeachingStaff,
} from "@/lib/staff-management";
import { revalidatePath } from "next/cache";

/**
 * Storage structure in madrasa metadata for staff module
 */
interface MadrasaStaffMetadata {
  staff_members?: StaffMember[];
  staff_categories?: StaffCategory[];
  staff_departments?: StaffDepartment[];
  staff_designations?: StaffDesignation[];
  staff_leave_requests?: StaffLeaveRequest[];
  staff_salary_records?: StaffSalaryPaymentRecord[];
  staff_id_prefix?: string;
  staff_id_serial_counter?: number;
  staff_audit_logs?: StaffAuditLogRecord[];
  [key: string]: any;
}

/**
 * Helper to sync teachers from `teachers` SQL table into staff members
 * so existing teachers are never lost and automatically appear in Staff module.
 */
async function directoryMembers(madrasaId:string,meta:MadrasaStaffMetadata):Promise<StaffMember[]> {
  // Looking at a teacher directory is not onboarding or a salary agreement.
  // Never renumber an old staff ID (it can own payroll), seed a positive salary
  // from a teacher row, or insert a new teacher while serving a read.
  const existingStaff = (meta.staff_members || []).filter(m=>!m.madrasa_id || m.madrasa_id===madrasaId);
  const staffByTeacherId=new Set(existingStaff.flatMap(m=>[m.id,m.legacy_id].filter(Boolean)));
  const admin=await createAdminClient();
  const teachers=await rows(()=>admin.from('teachers').select('id,first_name,last_name,phone,email,designation,created_at').eq('madrasa_id',madrasaId));
  const currentYear=getDhakaYear();
  for (let i = 0; i < teachers.length; i++) {
    const t = teachers[i];
    if (!staffByTeacherId.has(t.id)) {
      const code=''; // assigned only by explicit registration, under lock
      const newStaff: StaffMember = {
        id: t.id, directory_only:true,
        madrasa_id: madrasaId,
        staff_id_code: code,
        personal: {
          first_name: t.first_name || "নাম",
          last_name: t.last_name || "",
          full_name_bn: `${t.first_name || ""} ${t.last_name || ""}`.trim(),
          gender: "MALE",
          nationality: "Bangladeshi",
        },
        contact: {
          phone: t.phone || "",
          email: t.email || "",
        },
        employment: {
          staff_id_code: code,
          category_id: "cat-teaching",
          category_name: "শিক্ষক মণ্ডলী (Teaching Staff)",
          department_id: "dept-academic",
          department_name: "একাডেমিক ও পাঠদান বিভাগ",
          designation: t.designation || "সহকারী শিক্ষক (মুদাররিস)",
          joining_date: t.created_at ? toDhakaDateStringFrom(t.created_at) : toDhakaDateString(),
          employment_type: "FULL_TIME",
          status: "ACTIVE",
        },
        salary: {
          basic_salary: 0,
          allowances: { housing: 0, food: 0, transport: 0, medical: 0, other: 0 },
          deductions: { advance: 0, loan: 0, absence: 0, other: 0 },
          net_salary: 0,
          payment_method: "CASH",
        },
        leave_balance: {
          casual_allocated: 10,
          casual_used: 0,
          sick_allocated: 14,
          sick_used: 0,
          annual_allocated: 20,
          annual_used: 0,
        },
        responsibilities: ["ক্লাস পাঠদান"],
        employment_history: [
          {
            id: `hist_${Date.now()}_${i}`,
            type: "JOINED",
            new_designation: t.designation || "সহকারী শিক্ষক",
            new_department: "একাডেমিক বিভাগ",
            effective_date: t.created_at ? toDhakaDateStringFrom(t.created_at) : toDhakaDateString(),
            reason: "প্রাথমিক শিক্ষক হিসেবে যোগদান",
            created_at: new Date().toISOString(),
          },
        ],
        id_card: {
          card_number: `QM-${code}`,
          issue_date: toDhakaDateString(),
          expiry_date: `${currentYear + 2}-12-31`,
          verification_token: generateStaffVerificationToken(madrasaId, t.id),
          is_revoked: false,
        },
        created_at: t.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      existingStaff.push(newStaff);
    }
  }
  return existingStaff;
}

/** For selectors, ID cards and counts: never send contracts, payroll or HR documents. */
export async function getStaffRoster(){
  const access=await writeGuard('staffRead');
  if(!access.allowed || !access.madrasaId) return [];
  const members=await directoryMembers(access.madrasaId,await getMadrasaMetadata(access.madrasaId,true));
  const {getCurrentUserMaskingContext,maskStaffSensitiveFields}=await import('@/lib/data-access-guards');
  const {allowUnmasked}=await getCurrentUserMaskingContext('staff','phone');
  return members.map(m=>({id:m.id,first_name:m.personal.first_name || m.personal.full_name_bn || '',last_name:m.personal.last_name || '',designation:m.employment.designation,phone:maskStaffSensitiveFields({contact:m.contact},allowUnmasked).contact.phone}));
}

export async function registerTeacherStaffProfile(id:string) {
  const access=await writeGuard('staff');
  if(!access.allowed || !access.madrasaId || !access.userId) return {error:'অনুমতি নেই।'};
  try {
    const meta=await getMadrasaMetadata(access.madrasaId,true);
    const record=(await directoryMembers(access.madrasaId,meta)).find(m=>m.id===id && m.directory_only);
    if(!record) return {error:'শিক্ষকের রেকর্ড যাচাই করুন।'};
    const {error}=await (await createAdminClient()).rpc('finance_register_teacher',{t:access.madrasaId,actor:access.userId,profile:record});
    if(error) return {error:error.message};
    revalidatePath('/dashboard/staff');return {success:true};
  } catch {return {error:'প্রোফাইল তৈরি নিশ্চিত হয়নি।'};}
}

/**
 * Fetch staff dashboard aggregated statistics and overview
 */
export async function getStaffDashboardData() {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("staffRead");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) {
      return {
        stats: { total: 0, active: 0, onLeave: 0, inactive: 0, suspended: 0, resigned: 0, terminated: 0 },
        distribution: { teaching: 0, admin: 0, support: 0, management: 0, custom: 0 },
        recentActivity: [],
        pendingLeavesCount: 0,
        expiringDocumentsCount: 0,
        categories: DEFAULT_STAFF_CATEGORIES,
        departments: DEFAULT_STAFF_DEPARTMENTS,
      };
    }

    const meta = (await getMadrasaMetadata(madrasaId,true)) as MadrasaStaffMetadata;
    const members=await directoryMembers(madrasaId,meta);

    const categories: StaffCategory[] = meta.staff_categories || DEFAULT_STAFF_CATEGORIES;
    const departments: StaffDepartment[] = meta.staff_departments || DEFAULT_STAFF_DEPARTMENTS;
    const { leaves: leaveRequests } = await listStructuredStaffLeaves(
      madrasaId,
      meta.staff_leave_requests || []
    );

    // Stats
    const stats = {
      total: members.length,
      active: members.filter((m) => m.employment.status === "ACTIVE").length,
      onLeave: members.filter((m) => m.employment.status === "ON_LEAVE").length,
      inactive: members.filter((m) => m.employment.status === "INACTIVE").length,
      suspended: members.filter((m) => m.employment.status === "SUSPENDED").length,
      resigned: members.filter((m) => m.employment.status === "RESIGNED").length,
      terminated: members.filter((m) => m.employment.status === "TERMINATED").length,
    };

    // Category distribution
    const distribution = {
      teaching: members.filter((m) => isCategory(m.employment?.category_id, "teaching") && m.employment?.status === "ACTIVE").length,
      admin: members.filter((m) => isCategory(m.employment?.category_id, "admin") && m.employment?.status === "ACTIVE").length,
      support: members.filter((m) => isCategory(m.employment?.category_id, "support") && m.employment?.status === "ACTIVE").length,
      management: members.filter((m) => isCategory(m.employment?.category_id, "management") && m.employment?.status === "ACTIVE").length,
      custom: members.filter(
        (m) =>
          !isCategory(m.employment?.category_id, "teaching") &&
          !isCategory(m.employment?.category_id, "admin") &&
          !isCategory(m.employment?.category_id, "support") &&
          !isCategory(m.employment?.category_id, "management") &&
          m.employment?.status === "ACTIVE"
      ).length,
    };

    // Pending leaves
    const pendingLeavesCount = leaveRequests.filter((l) => l.status === "PENDING").length;

    // Expiring documents (within 30 days)
    const today = new Date();
    const next30Days = new Date();
    next30Days.setDate(today.getDate() + 30);
    const todayStr = toDhakaDateString(today);
    const next30Str = toDhakaDateString(next30Days);

    let expiringDocumentsCount = 0;
    members.forEach((m) => {
      (m.documents || []).forEach((doc) => {
        if (doc.expiry_date && doc.expiry_date >= todayStr && doc.expiry_date <= next30Str) {
          expiringDocumentsCount++;
        }
      });
    });

    // Recent activity log
    const recentActivity = salaryAccess(await writeGuard("staffRead"),"read") ? (meta.staff_audit_logs || []).slice(-10).reverse() : [];
    const madrasaInfo = toPublicMadrasaInfo(await getMadrasaInfo());

    return {
      stats,
      distribution,
      recentActivity,
      pendingLeavesCount,
      expiringDocumentsCount,
      categories,
      departments,
      madrasa_info: madrasaInfo,
    };
  } catch (err) {
    console.error("Error in getStaffDashboardData:", err);
    return {
      stats: { total: 0, active: 0, onLeave: 0, inactive: 0, suspended: 0, resigned: 0, terminated: 0 },
      distribution: { teaching: 0, admin: 0, support: 0, management: 0, custom: 0 },
      recentActivity: [],
      pendingLeavesCount: 0,
      expiringDocumentsCount: 0,
      categories: DEFAULT_STAFF_CATEGORIES,
      departments: DEFAULT_STAFF_DEPARTMENTS,
      madrasa_info: null,
    };
  }
}

/**
 * Fetch staff list with filters, search, and sorting
 */
export async function getStaffList(filters?: {
  status?: string;
  category_id?: string;
  department_id?: string;
  designation?: string;
  search?: string;
}) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("staffRead");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return [];

    const meta = (await getMadrasaMetadata(madrasaId,true)) as MadrasaStaffMetadata;
    const members=await directoryMembers(madrasaId,meta);

    let filtered = [...members];

    if (filters) {
      if (filters.status && filters.status !== "ALL") {
        filtered = filtered.filter((m) => m.employment.status === filters.status);
      }
      if (filters.category_id && filters.category_id !== "ALL") {
        filtered = filtered.filter((m) => m.employment.category_id === filters.category_id);
      }
      if (filters.department_id && filters.department_id !== "ALL") {
        filtered = filtered.filter((m) => m.employment.department_id === filters.department_id);
      }
      if (filters.designation && filters.designation !== "ALL") {
        filtered = filtered.filter((m) => m.employment.designation === filters.designation);
      }
      if (filters.search) {
        const q = filters.search.toLowerCase().trim();
        filtered = filtered.filter((m) => {
          const name = `${m.personal.first_name} ${m.personal.last_name} ${m.personal.full_name_bn || ""}`.toLowerCase();
          const code = (m.staff_id_code || "").toLowerCase();
          const phone = (m.contact.phone || "").toLowerCase();
          const des = (m.employment.designation || "").toLowerCase();
          const dept = (m.employment.department_name || "").toLowerCase();
          return name.includes(q) || code.includes(q) || phone.includes(q) || des.includes(q) || dept.includes(q);
        });
      }
    }

    const { getCurrentUserMaskingContext, maskStaffSensitiveFields } = await import("@/lib/data-access-guards");
    const maskingCtx = await getCurrentUserMaskingContext("staff", "phone");
    const salaryVisible=salaryAccess(await writeGuard("staffRead"),"read");
    return filtered.map(m=>maskStaffSensitiveFields(staffForView(m,salaryVisible),maskingCtx.allowUnmasked));
  } catch (err) {
    console.error("Error in getStaffList:", err);
    return [];
  }
}

/**
 * Fetch a single staff member by ID with all relations
 */
export async function getStaffMember(id: string): Promise<StaffMember | null> {
  if (!(await writeGuard('staffRead')).allowed) return null;
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return null;

    const meta = (await getMadrasaMetadata(madrasaId,true)) as MadrasaStaffMetadata;
    const members=await directoryMembers(madrasaId,meta);

    const found = members.find((m) => m.id === id);
    if (!found) return null;

    const { getCurrentUserMaskingContext, maskStaffSensitiveFields } = await import("@/lib/data-access-guards");
    const maskingCtx = await getCurrentUserMaskingContext("staff", "phone");
    return maskStaffSensitiveFields(staffForView(found,salaryAccess(await writeGuard("staffRead"),"read")),maskingCtx.allowUnmasked);
  } catch (err) {
    console.error("Error fetching staff member:", err);
    return null;
  }
}

/**
 * Create a new staff member with full validation and auto ID generation
 */
export async function createStaffMember(payload: {
  personal: StaffMember["personal"];
  contact: StaffMember["contact"];
  employment: Omit<StaffMember["employment"], "staff_id_code">;
  academic?: StaffMember["academic"];
  responsibilities?: string[];
  salary?: StaffMember["salary"];
  account?: {
    create_login: boolean;
    email?: string;
    password?: string;
    role?: "teacher" | "admin" | "staff";
  };
}) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("staff");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুমতি নেই। অনুগ্রহ করে পুনরায় লগইন করুন।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি।" };

    if (!payload.personal.first_name) {
      return { error: "কর্মীর প্রথম নাম আবশ্যক।" };
    }

    const meta = (await getMadrasaMetadata(madrasaId,true)) as MadrasaStaffMetadata;
    let existingStaff: StaffMember[] = meta.staff_members || [];

    const startingSalary=salaryTerms({basic_salary:0,net_salary:0,allowances:{},deductions:{}},payload.salary || {});
    if(payload.salary && !salaryAccess(await writeGuard('staff'),'write')) return {error:'বেতন নির্ধারণের অনুমতি নেই।'};
    const amount=salaryApprovalAmount(startingSalary);
    if(amount>0 && matchApprovalWorkflow(await listWorkflowsForMadrasa(madrasaId,true),'SALARY_CHANGE',amount)) return {error:'প্রথমে বেতন ছাড়া কর্মী নিবন্ধন করুন। তারপর বেতন চুক্তি অনুমোদনের জন্য পাঠান।'};
    // Increment serial and generate unique Staff ID without collisions
    const currentYear = getDhakaYear();
    const prefix = meta.staff_id_prefix || "STF";
    const existingCodes = new Set(existingStaff.map((s) => s.staff_id_code).filter(Boolean));
    let serial = (meta.staff_id_serial_counter || existingStaff.length || 0) + 1;
    let staffIdCode = formatStaffIdCode(prefix, currentYear, serial);
    while (existingCodes.has(staffIdCode)) {
      serial++;
      staffIdCode = formatStaffIdCode(prefix, currentYear, serial);
    }
    meta.staff_id_serial_counter = serial;
    const newStaffId = crypto.randomUUID();

    let authUserId: string | null = null;
    let authRole: "teacher" | "admin" | "staff" | "none" = "none";

    // Create auth account if requested
    if (payload.account?.create_login && payload.account.email && payload.account.password) {
      // An HR writer must not gain a financial administrator through onboarding.
      if(payload.account.role && !['teacher','staff'].includes(payload.account.role)) return {error:'প্রশাসনিক রোল ইউজার ব্যবস্থাপনা থেকে নির্ধারণ করুন।'};
      const provision=await requirePermission({userId:user.id,madrasaId,permissions:['user.create'],roles:['admin','super_admin','muhtamim'],requireStepUp:true,actionScope:'staff.create_login'});
      if(!provision.allowed) return {error:provision.error,stepUpRequired:provision.stepUpRequired,actionScope:provision.actionScope};
      const adminClient = await createAdminClient();
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email: payload.account.email,
        password: payload.account.password,
        email_confirm: true,
      });

      if (authError) {
        return { error: `লগইন অ্যাকাউন্ট তৈরিতে ত্রুটি: ${authError.message}` };
      }

      authUserId = authData.user.id;
      authRole = payload.account.role || (payload.employment.category_id === "cat-teaching" ? "teacher" : "staff");

      // Insert into users profile table
      const {error:profileError}=await adminClient.from("users").insert({
        id: authUserId,
        madrasa_id: madrasaId,
        full_name: `${payload.personal.first_name} ${payload.personal.last_name || ""}`.trim(),
        email: payload.account.email,
        role: authRole,
      });
      if(profileError) return {error:"লগইন প্রোফাইল সংরক্ষিত হয়নি। পুনরায় নিবন্ধনের আগে ইউজার ব্যবস্থাপনায় যাচাই করুন।"};
    }

    // If category is Teaching, also insert in `teachers` table for academic module compatibility
    if (isTeachingStaff(payload.employment?.category_id)) {
      const adminClient = await createAdminClient();
      const {error:teacherError}=await adminClient.from("teachers").insert({
        id: newStaffId,
        madrasa_id: madrasaId,
        first_name: payload.personal.first_name,
        last_name: payload.personal.last_name || "",
        phone: payload.contact.phone || null,
        email: payload.contact.email || null,
        designation: payload.employment.designation || "সহকারী শিক্ষক",
      });
      if(teacherError) return {error:'শিক্ষকের রেকর্ড তৈরি নিশ্চিত হয়নি। লগইন ও শিক্ষক তালিকা যাচাই করুন।'};
    }

    const categories = meta.staff_categories || DEFAULT_STAFF_CATEGORIES;
    const departments = meta.staff_departments || DEFAULT_STAFF_DEPARTMENTS;
    const isTeach = isTeachingStaff(payload.employment?.category_id);
    const catObj = categories.find((c) => c.id === payload.employment?.category_id || (isTeach && isTeachingStaff(c.id)));
    const deptObj = departments.find((d) => d.id === payload.employment?.department_id);

    const nowStr = new Date().toISOString();
    const newStaff: StaffMember = {
      id: newStaffId,
      madrasa_id: madrasaId,
      staff_id_code: staffIdCode,
      personal: {
        ...payload.personal,
        full_name_bn: payload.personal.full_name_bn || `${payload.personal.first_name} ${payload.personal.last_name || ""}`.trim(),
      },
      contact: payload.contact,
      employment: {
        ...payload.employment,
        staff_id_code: staffIdCode,
        category_name: catObj?.name || (isTeach ? "শিক্ষক মণ্ডলী (Teaching Staff)" : "সাধারণ প্রশাসন"),
        department_name: deptObj?.name || "সাধারণ প্রশাসন",
      },
      academic: payload.academic,
      responsibilities: payload.responsibilities || [],
      salary:startingSalary,
      documents: [],
      employment_history: [
        {
          id: `hist_${Date.now()}`,
          type: "JOINED",
          new_designation: payload.employment.designation,
          new_department: deptObj?.name || "বিভাগ",
          new_salary: startingSalary.basic_salary,
          effective_date: payload.employment.joining_date,
          reason: "মাদ্রাসায় নতুন কর্মী হিসেবে নিয়োগ",
          changed_by: user.email || "অ্যাডমিন",
          created_at: nowStr,
        },
      ],
      audit_logs: [
        {
          id: `audit_${Date.now()}`,
          action: "নতুন কর্মী নিবন্ধন",
          details: `${payload.personal.first_name} কে ${payload.employment.designation} হিসেবে যুক্ত করা হয়েছে।`,
          user_email: user.email || "অ্যাডমিন",
          created_at: nowStr,
        },
      ],
      auth_user_id: authUserId,
      auth_role: authRole,
      id_card: {
        card_number: `QM-${staffIdCode}`,
        issue_date: payload.employment.joining_date || toDhakaDateStringFrom(nowStr),
        expiry_date: `${currentYear + 2}-12-31`,
        verification_token: generateStaffVerificationToken(madrasaId, newStaffId),
        is_revoked: false,
      },
      leave_balance: {
        casual_allocated: 10,
        casual_used: 0,
        sick_allocated: 14,
        sick_used: 0,
        annual_allocated: 20,
        annual_used: 0,
      },
      created_at: nowStr,
      updated_at: nowStr,
    };

    existingStaff.push(newStaff);
    meta.staff_members = existingStaff;

    // Append to global madrasa staff audit log
    if (!meta.staff_audit_logs) meta.staff_audit_logs = [];
    meta.staff_audit_logs.push({
      id: `log_${Date.now()}`,
      action: "কর্মী নিয়োগ",
      details: `${newStaff.personal.first_name} ${newStaff.personal.last_name || ""} (${staffIdCode})`,
      user_email: user.email || "অ্যাডমিন",
      created_at: nowStr,
    });

    if(!await saveMadrasaMetadata(madrasaId,meta)) return {error:"কর্মীর প্রোফাইল সংরক্ষণ নিশ্চিত হয়নি। লগইন বা শিক্ষক রেকর্ড যাচাই করুন।"};

    revalidatePath("/dashboard/teachers");
    revalidatePath("/dashboard/staff");
    return { success: true, staffId: newStaffId, staffIdCode };
  } catch (err: any) {
    console.error("Error creating staff member:", err);
    return { error: err.message || "কর্মী তৈরিতে ত্রুটি ঘটেছে।" };
  }
}

export async function updateStaffMember(id:string,payload:StaffEdit) {return editStaff(id,payload);}
export async function promoteStaffMember(payload:StaffPromotion) {return promoteStaff(payload);}

/**
 * Transfer Staff (Change Department with History)
 */
export async function transferStaffMember(payload: {
  staffId: string;
  newDepartmentId: string;
  newDepartmentName: string;
  effectiveDate: string;
  reason: string;
  remarks?: string;
}) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("staff");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুমতি নেই।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি।" };

    const meta = (await getMadrasaMetadata(madrasaId)) as MadrasaStaffMetadata;
    let existingStaff: StaffMember[] = meta.staff_members || [];

    const index = existingStaff.findIndex((s) => s.id === payload.staffId);
    if (index === -1) return { error: "কর্মী পাওয়া যায়নি।" };

    const current = existingStaff[index];
    const prevDept = current.employment.department_name;
    const nowStr = new Date().toISOString();

    const historyRecord: StaffEmploymentHistoryRecord = {
      id: `hist_${Date.now()}`,
      type: "TRANSFER",
      previous_department: prevDept,
      new_department: payload.newDepartmentName,
      effective_date: payload.effectiveDate,
      reason: payload.reason,
      remarks: payload.remarks,
      changed_by: user.email || "অ্যাডমিন",
      created_at: nowStr,
    };

    if (!current.employment_history) current.employment_history = [];
    current.employment_history.unshift(historyRecord);

    current.employment.department_id = payload.newDepartmentId;
    current.employment.department_name = payload.newDepartmentName;
    current.updated_at = nowStr;

    if (!current.audit_logs) current.audit_logs = [];
    current.audit_logs.push({
      id: `audit_${Date.now()}`,
      action: "বিভাগ বদলি / স্থানান্তর",
      details: `${prevDept} থেকে ${payload.newDepartmentName} বিভাগে বদলি`,
      user_email: user.email || "অ্যাডমিন",
      created_at: nowStr,
    });

    existingStaff[index] = current;
    meta.staff_members = existingStaff;
    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath("/dashboard/teachers");
    revalidatePath(`/dashboard/teachers/${payload.staffId}`);
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "স্থানান্তর সম্পন্ন করতে সমস্যা হয়েছে।" };
  }
}

/**
 * Change Staff Status (Active, On Leave, Inactive, Suspended, Resigned, Terminated, Reactivated)
 */
export async function changeStaffStatus(payload: {
  staffId: string;
  status: StaffStatus;
  effectiveDate: string;
  reason: string;
  remarks?: string;
}) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("staff");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুমতি নেই।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি।" };

    const meta = (await getMadrasaMetadata(madrasaId)) as MadrasaStaffMetadata;
    let existingStaff: StaffMember[] = meta.staff_members || [];

    const index = existingStaff.findIndex((s) => s.id === payload.staffId);
    if (index === -1) return { error: "কর্মী পাওয়া যায়নি।" };

    const current = existingStaff[index];
    const prevStatus = current.employment.status;
    const nowStr = new Date().toISOString();

    let histType: StaffEmploymentHistoryRecord["type"] = "STATUS_CHANGE";
    if (payload.status === "RESIGNED") histType = "RESIGNATION";
    else if (payload.status === "TERMINATED") histType = "TERMINATION";
    else if (payload.status === "ACTIVE" && ["INACTIVE", "SUSPENDED", "RESIGNED", "TERMINATED"].includes(prevStatus)) {
      histType = "REACTIVATED";
    }

    const historyRecord: StaffEmploymentHistoryRecord = {
      id: `hist_${Date.now()}`,
      type: histType,
      previous_status: prevStatus,
      new_status: payload.status,
      effective_date: payload.effectiveDate,
      reason: payload.reason,
      remarks: payload.remarks,
      changed_by: user.email || "অ্যাডমিন",
      created_at: nowStr,
    };

    if (!current.employment_history) current.employment_history = [];
    current.employment_history.unshift(historyRecord);

    current.employment.status = payload.status;
    if (payload.status === "RESIGNED") {
      current.employment.resignation_date = payload.effectiveDate;
      current.employment.exit_reason = payload.reason;
    } else if (payload.status === "TERMINATED") {
      current.employment.termination_date = payload.effectiveDate;
      current.employment.exit_reason = payload.reason;
    }

    // If terminated or resigned, set ID card to revoked
    if (["TERMINATED", "RESIGNED", "INACTIVE", "SUSPENDED"].includes(payload.status) && current.id_card) {
      current.id_card.is_revoked = payload.status === "TERMINATED" || payload.status === "RESIGNED";
    }

    if (!current.audit_logs) current.audit_logs = [];
    current.audit_logs.push({
      id: `audit_${Date.now()}`,
      action: `স্ট্যাটাস পরিবর্তন: ${payload.status}`,
      details: payload.reason,
      user_email: user.email || "অ্যাডমিন",
      created_at: nowStr,
    });

    current.updated_at = nowStr;
    existingStaff[index] = current;
    meta.staff_members = existingStaff;

    if (!meta.staff_audit_logs) meta.staff_audit_logs = [];
    meta.staff_audit_logs.push({
      id: `log_${Date.now()}`,
      action: `স্ট্যাটাস: ${payload.status}`,
      details: `${current.personal.first_name}: ${payload.reason}`,
      user_email: user.email || "অ্যাডমিন",
      created_at: nowStr,
    });

    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath("/dashboard/teachers");
    revalidatePath(`/dashboard/teachers/${payload.staffId}`);
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "স্ট্যাটাস পরিবর্তন ব্যর্থ হয়েছে।" };
  }
}

/**
 * Submit Staff Leave Request
 */
export async function submitStaffLeaveRequest(payload: {
  staffId: string;
  leaveType: StaffLeaveRequest["leave_type"];
  leaveTypeNameBn: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
}) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  const __authz = await writeGuard("staff");
  if (!__authz.allowed) return __authz.fallback;

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুমতি নেই।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি।" };

    const meta = (await getMadrasaMetadata(madrasaId)) as MadrasaStaffMetadata;
    const staff = (meta.staff_members || []).find((s) => s.id === payload.staffId);
    if (!staff) return { error: "কর্মী পাওয়া যায়নি।" };

    const leaveReq: StaffLeaveRequest = {
      id: `leave_${Date.now()}`,
      madrasa_id: madrasaId,
      staff_id: staff.id,
      staff_name: `${staff.personal.first_name} ${staff.personal.last_name || ""}`.trim(),
      staff_id_code: staff.staff_id_code,
      leave_type: payload.leaveType,
      leave_type_name_bn: payload.leaveTypeNameBn,
      start_date: payload.startDate,
      end_date: payload.endDate,
      total_days: payload.totalDays,
      reason: payload.reason,
      status: "PENDING",
      created_at: new Date().toISOString(),
    };

    // 1.2 Write to relational staff_leave_requests table first (no JSON race condition)
    const sqlRes = await upsertStructuredStaffLeave(leaveReq);
    if (!sqlRes.ok) {
      if (!meta.staff_leave_requests) meta.staff_leave_requests = [];
      meta.staff_leave_requests.unshift(leaveReq);
      await saveMadrasaMetadata(madrasaId, meta);
    }

    await __authz.logAudit({
      action: "STAFF_LEAVE_REQUESTED",
      entityType: "staff_leave_request",
      entityId: leaveReq.id,
      entityLabel: `${leaveReq.staff_name} (${leaveReq.leave_type_name_bn})`,
      summary: `${leaveReq.staff_name}-এর ${leaveReq.total_days} দিনের ${leaveReq.leave_type_name_bn} আবেদন জমা দেওয়া হয়েছে (${leaveReq.start_date} থেকে ${leaveReq.end_date})।`,
      newValue: leaveReq,
      metadata: { storage: sqlRes.storage },
      severity: "INFO",
    });

    revalidatePath("/dashboard/teachers");
    revalidatePath(`/dashboard/teachers/${payload.staffId}`);
    return { success: true, leaveRequest: leaveReq };
  } catch (err: any) {
    return { error: err.message || "ছুটির আবেদন জমা দিতে সমস্যা হয়েছে।" };
  }
}

/**
 * Review Staff Leave Request (Approve or Reject)
 */
export async function reviewStaffLeaveRequest(payload: {
  requestId: string;
  status: "APPROVED" | "REJECTED";
  reviewReason?: string;
}) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  const __authz = await writeGuard("staff");
  if (!__authz.allowed) return __authz.fallback;

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুমতি নেই।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি।" };

    const meta = (await getMadrasaMetadata(madrasaId)) as MadrasaStaffMetadata;
    const { leaves: allLeaves } = await listStructuredStaffLeaves(
      madrasaId,
      meta.staff_leave_requests || []
    );

    const req = allLeaves.find((l) => l.id === payload.requestId);
    if (!req) return { error: "আবেদন পাওয়া যায়নি।" };

    const prevStatus = req.status;
    const nowStr = new Date().toISOString();

    const updatedReq: StaffLeaveRequest = {
      ...req,
      status: payload.status,
      reviewed_by: user.email || "অ্যাডমিন",
      review_reason: payload.reviewReason || "",
      reviewed_at: nowStr,
    };

    // 1.2 Persist update to relational staff_leave_requests table first
    const sqlRes = await upsertStructuredStaffLeave(updatedReq, user.id);

    // Keep legacy metadata updated if record existed there or if SQL table isn't created yet
    const legacyLeaves = meta.staff_leave_requests || [];
    const legacyIdx = legacyLeaves.findIndex((l) => l.id === payload.requestId);
    if (legacyIdx !== -1) {
      legacyLeaves[legacyIdx] = updatedReq;
      meta.staff_leave_requests = legacyLeaves;
    } else if (!sqlRes.ok) {
      meta.staff_leave_requests = [updatedReq, ...legacyLeaves];
    }

    // If approved, update staff's leave balance and audit log
    if (payload.status === "APPROVED") {
      const staffList = meta.staff_members || [];
      const sIndex = staffList.findIndex((s) => s.id === req.staff_id);
      if (sIndex !== -1) {
        const staff = staffList[sIndex];
        if (!staff.leave_balance) {
          staff.leave_balance = {
            casual_allocated: 10,
            casual_used: 0,
            sick_allocated: 14,
            sick_used: 0,
            annual_allocated: 20,
            annual_used: 0,
          };
        }

        if (req.leave_type === "CASUAL") staff.leave_balance.casual_used += req.total_days;
        else if (req.leave_type === "SICK") staff.leave_balance.sick_used += req.total_days;
        else if (req.leave_type === "ANNUAL") staff.leave_balance.annual_used += req.total_days;

        // Check if currently on leave today
        const todayStr = toDhakaDateString();
        if (req.start_date <= todayStr && req.end_date >= todayStr) {
          staff.employment.status = "ON_LEAVE";
        }

        if (!staff.audit_logs) staff.audit_logs = [];
        staff.audit_logs.push({
          id: `audit_${Date.now()}`,
          action: "ছুটি অনুমোদন",
          details: `${req.leave_type_name_bn} (${req.total_days} দিন)`,
          user_email: user.email || "অ্যাডমিন",
          created_at: nowStr,
        });

        staffList[sIndex] = staff;
        meta.staff_members = staffList;
      }
    }

    if (payload.status === "APPROVED" || legacyIdx !== -1 || !sqlRes.ok) {
      await saveMadrasaMetadata(madrasaId, meta);
    }

    await __authz.logAudit({
      action: payload.status === "APPROVED" ? "STAFF_LEAVE_APPROVED" : "STAFF_LEAVE_REJECTED",
      entityType: "staff_leave_request",
      entityId: req.id,
      entityLabel: `${req.staff_name} (${req.leave_type_name_bn})`,
      summary: `${req.staff_name}-এর ${req.total_days} দিনের ছুটির আবেদন ${payload.status === "APPROVED" ? "অনুমোদন" : "প্রত্যাখ্যান"} করা হয়েছে।`,
      oldValue: { status: prevStatus },
      newValue: { status: payload.status, review_reason: payload.reviewReason || "" },
      metadata: { storage: sqlRes.storage },
      severity: "INFO",
    });

    revalidatePath("/dashboard/teachers");
    revalidatePath(`/dashboard/teachers/${req.staff_id}`);
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "ছুটি পর্যালোচনায় ত্রুটি হয়েছে।" };
  }
}

/**
 * Generate Monthly Payroll Sheet for all active staff
 */
export async function generateMonthlyPayroll(month: string, year: string) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("staff");
    if (!salaryAccess(__authz,"write")) return {error:"বেতন ব্যবস্থাপনার অনুমতি নেই।"};
  }

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুমতি নেই।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি।" };

    if (!/^(0?[1-9]|1[0-2])$/.test(month) || !/^\d{4}$/.test(year)) return {error:"মাস ও বছর সঠিক নয়।"};
    month=month.padStart(2,"0");
    const meta = (await getMadrasaMetadata(madrasaId,true)) as MadrasaStaffMetadata;
    const members = (meta.staff_members || []).filter(m=>!m.directory_only && (!m.madrasa_id || m.madrasa_id===madrasaId));

    const activeStaff = members.filter((m) => ["ACTIVE", "ON_LEAVE"].includes(m.employment.status));
    const salaryRecords = meta.staff_salary_records || [], additions:StaffSalaryPaymentRecord[]=[];

    let generatedCount = 0;
    const nowStr = new Date().toISOString();

    for (const staff of activeStaff) {
      const exists = salaryRecords.some(
        (r) => (r.staff_id === staff.id || (staff.legacy_id && r.staff_id===staff.legacy_id)) && Number(r.month) === Number(month) && String(r.year) === year
      );

      if (!exists) {
        const contract=salaryTerms(staff.salary,{});
        if(contract.net_salary===0) continue;
        if(Number(staff.salary.net_salary)!==contract.net_salary) return {error:'পুরোনো বেতনের যোগফল মেলেনি। চুক্তি যাচাই করুন।'};
        const sum=(v:object)=>Object.values(v).reduce<number>((a,b)=>a+Math.round(Number(b)*100),0)/100;
        const basic=contract.basic_salary,totAllow=sum(contract.allowances),totDeduct=sum(contract.deductions);
        const newRecord: StaffSalaryPaymentRecord = {
          id: `sal_${staff.id}_${year}_${month}`,
          madrasa_id: madrasaId,
          staff_id: staff.id,
          staff_name: `${staff.personal.first_name} ${staff.personal.last_name || ""}`.trim(),
          staff_id_code: staff.staff_id_code,
          designation: staff.employment.designation,
          department: staff.employment.department_name || "বিভাগ",
          month: month,
          year: year,
          basic_salary: basic,
          allowances: totAllow,
          deductions: totDeduct,
          net_salary: contract.net_salary,
          status: "PENDING",
          created_at: nowStr,
        };

        additions.push(newRecord);
        generatedCount++;
      }
    }

    if(additions.length){
      const {error}=await (await createAdminClient()).rpc('finance_draft_payroll',{t:madrasaId,actor:user.id,staff_before:meta.staff_members || [],payroll_before:salaryRecords,additions});
      if(error) return {error:'পেরোল সংরক্ষণ হয়নি। বর্তমান চুক্তি ও মাসের পেরোল যাচাই করুন।'};
    }

    revalidatePath("/dashboard/teachers");
    return { success: true, count: generatedCount };
  } catch (err: any) {
    return { error: err.message || "পেরোল তৈরি করতে সমস্যা হয়েছে।" };
  }
}

/**
 * Process Salary Payment (Mark as Paid and link into Madrasa Accounting Expenses)
 */
export async function processSalaryPayment(payload: {
  recordId: string;
  paymentMethod: string;
  transactionRef?: string;
  remarks?: string;
}) {
  const guard = await writeGuard("staff");
  if (!guard.allowed) return guard.fallback;
  if(!salaryAccess(guard,"write")) return {error:"বেতন পরিশোধের অনুমতি নেই।"};
  if (!guard.madrasaId || !guard.userId) return { error: "প্রতিষ্ঠান বা ব্যবহারকারী পাওয়া যায়নি।" };
  try {
    const db = await createAdminClient();
    const {data,error} = await db.rpc("finance_pay_salary", {
      p_tenant: guard.madrasaId, p_actor: guard.userId, p_record: payload.recordId,p_register:true,
      p_method: payload.paymentMethod, p_ref: payload.transactionRef || "", p_remarks: payload.remarks || "",
    });
    if (error || !data?.expense_id) return { error: error ? postingError(error) : "বেতন ভাউচার নিশ্চিত হয়নি।" };
    for (const path of ["/dashboard/staff", "/dashboard/teachers", "/dashboard/accounting", "/dashboard/accounting/expenses", "/dashboard/accounting/reports"]) revalidatePath(path);
    return { success: true, expenseId: data.expense_id, alreadyPaid: data.already_paid };
  } catch (err: any) {
    return { error: err.message || "বেতন পরিশোধ নিশ্চিত হয়নি।" };
  }
}

/**
 * Upload / Add Staff Document
 */
export async function addStaffDocument(payload: {
  staffId: string;
  title: string;
  documentType: "NID" | "CERTIFICATE" | "EXPERIENCE" | "APPOINTMENT_LETTER" | "CONTRACT" | "PHOTO" | "OTHER";
  fileUrl: string;
  fileName?: string;
  issueDate?: string;
  expiryDate?: string;
  notes?: string;
}) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("staff");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুমতি নেই।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি।" };

    const meta = (await getMadrasaMetadata(madrasaId)) as MadrasaStaffMetadata;
    let staffList = meta.staff_members || [];

    const index = staffList.findIndex((s) => s.id === payload.staffId);
    if (index === -1) return { error: "কর্মী পাওয়া যায়নি।" };

    const staff = staffList[index];
    const nowStr = new Date().toISOString();

    const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newDoc = {
      id: docId,
      title: payload.title,
      document_type: payload.documentType,
      file_url: payload.fileUrl,
      file_name: payload.fileName || payload.title,
      issue_date: payload.issueDate,
      expiry_date: payload.expiryDate,
      uploaded_at: nowStr,
      notes: payload.notes,
    };

    if (!staff.documents) staff.documents = [];
    staff.documents.unshift(newDoc);

    if (!staff.audit_logs) staff.audit_logs = [];
    staff.audit_logs.push({
      id: `audit_${Date.now()}`,
      action: "ডকুমেন্ট আপলোড",
      details: `${payload.title} (${payload.documentType})`,
      user_email: user.email || "অ্যাডমিন",
      created_at: nowStr,
    });

    staffList[index] = staff;
    meta.staff_members = staffList;
    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath(`/dashboard/teachers/${payload.staffId}`);
    return { success: true, document: newDoc };
  } catch (err: any) {
    return { error: err.message || "ডকুমেন্ট সংরক্ষণ ব্যর্থ হয়েছে।" };
  }
}

/**
 * Delete Staff Document
 */
export async function deleteStaffDocument(staffId: string, documentId: string) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("staff");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুমতি নেই।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি।" };

    const meta = (await getMadrasaMetadata(madrasaId)) as MadrasaStaffMetadata;
    let staffList = meta.staff_members || [];

    const index = staffList.findIndex((s) => s.id === staffId);
    if (index === -1) return { error: "কর্মী পাওয়া যায়নি।" };

    const staff = staffList[index];
    staff.documents = (staff.documents || []).filter((d) => d.id !== documentId);

    staffList[index] = staff;
    meta.staff_members = staffList;
    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath(`/dashboard/teachers/${staffId}`);
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "ডকুমেন্ট মুছে ফেলতে সমস্যা হয়েছে।" };
  }
}

/**
 * Generate or Reissue Digital Staff ID Card
 */
export async function generateStaffIdCard(staffId: string) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("staff");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুমতি নেই।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি।" };

    const meta = (await getMadrasaMetadata(madrasaId)) as MadrasaStaffMetadata;
    let staffList = meta.staff_members || [];

    const index = staffList.findIndex((s) => s.id === staffId);
    if (index === -1) return { error: "কর্মী পাওয়া যায়নি।" };

    const staff = staffList[index];
    const currentYear = getDhakaYear();
    const token = generateStaffVerificationToken(madrasaId, staffId);

    staff.id_card = {
      card_number: `QM-${staff.staff_id_code}`,
      issue_date: toDhakaDateString(),
      expiry_date: `${currentYear + 2}-12-31`,
      verification_token: token,
      is_revoked: false,
    };

    const nowStr = new Date().toISOString();
    if (!staff.audit_logs) staff.audit_logs = [];
    staff.audit_logs.push({
      id: `audit_${Date.now()}`,
      action: "ডিজিটাল আইডি কার্ড তৈরি / রি-ইস্যু",
      details: `কার্ড নম্বর: QM-${staff.staff_id_code}`,
      user_email: user.email || "অ্যাডমিন",
      created_at: nowStr,
    });

    staffList[index] = staff;
    meta.staff_members = staffList;
    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath(`/dashboard/teachers/${staffId}`);
    return { success: true, idCard: staff.id_card };
  } catch (err: any) {
    return { error: err.message || "আইডি কার্ড তৈরি করতে সমস্যা হয়েছে।" };
  }
}

/**
 * Public Safe Verification of Staff ID QR Code
 */
export async function verifyStaffQrToken(token: string) {
  try {
    const adminClient = await createAdminClient();
    const { data: madrasas, error } = await adminClient.from("madrasas").select("id, name, registration_no");

    if (error || !madrasas) {
      return { status: "NOT_FOUND", message: "ভেরিফিকেশন রেকর্ড পাওয়া যায়নি।" };
    }

    for (const m of madrasas) {
      if (m.registration_no && m.registration_no.startsWith("{")) {
        try {
          const parsed = JSON.parse(m.registration_no);
          const staffList: StaffMember[] = parsed.staff_members || [];
          const matched = staffList.find((s) => s.id_card?.verification_token === token);

          if (matched) {
            let cardStatus: "VERIFIED" | "INACTIVE" | "REVOKED" = "VERIFIED";
            if (matched.id_card?.is_revoked || matched.employment.status === "TERMINATED") {
              cardStatus = "REVOKED";
            } else if (matched.employment.status === "INACTIVE" || matched.employment.status === "RESIGNED") {
              cardStatus = "INACTIVE";
            }

            return {
              status: cardStatus,
              staff: {
                name: `${matched.personal.first_name} ${matched.personal.last_name || ""}`.trim(),
                name_bn: matched.personal.full_name_bn,
                designation: matched.employment.designation,
                department: matched.employment.department_name,
                staff_id: matched.staff_id_code,
                card_number: matched.id_card?.card_number,
                madrasa_name: m.name,
                issue_date: matched.id_card?.issue_date,
                expiry_date: matched.id_card?.expiry_date,
                photo_url: matched.personal.photo_url,
              },
            };
          }
        } catch {
          // continue
        }
      }
    }

    return { status: "INVALID", message: "অকার্যকর বা অননুমোদিত কিউআর কোড।" };
  } catch (err: any) {
    return { status: "ERROR", message: "ভেরিফিকেশন সার্ভার ত্রুটি।" };
  }
}

/**
 * Configure Custom Categories, Departments, Designations & ID Prefix
 */
export async function updateStaffSettings(payload: {
  categories?: StaffCategory[];
  departments?: StaffDepartment[];
  designations?: StaffDesignation[];
  idPrefix?: string;
}) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("staff");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুমতি নেই।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি।" };

    const meta = (await getMadrasaMetadata(madrasaId)) as MadrasaStaffMetadata;

    if (payload.categories) meta.staff_categories = payload.categories;
    if (payload.departments) meta.staff_departments = payload.departments;
    if (payload.designations) meta.staff_designations = payload.designations;
    if (payload.idPrefix) meta.staff_id_prefix = payload.idPrefix;

    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath("/dashboard/teachers");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "সেটিংস সংরক্ষণ ব্যর্থ হয়েছে।" };
  }
}

/**
 * Fetch all staff metadata for the current user's madrasa
 */
export async function getStaffMetadataFull() {
  const access=await writeGuard('staffRead');
  if(!access.allowed || !access.madrasaId) throw Error('কর্মীর প্রোফাইল দেখার অনুমতি নেই।');
  const madrasaId=access.madrasaId, madrasaInfo=toPublicMadrasaInfo(await getMadrasaInfo(madrasaId));
  const meta = (await getMadrasaMetadata(madrasaId,true)) as MadrasaStaffMetadata;
  const members=await directoryMembers(madrasaId,meta);
  const salaryVisible=salaryAccess(access,"read"),salaryEditable=salaryAccess(access,"write");
  const {getCurrentUserMaskingContext,maskStaffSensitiveFields}=await import('@/lib/data-access-guards');
  const {allowUnmasked}=await getCurrentUserMaskingContext('staff','phone');
  const leaveRequestsRes = await listStructuredStaffLeaves(
    madrasaId,
    meta.staff_leave_requests || []
  );

  return {
    salaryVisible,salaryEditable,staff_members:members.map(m=>maskStaffSensitiveFields(staffForView(m,salaryVisible),allowUnmasked)),
    categories: meta.staff_categories && meta.staff_categories.length > 0 ? meta.staff_categories : DEFAULT_STAFF_CATEGORIES,
    departments: meta.staff_departments && meta.staff_departments.length > 0 ? meta.staff_departments : DEFAULT_STAFF_DEPARTMENTS,
    designations: meta.staff_designations && meta.staff_designations.length > 0 ? meta.staff_designations : DEFAULT_STAFF_DESIGNATIONS,
    leave_requests: leaveRequestsRes.leaves,
    salary_records: salaryVisible ? (meta.staff_salary_records || []).filter(r=>!r.madrasa_id || r.madrasa_id===madrasaId).map(r=>allowUnmasked ? r : {...r,transaction_ref:undefined,remarks:undefined}) : [],
    madrasa_info: madrasaInfo,
  };
}

export async function addStaffDepartment(name: string, nameEn?: string) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("staff");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুমতি নেই।" };
    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি।" };

    const meta = (await getMadrasaMetadata(madrasaId)) as MadrasaStaffMetadata;
    const depts = meta.staff_departments || DEFAULT_STAFF_DEPARTMENTS;
    const newDept: StaffDepartment = {
      id: `dept_${Date.now()}`,
      name,
      name_en: nameEn || name,
      code: `DEPT-${depts.length + 1}`,
    };
    meta.staff_departments = [...depts, newDept];
    await saveMadrasaMetadata(madrasaId, meta);
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "বিভাগ যোগ করা যায়নি।" };
  }
}

export async function deleteStaffDepartment(deptId: string) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("staff");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুমতি নেই।" };
    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি।" };

    const meta = (await getMadrasaMetadata(madrasaId)) as MadrasaStaffMetadata;
    const depts = meta.staff_departments || DEFAULT_STAFF_DEPARTMENTS;
    meta.staff_departments = depts.filter((d) => d.id !== deptId);
    await saveMadrasaMetadata(madrasaId, meta);
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "বিভাগ মুছে ফেলা যায়নি।" };
  }
}

export async function addStaffDesignation(name: string, departmentId?: string, nameEn?: string) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("staff");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুমতি নেই।" };
    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি।" };

    const meta = (await getMadrasaMetadata(madrasaId)) as MadrasaStaffMetadata;
    const designations = meta.staff_designations || DEFAULT_STAFF_DESIGNATIONS;
    const depts = meta.staff_departments || DEFAULT_STAFF_DEPARTMENTS;
    const dept = depts.find((d) => d.id === departmentId);

    let derivedCat = "cat-teaching";
    if (dept) {
      if (dept.id === "dept-academic" || dept.code === "academic") derivedCat = "cat-teaching";
      else if (dept.id === "dept-admin" || dept.id === "dept-accounts" || dept.code === "admin" || dept.code === "accounts") derivedCat = "cat-admin";
      else if (dept.id === "dept-library" || dept.id === "dept-hostel" || dept.id === "dept-maintenance" || dept.code === "library" || dept.code === "hostel" || dept.code === "maintenance") derivedCat = "cat-support";
      else derivedCat = "cat-management";
    }

    const newDes: StaffDesignation = {
      id: `des_${Date.now()}`,
      name,
      category_id: derivedCat,
      department_id: departmentId,
    };
    meta.staff_designations = [...designations, newDes];
    await saveMadrasaMetadata(madrasaId, meta);
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "পদবী যোগ করা যায়নি।" };
  }
}

export async function deleteStaffDesignation(desId: string) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("staff");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুমতি নেই।" };
    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি।" };

    const meta = (await getMadrasaMetadata(madrasaId)) as MadrasaStaffMetadata;
    const designations = meta.staff_designations || DEFAULT_STAFF_DESIGNATIONS;
    meta.staff_designations = designations.filter((d) => d.id !== desId);
    await saveMadrasaMetadata(madrasaId, meta);
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "পদবী মুছে ফেলা যায়নি।" };
  }
}

export async function addStaffCategory(name: string, code: any = "custom", nameEn?: string) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("staff");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুমতি নেই।" };
    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি।" };

    const meta = (await getMadrasaMetadata(madrasaId)) as MadrasaStaffMetadata;
    const cats = meta.staff_categories || DEFAULT_STAFF_CATEGORIES;
    const newCat: StaffCategory = {
      id: `cat_${Date.now()}`,
      name,
      name_en: nameEn || name,
      code: code || "custom",
    };
    meta.staff_categories = [...cats, newCat];
    await saveMadrasaMetadata(madrasaId, meta);
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "ক্যাটাগরি যোগ করা যায়নি।" };
  }
}

export async function deleteStaffCategory(catId: string) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("staff");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুমতি নেই।" };
    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি।" };

    const meta = (await getMadrasaMetadata(madrasaId)) as MadrasaStaffMetadata;
    const cats = meta.staff_categories || DEFAULT_STAFF_CATEGORIES;
    meta.staff_categories = cats.filter((c) => c.id !== catId);
    await saveMadrasaMetadata(madrasaId, meta);
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "ক্যাটাগরি মুছে ফেলা যায়নি।" };
  }
}

/**
 * Permanently delete a teacher or staff member from both metadata and SQL tables with full safety checks
 */
export async function deleteStaffMember(staffId: string) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  const __authz = await writeGuard("staff");
  if (!__authz.allowed) return __authz.fallback;

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস। অনুগ্রহ করে লগইন করুন।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি।" };

    const adminClient = await createAdminClient();

    // 1. Fetch metadata
    const meta = (await getMadrasaMetadata(madrasaId)) as MadrasaStaffMetadata;
    const staffMembers = meta.staff_members || [];

    const targetStaff = staffMembers.find((s) => s.id === staffId || (s as any).legacy_id === staffId);
    if (!targetStaff || (meta.staff_salary_records || []).some(r=>[targetStaff.id,(targetStaff as any).legacy_id].includes(r.staff_id) && (r.status==='PAID' || r.expense_id || r.finance_drafted))) return {error:"পেরোলসহ কর্মী মুছবেন না। আর্কাইভ করুন।"};
    const targetEmail = targetStaff?.contact?.email?.trim();

    // 2. Remove from staff_members array in metadata
    meta.staff_members = staffMembers.filter((s) => s.id !== staffId && (s as any).legacy_id !== staffId);

    // Clean up associated leave requests or salary records
    if (meta.staff_leave_requests) {
      meta.staff_leave_requests = meta.staff_leave_requests.filter((l) => l.staff_id !== staffId);
    }
    if (meta.staff_salary_records) {
      meta.staff_salary_records = meta.staff_salary_records.filter((r) => r.staff_id !== staffId);
    }

    // Also delete associated leave requests from structured SQL table

    // Add Audit Log
    const auditLogs = meta.staff_audit_logs || [];
    auditLogs.unshift({
      id: `log_${Date.now()}`,
      action: "DELETE_STAFF",
      details: `${targetStaff?.personal?.full_name_bn || targetStaff?.personal?.first_name || "স্টাফ"} সদস্যকে ডাটাবেজ থেকে মুছে ফেলা হয়েছে।`,
      user_email: user.email || "অ্যাডমিন",
      created_at: new Date().toISOString(),
    });
    meta.staff_audit_logs = auditLogs.slice(0, 50);

    if (!await saveMadrasaMetadata(madrasaId,meta)) return {error:"রেকর্ড বদলেছে। রিফ্রেশ করুন।"};
    await deleteStructuredStaffLeavesForStaff(madrasaId, staffId);

    // 3. Delete from SQL `teachers` table
    try {
      await adminClient
        .from("teachers")
        .delete()
        .eq("id", staffId).eq("madrasa_id",madrasaId);

      if (targetEmail) {
        await adminClient
          .from("teachers")
          .delete()
          .eq("email", targetEmail)
          .eq("madrasa_id", madrasaId);
      }
    } catch (sqlErr) {
      console.warn("SQL teachers table delete error:", sqlErr);
    }

    // 4. Delete from `teacher_subjects` table
    try {
      await adminClient
        .from("teacher_subjects")
        .delete()
        .eq("teacher_id", staffId);
    } catch (subErr) {
      console.warn("Teacher subjects delete error:", subErr);
    }

    const staffName =
      targetStaff?.personal?.full_name_bn ||
      targetStaff?.personal?.first_name ||
      "স্টাফ";
    await __authz.logAudit({
      module: "staff",
      action: "STAFF_DELETED",
      entityType: "staff",
      entityId: staffId,
      entityLabel: staffName,
      summary: `${staffName} (স্টাফ/শিক্ষক) সদস্যকে ডাটাবেজ থেকে মুছে ফেলা হয়েছে।`,
      oldValue: targetStaff
        ? {
            id: targetStaff.id,
            name: staffName,
            email: targetEmail || null,
            designation: targetStaff.employment?.designation || null,
            department_id: targetStaff.employment?.department_id || null,
          }
        : { id: staffId },
      severity: "CRITICAL",
    });

    revalidatePath("/dashboard/staff");
    revalidatePath("/dashboard/teachers");

    return {
      success: true,
      message: `${targetStaff?.personal?.full_name_bn || targetStaff?.personal?.first_name || "শিক্ষক/স্টাফ"} সদস্যকে সফলভাবে মুছে ফেলা হয়েছে।`,
    };
  } catch (err: any) {
    console.error("Catch in deleteStaffMember:", err);
    return { error: err.message || "স্টাফ সদস্য মুছে ফেলতে সমস্যা হয়েছে।" };
  }
}

