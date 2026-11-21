import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { webIdentity, hasRole, teacherScope, teacherStudents, linkedStudents } from './portal/identity';
import { studentRoles, teacherRoles } from './portal/rules';
import { loadServerPermissions, type ServerPermissionContext } from "@/lib/permissions-server";
import { canViewUnmaskedField } from "@/lib/pii-masking";

export {
  maskPhoneNumber,
  maskNidNumber,
  maskEmailAddress,
  maskBankAccount,
  isMaskedValue,
  canViewUnmaskedField,
  maskStudentSensitiveFields,
  maskDonorSensitiveFields,
  maskStaffSensitiveFields,
  maskAlumniSensitiveFields,
} from "@/lib/pii-masking";

export interface DataAccessScope {
  isUnrestricted: boolean;
  allowedStudentIds: string[];
  allowedClassIds: string[];
  userRole: string;
  userId: string;
  madrasaId: string;
}

/**
 * Resolves the data access scope for the currently authenticated user.
 * - super_admin, admin, muhtamim, or users with explicit global view permissions: isUnrestricted = true
 * - parent / student: allowedStudentIds = only their linked child/children
 * - teacher (without global permission): allowedClassIds = assigned classes, allowedStudentIds = students in those classes
 */
export async function getUserDataAccessScope(): Promise<DataAccessScope> {
  const i = await webIdentity();
  const scope: DataAccessScope = {isUnrestricted:false, allowedClassIds:[], allowedStudentIds:[],
    userRole:i?.perms.role || 'none', userId:i?.user.id || '', madrasaId:i?.tenant || ''};
  if (!i) return scope;
  if (hasRole(i,studentRoles)) {
    const {students} = await linkedStudents(i);
    return {...scope, allowedStudentIds:students.map(s=>s.id)};
  }
  if (hasRole(i,teacherRoles)) {
    const teacher = await teacherScope(i);
    return {...scope, allowedStudentIds:(await teacherStudents(i,teacher)).map(s=>s.id), allowedClassIds:teacher.classes.map(c=>c.id)};
  }
  scope.isUnrestricted = hasRole(i,['super_admin','muhtamim','admin']) ||
    i.perms.summary.effectivePermissions.some(p => ['student.view_all','academic.view_all','academic.manage'].includes(p));
  return scope;
}

export interface CurrentUserMaskingContext {
  authenticated: boolean;
  userId: string;
  madrasaId: string;
  allowUnmasked: boolean;
  permissionContext: ServerPermissionContext | null;
}

/**
 * Resolves the currently authenticated user's PII unmasking capability on the server.
 * Fail-closed: returns `allowUnmasked: false` when unauthenticated or lacking `data.unmask`.
 */
export async function getCurrentUserMaskingContext(
  module?: string,
  field?: string
): Promise<CurrentUserMaskingContext> {
  try {
    const supabase = await createClient();
    const authUser = await getAuthUser(supabase);
    if (!authUser) {
      return {
        authenticated: false,
        userId: "",
        madrasaId: "",
        allowUnmasked: false,
        permissionContext: null,
      };
    }

    const adminClient = await createAdminClient();
    const { data: userRow } = await adminClient
      .from("users")
      .select("madrasa_id")
      .eq("id", authUser.id)
      .maybeSingle();

    const madrasaId = String((userRow as any)?.madrasa_id || "");
    if (!madrasaId) {
      return {
        authenticated: true,
        userId: authUser.id,
        madrasaId: "",
        allowUnmasked: false,
        permissionContext: null,
      };
    }

    const permissionContext = await loadServerPermissions(authUser.id, madrasaId);
    const allowUnmasked = canViewUnmaskedField(permissionContext?.summary, module, field);

    return {
      authenticated: true,
      userId: authUser.id,
      madrasaId,
      allowUnmasked,
      permissionContext,
    };
  } catch {
    return {
      authenticated: false,
      userId: "",
      madrasaId: "",
      allowUnmasked: false,
      permissionContext: null,
    };
  }
}
