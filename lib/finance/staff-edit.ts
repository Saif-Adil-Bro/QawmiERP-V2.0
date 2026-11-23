// Internal functions, not Next Server Actions. Only the workflow executor can
// supply the separate approved request reference, never the public payload.
import { revalidatePath } from "next/cache";
import { writeGuard } from "@/lib/action-authorization";
import { createAdminClient } from "@/lib/supabase/server";
import { getMadrasaMetadata } from "@/lib/sessions";
import { submitWorkflowHookApproval } from "@/lib/approval-workflow";
import {
  DEFAULT_STAFF_CATEGORIES,
  isTeachingStaff,
  type StaffMember,
  type StaffEmploymentHistoryRecord,
  type StaffCategory,
} from "@/lib/staff-management";
import { isMaskedValue } from "@/lib/pii-masking";
import { salaryAccess } from "./staff-access";
import { salaryTerms, salaryApprovalAmount } from "./salary-terms";
export type StaffEdit = Partial<
  Omit<StaffMember, "id" | "madrasa_id" | "staff_id_code">
>;
export type StaffPromotion = {
  staffId: string;
  newDesignation: string;
  newDepartmentId?: string;
  newDepartmentName?: string;
  newSalary?: number;
  effectiveDate: string;
  reason: string;
  remarks?: string;
};
type Approved = { tenant: string; requestId: string };
/**
 * Update an existing staff member
 */
export async function editStaff(
  id: string,
  payload: StaffEdit,
  approved?: Approved,
) {
  try {
    const access = await writeGuard("staff");
    if (
      !access.allowed ||
      !access.userId ||
      !access.madrasaId ||
      (approved && access.madrasaId !== approved.tenant)
    )
      return { error: "কর্মী ব্যবস্থাপনার অনুমতি নেই।" };
    if (payload.salary && !salaryAccess(access, "write"))
      return { error: "বেতন পরিবর্তনের অনুমতি নেই।" };
    const madrasaId = access.madrasaId,
      actor = access.userId,
      email = access.actorEmail || "";
    const meta = await getMadrasaMetadata(madrasaId, true);
    const existingStaff: StaffMember[] = meta.staff_members || [];
    const index = existingStaff.findIndex((s) => s.id === id);
    if (index === -1) {
      return { error: "কর্মী পাওয়া যায়নি।" };
    }

    const current = existingStaff[index];
    const nowStr = new Date().toISOString();

    // A directory display mask is not a replacement address, NID or bank account.
    // Remove placeholders from the patch, not from the stored record.
    function keepOriginal<T extends object>(patch: T): T {
      return Object.fromEntries(
        Object.entries(patch).filter(([, v]) => !isMaskedValue(v)),
      ) as T;
    }
    payload = {
      ...payload,
      personal: payload.personal && keepOriginal(payload.personal),
      contact: payload.contact && keepOriginal(payload.contact),
      salary: payload.salary && keepOriginal(payload.salary),
    };
    const updatedSalary = payload.salary
      ? salaryTerms(current.salary, payload.salary)
      : current.salary;
    if (!approved && payload.salary) {
      const targetSalary = updatedSalary.basic_salary;
      const hook = await submitWorkflowHookApproval({
        madrasaId,
        actorId: actor,
        actorName: access.actorName,
        actorRole: access.actorRole,
        requestType: "SALARY_CHANGE",
        amount: salaryApprovalAmount(updatedSalary),
        title: `স্টাফ বেতন পরিবর্তন: ${current.personal?.full_name_bn || current.personal?.full_name_en || id}`,
        description: `মূল বেতন ${current.salary?.basic_salary || 0} → ${targetSalary}; নিট ${updatedSalary.net_salary}`,
        entityType: "staff",
        targetId: id,
        targetName:
          current.personal?.full_name_bn || current.personal?.full_name_en,
        payload: {
          action: "update_staff_salary",
          staffId: id,
          staffPayload: {
            personal: payload.personal,
            contact: payload.contact,
            employment: payload.employment,
            academic: payload.academic,
            responsibilities: payload.responsibilities,
            salary: updatedSalary,
          },
          salaryTerms: updatedSalary,
          priorSalary: current.salary,
          priorUpdate: current.updated_at,
        },
      });
      if (hook.matched) {
        return {
          success: true,
          pendingApproval: true,
          approvalRequestId: hook.approvalRequestId,
          message: "বেতন পরিবর্তনের জন্য অনুমোদনের আবেদন পাঠানো হয়েছে।",
        };
      }
    }

    const isTeachUpdated = isTeachingStaff(
      payload.employment?.category_id || current.employment?.category_id,
    );
    const categories: StaffCategory[] =
      meta.staff_categories || DEFAULT_STAFF_CATEGORIES;
    const catObj = categories.find(
      (c) =>
        c.id ===
          (payload.employment?.category_id ||
            current.employment?.category_id) ||
        (isTeachUpdated && isTeachingStaff(c.id)),
    );

    const updatedStaff: StaffMember = {
      ...current,
      madrasa_id: madrasaId,
      personal: { ...current.personal, ...(payload.personal || {}) },
      contact: { ...current.contact, ...(payload.contact || {}) },
      employment: {
        ...current.employment,
        ...(payload.employment || {}),
        category_name:
          catObj?.name ||
          (isTeachUpdated
            ? "শিক্ষক মণ্ডলী (Teaching Staff)"
            : current.employment?.category_name || "সাধারণ কর্মী"),
      },
      academic: { ...(current.academic || {}), ...(payload.academic || {}) },
      responsibilities: payload.responsibilities || current.responsibilities,
      salary: updatedSalary,
      updated_at: nowStr,
    };

    const teacher = isTeachingStaff(updatedStaff.employment.category_id)
      ? {
          first_name: updatedStaff.personal.first_name,
          last_name: updatedStaff.personal.last_name || "",
          phone: updatedStaff.contact.phone || null,
          email: updatedStaff.contact.email || null,
          designation: updatedStaff.employment.designation,
        }
      : null;
    // Add audit log
    updatedStaff.audit_logs = [...(current.audit_logs || [])];
    updatedStaff.audit_logs.push({
      id: `audit_${Date.now()}`,
      action: "প্রোফাইল আপডেট",
      details: "কর্মীর তথ্য হালনাগাদ করা হয়েছে।",
      user_email: email || "অ্যাডমিন",
      created_at: nowStr,
    });

    const db = await createAdminClient();
    const { error } = await db.rpc("finance_edit_staff", {
      t: madrasaId,
      actor,
      prior: current,
      nxt: updatedStaff,
      teacher,
      log: null,
      request_id: approved?.requestId || null,
    });
    if (error) return { error: error.message };

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
export async function promoteStaff(
  payload: StaffPromotion,
  approved?: Approved,
) {
  try {
    const access = await writeGuard("staff");
    if (
      !access.allowed ||
      !access.userId ||
      !access.madrasaId ||
      (approved && access.madrasaId !== approved.tenant)
    )
      return { error: "কর্মী ব্যবস্থাপনার অনুমতি নেই।" };
    if (payload.newSalary != null && !salaryAccess(access, "write"))
      return { error: "বেতন পরিবর্তনের অনুমতি নেই।" };
    const madrasaId = access.madrasaId,
      actor = access.userId,
      email = access.actorEmail || "";
    const meta = await getMadrasaMetadata(madrasaId, true);
    const existingStaff: StaffMember[] = meta.staff_members || [];
    const index = existingStaff.findIndex((s) => s.id === payload.staffId);
    if (index === -1) return { error: "কর্মী পাওয়া যায়নি।" };

    const prior = existingStaff[index],
      current = structuredClone(prior);
    current.madrasa_id = madrasaId;
    const prevDesignation = current.employment.designation;
    const prevDept = current.employment.department_name;
    const prevSalary = current.salary.basic_salary;
    const nowStr = new Date().toISOString();

    const updatedSalary =
      payload.newSalary != null
        ? salaryTerms(prior.salary, { basic_salary: payload.newSalary })
        : prior.salary;
    if (
      !approved &&
      payload.newSalary != null &&
      updatedSalary.basic_salary !== prevSalary
    ) {
      const hook = await submitWorkflowHookApproval({
        madrasaId,
        actorId: actor,
        actorName: access.actorName,
        actorRole: access.actorRole,
        requestType: "SALARY_CHANGE",
        amount: salaryApprovalAmount(updatedSalary),
        title: `পদোন্নতি ও বেতন পরিবর্তন: ${current.personal?.full_name_bn || current.personal?.full_name_en || payload.staffId}`,
        description: `${payload.reason}: বেতন ${prevSalary} → ${payload.newSalary}; নিট ${updatedSalary.net_salary}`,
        entityType: "staff",
        targetId: payload.staffId,
        targetName:
          current.personal?.full_name_bn || current.personal?.full_name_en,
        payload: {
          action: "promote_staff",
          promotePayload: {
            staffId: payload.staffId,
            newDesignation: payload.newDesignation,
            newDepartmentId: payload.newDepartmentId,
            newDepartmentName: payload.newDepartmentName,
            newSalary: updatedSalary.basic_salary,
            effectiveDate: payload.effectiveDate,
            reason: payload.reason,
            remarks: payload.remarks,
          },
          staffId: payload.staffId,
          salaryTerms: updatedSalary,
          priorSalary: prior.salary,
          priorUpdate: prior.updated_at,
        },
      });
      if (hook.matched) {
        return {
          success: true,
          pendingApproval: true,
          approvalRequestId: hook.approvalRequestId,
          message: "পদোন্নতি ও বেতন পরিবর্তনের জন্য অনুমোদনের আবেদন পাঠানো হয়েছে।",
        };
      }
    }

    const historyRecord: StaffEmploymentHistoryRecord = {
      id: `hist_${Date.now()}`,
      type: "PROMOTION",
      previous_designation: prevDesignation,
      new_designation: payload.newDesignation,
      previous_department: prevDept,
      new_department: payload.newDepartmentName || prevDept,
      previous_salary: prevSalary,
      new_salary: payload.newSalary ?? prevSalary,
      effective_date: payload.effectiveDate,
      reason: payload.reason,
      remarks: payload.remarks,
      changed_by: email || "অ্যাডমিন",
      created_at: nowStr,
    };

    if (!current.employment_history) current.employment_history = [];
    current.employment_history.unshift(historyRecord);

    current.employment.designation = payload.newDesignation;
    if (payload.newDepartmentId) {
      current.employment.department_id = payload.newDepartmentId;
      current.employment.department_name = payload.newDepartmentName;
    }
    current.salary = updatedSalary;

    if (!current.audit_logs) current.audit_logs = [];
    current.audit_logs.push({
      id: `audit_${Date.now()}`,
      action: "পদোন্নতি প্রদান",
      details: `${prevDesignation} থেকে ${payload.newDesignation} হিসেবে পদোন্নতি`,
      user_email: email || "অ্যাডমিন",
      created_at: nowStr,
    });

    current.updated_at = nowStr;
    const teacher = isTeachingStaff(current.employment.category_id)
      ? { designation: payload.newDesignation }
      : null;
    const log = {
      id: crypto.randomUUID(),
      action: "পদোন্নতি",
      details: `${current.personal.first_name}: ${payload.newDesignation}`,
      user_email: email,
      created_at: nowStr,
    };
    const db = await createAdminClient();
    const { error } = await db.rpc("finance_edit_staff", {
      t: madrasaId,
      actor,
      prior,
      nxt: current,
      teacher,
      log,
      request_id: approved?.requestId || null,
    });
    if (error) return { error: error.message };

    revalidatePath("/dashboard/teachers");
    revalidatePath(`/dashboard/teachers/${payload.staffId}`);
    return { success: true };
  } catch (err: any) {
    console.error("Error promoting staff:", err);
    return { error: err.message || "পদোন্নতি প্রক্রিয়াকরণে ত্রুটি হয়েছে।" };
  }
}
