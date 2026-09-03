"use server";

import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "@/app/actions/students";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";
import { getMadrasaInfo } from "@/lib/getMadrasaInfo";
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
async function syncAndGetStaffMembers(
  supabase: any,
  madrasaId: string,
  meta: MadrasaStaffMetadata
): Promise<{ members: StaffMember[]; isModified: boolean }> {
  let existingStaff: StaffMember[] = meta.staff_members || [];
  let isModified = false;

  // Fetch all teachers from SQL table
  const { data: teachers, error: teachersError } = await supabase
    .from("teachers")
    .select("*")
    .eq("madrasa_id", madrasaId)
    .order("created_at", { ascending: true });

  if (teachersError || !teachers) {
    return { members: existingStaff, isModified: false };
  }

  const staffByTeacherId = new Map<string, StaffMember>();
  const staffByStaffCode = new Set<string>();

  existingStaff.forEach((s) => {
    // Normalize category_id if missing or using old underscore format
    if (!s.employment?.category_id || s.employment.category_id === "cat_teaching") {
      if (!s.employment) (s as any).employment = {};
      s.employment.category_id = "cat-teaching";
      s.employment.category_name = s.employment.category_name || "শিক্ষক মণ্ডলী (Teaching Staff)";
      isModified = true;
    } else if (s.employment.category_id === "cat_admin") {
      s.employment.category_id = "cat-admin";
      isModified = true;
    } else if (s.employment.category_id === "cat_support") {
      s.employment.category_id = "cat-support";
      isModified = true;
    } else if (s.employment.category_id === "cat_management") {
      s.employment.category_id = "cat-management";
      isModified = true;
    }
    staffByTeacherId.set(s.id, s);
    if (s.staff_id_code) staffByStaffCode.add(s.staff_id_code);
  });

  // Calculate current max serial
  let serialCounter = meta.staff_id_serial_counter || existingStaff.length || 0;
  const currentYear = new Date().getFullYear();

  for (let i = 0; i < teachers.length; i++) {
    const t = teachers[i];
    if (!staffByTeacherId.has(t.id)) {
      serialCounter++;
      const code = formatStaffIdCode(meta.staff_id_prefix || "STF", currentYear, serialCounter);

      const newStaff: StaffMember = {
        id: t.id,
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
          joining_date: t.created_at ? t.created_at.split("T")[0] : new Date().toISOString().split("T")[0],
          employment_type: "FULL_TIME",
          status: "ACTIVE",
        },
        salary: {
          basic_salary: 15000,
          allowances: { housing: 0, food: 0, transport: 0, medical: 0, other: 0 },
          deductions: { advance: 0, loan: 0, absence: 0, other: 0 },
          net_salary: 15000,
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
            effective_date: t.created_at ? t.created_at.split("T")[0] : new Date().toISOString().split("T")[0],
            reason: "প্রাথমিক শিক্ষক হিসেবে যোগদান",
            created_at: new Date().toISOString(),
          },
        ],
        id_card: {
          card_number: `QM-${code}`,
          issue_date: new Date().toISOString().split("T")[0],
          expiry_date: `${currentYear + 2}-12-31`,
          verification_token: generateStaffVerificationToken(madrasaId, t.id),
          is_revoked: false,
        },
        created_at: t.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      existingStaff.push(newStaff);
      isModified = true;
    }
  }

  // Bi-directional sync: Sync any staff members from metadata into teachers SQL table if missing
  const teacherDbIds = new Set(teachers.map((t: any) => t.id));
  try {
    const adminClient = await createAdminClient();
    for (const s of existingStaff) {
      if (!teacherDbIds.has(s.id)) {
        await adminClient.from("teachers").insert({
          id: s.id,
          madrasa_id: madrasaId,
          first_name: s.personal?.first_name || s.personal?.full_name_bn?.split(" ")[0] || "শিক্ষক",
          last_name: s.personal?.last_name || "",
          phone: s.contact?.phone || null,
          email: s.contact?.email || null,
          designation: s.employment?.designation || "সহকারী শিক্ষক",
        });
      }
    }
  } catch (syncErr) {
    console.error("Bi-directional teacher sync warning:", syncErr);
  }

  if (isModified) {
    meta.staff_id_serial_counter = serialCounter;
  }

  return { members: existingStaff, isModified };
}

/**
 * Fetch staff dashboard aggregated statistics and overview
 */
export async function getStaffDashboardData() {
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

    const meta = (await getMadrasaMetadata(madrasaId)) as MadrasaStaffMetadata;
    const { members, isModified } = await syncAndGetStaffMembers(supabase, madrasaId, meta);

    if (isModified) {
      meta.staff_members = members;
      await saveMadrasaMetadata(madrasaId, meta);
    }

    const categories: StaffCategory[] = meta.staff_categories || DEFAULT_STAFF_CATEGORIES;
    const departments: StaffDepartment[] = meta.staff_departments || DEFAULT_STAFF_DEPARTMENTS;
    const leaveRequests: StaffLeaveRequest[] = meta.staff_leave_requests || [];

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
    const todayStr = today.toISOString().split("T")[0];
    const next30Str = next30Days.toISOString().split("T")[0];

    let expiringDocumentsCount = 0;
    members.forEach((m) => {
      (m.documents || []).forEach((doc) => {
        if (doc.expiry_date && doc.expiry_date >= todayStr && doc.expiry_date <= next30Str) {
          expiringDocumentsCount++;
        }
      });
    });

    // Recent activity log
    const recentActivity = (meta.staff_audit_logs || []).slice(-10).reverse();
    const madrasaInfo = await getMadrasaInfo();

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
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return [];

    const meta = (await getMadrasaMetadata(madrasaId)) as MadrasaStaffMetadata;
    const { members, isModified } = await syncAndGetStaffMembers(supabase, madrasaId, meta);

    if (isModified) {
      meta.staff_members = members;
      await saveMadrasaMetadata(madrasaId, meta);
    }

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

    return filtered;
  } catch (err) {
    console.error("Error in getStaffList:", err);
    return [];
  }
}

/**
 * Fetch a single staff member by ID with all relations
 */
export async function getStaffMember(id: string): Promise<StaffMember | null> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return null;

    const meta = (await getMadrasaMetadata(madrasaId)) as MadrasaStaffMetadata;
    const { members } = await syncAndGetStaffMembers(supabase, madrasaId, meta);

    const found = members.find((m) => m.id === id);
    if (!found) return null;

    return found;
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
  salary: StaffMember["salary"];
  account?: {
    create_login: boolean;
    email?: string;
    password?: string;
    role?: "teacher" | "admin" | "staff";
  };
}) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুমতি নেই। অনুগ্রহ করে পুনরায় লগইন করুন।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি।" };

    if (!payload.personal.first_name) {
      return { error: "কর্মীর প্রথম নাম আবশ্যক।" };
    }

    const meta = (await getMadrasaMetadata(madrasaId)) as MadrasaStaffMetadata;
    let existingStaff: StaffMember[] = meta.staff_members || [];

    // Increment serial and generate unique Staff ID
    const currentYear = new Date().getFullYear();
    const serial = (meta.staff_id_serial_counter || existingStaff.length || 0) + 1;
    meta.staff_id_serial_counter = serial;

    const prefix = meta.staff_id_prefix || "STF";
    const staffIdCode = formatStaffIdCode(prefix, currentYear, serial);
    const newStaffId = `stf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    let authUserId: string | null = null;
    let authRole: "teacher" | "admin" | "staff" | "none" = "none";

    // Create auth account if requested
    if (payload.account?.create_login && payload.account.email && payload.account.password) {
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
      await adminClient.from("users").insert({
        id: authUserId,
        madrasa_id: madrasaId,
        full_name: `${payload.personal.first_name} ${payload.personal.last_name || ""}`.trim(),
        email: payload.account.email,
        role: authRole,
      });
    }

    // If category is Teaching, also insert in `teachers` table for academic module compatibility
    if (isTeachingStaff(payload.employment?.category_id)) {
      const adminClient = await createAdminClient();
      await adminClient.from("teachers").insert({
        id: newStaffId,
        madrasa_id: madrasaId,
        first_name: payload.personal.first_name,
        last_name: payload.personal.last_name || "",
        phone: payload.contact.phone || null,
        email: payload.contact.email || null,
        designation: payload.employment.designation || "সহকারী শিক্ষক",
      });
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
      salary: {
        ...payload.salary,
        net_salary:
          Number(payload.salary.basic_salary || 0) +
          Object.values(payload.salary.allowances || {}).reduce((s, a) => s + Number(a || 0), 0) -
          Object.values(payload.salary.deductions || {}).reduce((s, d) => s + Number(d || 0), 0),
      },
      documents: [],
      employment_history: [
        {
          id: `hist_${Date.now()}`,
          type: "JOINED",
          new_designation: payload.employment.designation,
          new_department: deptObj?.name || "বিভাগ",
          new_salary: payload.salary.basic_salary,
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
        issue_date: payload.employment.joining_date || nowStr.split("T")[0],
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

    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath("/dashboard/teachers");
    revalidatePath("/dashboard/staff");
    return { success: true, staffId: newStaffId, staffIdCode };
  } catch (err: any) {
    console.error("Error creating staff member:", err);
    return { error: err.message || "কর্মী তৈরিতে ত্রুটি ঘটেছে।" };
  }
}

/**
 * Update an existing staff member
 */
export async function updateStaffMember(
  id: string,
  payload: Partial<Omit<StaffMember, "id" | "madrasa_id" | "staff_id_code">>
) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুমতি নেই।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি।" };

    const meta = (await getMadrasaMetadata(madrasaId)) as MadrasaStaffMetadata;
    let existingStaff: StaffMember[] = meta.staff_members || [];

    const index = existingStaff.findIndex((s) => s.id === id);
    if (index === -1) {
      return { error: "কর্মী পাওয়া যায়নি।" };
    }

    const current = existingStaff[index];
    const nowStr = new Date().toISOString();

    // Recalculate net salary if salary is updated
    let updatedSalary = current.salary;
    if (payload.salary) {
      const basic = payload.salary.basic_salary ?? current.salary.basic_salary ?? 0;
      const allowances = payload.salary.allowances ?? current.salary.allowances ?? {};
      const deductions = payload.salary.deductions ?? current.salary.deductions ?? {};
      const totAllow = Object.values(allowances).reduce((s, a) => s + Number(a || 0), 0);
      const totDeduct = Object.values(deductions).reduce((s, d) => s + Number(d || 0), 0);
      updatedSalary = {
        ...current.salary,
        ...payload.salary,
        basic_salary: basic,
        net_salary: basic + totAllow - totDeduct,
      };
    }

    const isTeachUpdated = isTeachingStaff(payload.employment?.category_id || current.employment?.category_id);
    const categories = meta.staff_categories || DEFAULT_STAFF_CATEGORIES;
    const catObj = categories.find(
      (c) =>
        c.id === (payload.employment?.category_id || current.employment?.category_id) ||
        (isTeachUpdated && isTeachingStaff(c.id))
    );

    const updatedStaff: StaffMember = {
      ...current,
      personal: { ...current.personal, ...(payload.personal || {}) },
      contact: { ...current.contact, ...(payload.contact || {}) },
      employment: {
        ...current.employment,
        ...(payload.employment || {}),
        category_name: catObj?.name || (isTeachUpdated ? "শিক্ষক মণ্ডলী (Teaching Staff)" : current.employment?.category_name || "সাধারণ কর্মী"),
      },
      academic: { ...(current.academic || {}), ...(payload.academic || {}) },
      responsibilities: payload.responsibilities || current.responsibilities,
      salary: updatedSalary,
      updated_at: nowStr,
    };

    // Keep `teachers` SQL table synced if applicable
    if (isTeachingStaff(updatedStaff.employment?.category_id)) {
      const adminClient = await createAdminClient();
      await adminClient
        .from("teachers")
        .update({
          first_name: updatedStaff.personal.first_name,
          last_name: updatedStaff.personal.last_name || "",
          phone: updatedStaff.contact.phone || null,
          email: updatedStaff.contact.email || null,
          designation: updatedStaff.employment.designation,
        })
        .eq("id", id);
    }

    // Add audit log
    if (!updatedStaff.audit_logs) updatedStaff.audit_logs = [];
    updatedStaff.audit_logs.push({
      id: `audit_${Date.now()}`,
      action: "প্রোফাইল আপডেট",
      details: "কর্মীর তথ্য হালনাগাদ করা হয়েছে।",
      user_email: user.email || "অ্যাডমিন",
      created_at: nowStr,
    });

    existingStaff[index] = updatedStaff;
    meta.staff_members = existingStaff;

    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath("/dashboard/teachers");
    revalidatePath(`/dashboard/teachers/${id}`);
    return { success: true };
  } catch (err: any) {
    console.error("Error updating staff:", err);
    return { error: err.message || "হালনাগাদে ত্রুটি হয়েছে।" };
  }
}

/**
 * Promote Staff (Change Designation, Department, Salary with History)
 */
export async function promoteStaffMember(payload: {
  staffId: string;
  newDesignation: string;
  newDepartmentId?: string;
  newDepartmentName?: string;
  newSalary?: number;
  effectiveDate: string;
  reason: string;
  remarks?: string;
}) {
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
    const prevDesignation = current.employment.designation;
    const prevDept = current.employment.department_name;
    const prevSalary = current.salary.basic_salary;
    const nowStr = new Date().toISOString();

    const historyRecord: StaffEmploymentHistoryRecord = {
      id: `hist_${Date.now()}`,
      type: "PROMOTION",
      previous_designation: prevDesignation,
      new_designation: payload.newDesignation,
      previous_department: prevDept,
      new_department: payload.newDepartmentName || prevDept,
      previous_salary: prevSalary,
      new_salary: payload.newSalary || prevSalary,
      effective_date: payload.effectiveDate,
      reason: payload.reason,
      remarks: payload.remarks,
      changed_by: user.email || "অ্যাডমিন",
      created_at: nowStr,
    };

    if (!current.employment_history) current.employment_history = [];
    current.employment_history.unshift(historyRecord);

    current.employment.designation = payload.newDesignation;
    if (payload.newDepartmentId) {
      current.employment.department_id = payload.newDepartmentId;
      current.employment.department_name = payload.newDepartmentName;
    }
    if (payload.newSalary) {
      current.salary.basic_salary = payload.newSalary;
      const totAllow = Object.values(current.salary.allowances || {}).reduce((s, a) => s + Number(a || 0), 0);
      const totDeduct = Object.values(current.salary.deductions || {}).reduce((s, d) => s + Number(d || 0), 0);
      current.salary.net_salary = payload.newSalary + totAllow - totDeduct;
    }

    if (!current.audit_logs) current.audit_logs = [];
    current.audit_logs.push({
      id: `audit_${Date.now()}`,
      action: "পদোন্নতি প্রদান",
      details: `${prevDesignation} থেকে ${payload.newDesignation} হিসেবে পদোন্নতি`,
      user_email: user.email || "অ্যাডমিন",
      created_at: nowStr,
    });

    // Update teachers SQL table if teaching
    if (current.employment.category_id === "cat-teaching") {
      const adminClient = await createAdminClient();
      await adminClient.from("teachers").update({ designation: payload.newDesignation }).eq("id", current.id);
    }

    current.updated_at = nowStr;
    existingStaff[index] = current;
    meta.staff_members = existingStaff;

    // Log in global audit
    if (!meta.staff_audit_logs) meta.staff_audit_logs = [];
    meta.staff_audit_logs.push({
      id: `log_${Date.now()}`,
      action: "পদোন্নতি",
      details: `${current.personal.first_name}: ${payload.newDesignation}`,
      user_email: user.email || "অ্যাডমিন",
      created_at: nowStr,
    });

    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath("/dashboard/teachers");
    revalidatePath(`/dashboard/teachers/${payload.staffId}`);
    return { success: true };
  } catch (err: any) {
    console.error("Error promoting staff:", err);
    return { error: err.message || "পদোন্নতি প্রক্রিয়াকরণে ত্রুটি হয়েছে।" };
  }
}

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

    if (!meta.staff_leave_requests) meta.staff_leave_requests = [];
    meta.staff_leave_requests.unshift(leaveReq);

    await saveMadrasaMetadata(madrasaId, meta);

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
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুমতি নেই।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি।" };

    const meta = (await getMadrasaMetadata(madrasaId)) as MadrasaStaffMetadata;
    let leaves = meta.staff_leave_requests || [];

    const index = leaves.findIndex((l) => l.id === payload.requestId);
    if (index === -1) return { error: "আবেদন পাওয়া যায়নি।" };

    const req = leaves[index];
    const nowStr = new Date().toISOString();

    req.status = payload.status;
    req.reviewed_by = user.email || "অ্যাডমিন";
    req.review_reason = payload.reviewReason || "";
    req.reviewed_at = nowStr;
    leaves[index] = req;
    meta.staff_leave_requests = leaves;

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
        const todayStr = new Date().toISOString().split("T")[0];
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

    await saveMadrasaMetadata(madrasaId, meta);

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
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুমতি নেই।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি।" };

    const meta = (await getMadrasaMetadata(madrasaId)) as MadrasaStaffMetadata;
    const { members } = await syncAndGetStaffMembers(supabase, madrasaId, meta);

    const activeStaff = members.filter((m) => ["ACTIVE", "ON_LEAVE"].includes(m.employment.status));
    let salaryRecords = meta.staff_salary_records || [];

    let generatedCount = 0;
    const nowStr = new Date().toISOString();

    for (const staff of activeStaff) {
      const exists = salaryRecords.some(
        (r) => r.staff_id === staff.id && r.month === month && r.year === year
      );

      if (!exists) {
        const basic = staff.salary.basic_salary || 0;
        const totAllow = Object.values(staff.salary.allowances || {}).reduce((s, a) => s + Number(a || 0), 0);
        const totDeduct = Object.values(staff.salary.deductions || {}).reduce((s, d) => s + Number(d || 0), 0);

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
          net_salary: basic + totAllow - totDeduct,
          status: "PENDING",
          created_at: nowStr,
        };

        salaryRecords.unshift(newRecord);
        generatedCount++;
      }
    }

    meta.staff_salary_records = salaryRecords;
    await saveMadrasaMetadata(madrasaId, meta);

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
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুমতি নেই।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি।" };

    const meta = (await getMadrasaMetadata(madrasaId)) as MadrasaStaffMetadata;
    let records = meta.staff_salary_records || [];

    const index = records.findIndex((r) => r.id === payload.recordId);
    if (index === -1) return { error: "বেতন রেকর্ড পাওয়া যায়নি।" };

    const record = records[index];
    const nowStr = new Date().toISOString();
    const paymentDateStr = nowStr.split("T")[0];

    // Insert into madrasa `expenses` table to integrate with Accounting/Finance
    const adminClient = await createAdminClient();
    const expenseDesc = `স্টাফ বেতন: ${record.staff_name} (${record.staff_id_code}) - ${record.month}/${record.year} [FUND: fund-general | সাধারণ ফান্ড]`;

    let expenseId = undefined;
    const { data: expData, error: expError } = await adminClient
      .from("expenses")
      .insert({
        madrasa_id: madrasaId,
        amount: record.net_salary,
        category: "Salary",
        description: expenseDesc,
        expense_date: paymentDateStr,
      })
      .select("id")
      .single();

    if (!expError && expData) {
      expenseId = expData.id;
    }

    record.status = "PAID";
    record.payment_date = paymentDateStr;
    record.payment_method = payload.paymentMethod;
    record.transaction_ref = payload.transactionRef || "";
    record.remarks = payload.remarks || "";
    record.processed_by = user.email || "হিসাব বিভাগ";
    record.expense_id = expenseId;

    records[index] = record;
    meta.staff_salary_records = records;

    // Log to staff audit
    const staffList = meta.staff_members || [];
    const sIdx = staffList.findIndex((s) => s.id === record.staff_id);
    if (sIdx !== -1) {
      const staff = staffList[sIdx];
      if (!staff.audit_logs) staff.audit_logs = [];
      staff.audit_logs.push({
        id: `audit_${Date.now()}`,
        action: "বেতন পরিশোধ",
        details: `${record.month}/${record.year} মাসের বেতন ৳${record.net_salary.toLocaleString("bn-BD")} প্রদান করা হয়েছে।`,
        user_email: user.email || "অ্যাডমিন",
        created_at: nowStr,
      });
      staffList[sIdx] = staff;
      meta.staff_members = staffList;
    }

    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath("/dashboard/teachers");
    revalidatePath(`/dashboard/teachers/${record.staff_id}`);
    revalidatePath("/dashboard/accounting");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "বেতন পরিশোধ সম্পন্ন করা যায়নি।" };
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
    const currentYear = new Date().getFullYear();
    const token = generateStaffVerificationToken(madrasaId, staffId);

    staff.id_card = {
      card_number: `QM-${staff.staff_id_code}`,
      issue_date: new Date().toISOString().split("T")[0],
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
  const madrasaInfo = await getMadrasaInfo();
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) {
    return {
      staff_members: [],
      categories: DEFAULT_STAFF_CATEGORIES,
      departments: DEFAULT_STAFF_DEPARTMENTS,
      designations: DEFAULT_STAFF_DESIGNATIONS,
      leave_requests: [],
      salary_records: [],
      madrasa_info: madrasaInfo,
    };
  }

  const madrasaId = await getAuthMadrasaId(supabase, user);
  if (!madrasaId) {
    return {
      staff_members: [],
      categories: DEFAULT_STAFF_CATEGORIES,
      departments: DEFAULT_STAFF_DEPARTMENTS,
      designations: DEFAULT_STAFF_DESIGNATIONS,
      leave_requests: [],
      salary_records: [],
      madrasa_info: madrasaInfo,
    };
  }

  const meta = (await getMadrasaMetadata(madrasaId)) as MadrasaStaffMetadata;
  const syncResult = await syncAndGetStaffMembers(supabase, madrasaId, meta);
  if (syncResult.isModified) {
    meta.staff_members = syncResult.members;
    await saveMadrasaMetadata(madrasaId, meta);
  }

  return {
    staff_members: syncResult.members || [],
    categories: meta.staff_categories && meta.staff_categories.length > 0 ? meta.staff_categories : DEFAULT_STAFF_CATEGORIES,
    departments: meta.staff_departments && meta.staff_departments.length > 0 ? meta.staff_departments : DEFAULT_STAFF_DEPARTMENTS,
    designations: meta.staff_designations && meta.staff_designations.length > 0 ? meta.staff_designations : DEFAULT_STAFF_DESIGNATIONS,
    leave_requests: meta.staff_leave_requests || [],
    salary_records: meta.staff_salary_records || [],
    madrasa_info: madrasaInfo,
  };
}

export async function addStaffDepartment(name: string, nameEn?: string) {
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
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুমতি নেই।" };
    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি।" };

    const meta = (await getMadrasaMetadata(madrasaId)) as MadrasaStaffMetadata;
    const designations = meta.staff_designations || DEFAULT_STAFF_DESIGNATIONS;
    const newDes: StaffDesignation = {
      id: `des_${Date.now()}`,
      name,
      category_id: "cat_custom",
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

