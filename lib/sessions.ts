import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "@/app/actions/students";
import { AcademicHoliday, HOLIDAY_CATEGORIES } from "./holidays";

export * from "./holidays";

export interface AcademicSession {
  id: string;
  madrasa_id: string;
  name: string; // e.g. "১৪৪৭-৪৮ হিজরি"
  academic_year: string; // e.g. "২০২৬-২৭"
  hijri_year: string; // e.g. "১৪৪৭-৪৮"
  start_date: string; // "2026-04-15"
  end_date: string; // "2027-04-05"
  status: "ACTIVE" | "ARCHIVED";
  is_current: boolean;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface StudentEnrollment {
  id: string;
  madrasa_id: string;
  student_id: string;
  session_id: string;
  class_id?: string;
  class_name?: string;
  roll_number?: string;
  status: "ACTIVE" | "PROMOTED" | "REPEAT" | "TRANSFERRED" | "GRADUATED" | "WITHDRAWN";
  enrollment_date: string;
  leaving_date?: string;
  promotion_status?: string;
  remarks?: string;
  created_at: string;
  student?: {
    id: string;
    first_name: string;
    last_name: string;
    roll_number?: string;
    parent_phone?: string;
    father_name?: string;
    photo_url?: string;
    student_id?: string;
  };
  session?: AcademicSession;
  classes?: {
    id: string;
    name: string;
  };
}

// Fallback initial default sessions when a madrasa has none yet
export function getDefaultSessions(madrasaId: string): AcademicSession[] {
  const now = new Date().toISOString();
  return [
    {
      id: `session_${madrasaId.substring(0, 8)}_1447_48`,
      madrasa_id: madrasaId,
      name: "১৪৪৭-৪৮ হিজরি",
      academic_year: "২০২৬-২৭",
      hijri_year: "১৪৪৭-৪৮",
      start_date: "2026-04-15",
      end_date: "2027-04-05",
      status: "ACTIVE",
      is_current: true,
      description: "বর্তমান শিক্ষাবর্ষ (১৪৪৭-৪৮ হিজরি / ২০২৬-২৭ ইংরেজি)",
      created_at: now,
      updated_at: now,
    },
    {
      id: `session_${madrasaId.substring(0, 8)}_1446_47`,
      madrasa_id: madrasaId,
      name: "১৪৪৬-৪৭ হিজরি",
      academic_year: "২০২৫-২৬",
      hijri_year: "১৪৪৬-৪৭",
      start_date: "2025-04-20",
      end_date: "2026-04-10",
      status: "ARCHIVED",
      is_current: false,
      description: "পূর্ববর্তী শিক্ষাবর্ষ (১৪৪৬-৪৭ হিজরি / ২০২৫-২৬ ইংরেজি - সংরক্ষিত)",
      created_at: now,
      updated_at: now,
    },
  ];
}

export interface ExtendedStudentProfile {
  student_id?: string;
  first_name?: string;
  last_name?: string;
  roll_number?: string;
  class_id?: string;
  class_name?: string;
  father_name?: string;
  parent_phone?: string;
  address?: string;
  photo_url?: string;
  blood_group?: string;
  date_of_birth?: string;
  gender?: "MALE" | "FEMALE" | string;
  residential_status?: "আবাসিক" | "অনাবাসিক" | "ডে-কেয়ার";
  is_boarding?: boolean;
  boarding_type?: "লিল্লাহ" | "সাধারণ পেইং" | "হাফ-ফ্রি" | "অনাবাসিক" | string;
  mother_name?: string;
  guardian_name?: string;
  guardian_relation?: string;
  emergency_contact?: string;
  nid_or_birth_cert?: string;
  previous_madrasa?: string;
  room_no?: string;
  seat_no?: string;
  student_status?: "ACTIVE" | "IRREGULAR" | "GRADUATED" | "DROPOUT" | "ALUMNI" | "TC";
  admission_fee?: number;
  monthly_fee?: number;
  khoraki_fee?: number;
  accommodation_fee?: number;
  transport_fee?: number;
  other_fee?: number;
  fee_discount?: number;
  fee_discount_reason?: string;
  total_monthly_fee?: number;
  father_occupation?: string;
  medical_notes?: string;
  remarks?: string;
  updated_at?: string;
}

/**
 * Storage key in madrasa metadata
 */
export interface MadrasaMetaWithSessions {
  sessions?: AcademicSession[];
  enrollments?: StudentEnrollment[];
  student_profiles?: Record<string, ExtendedStudentProfile>;
  academic_holidays?: AcademicHoliday[];
  published_exams?: Record<string, {
    is_published: boolean;
    published_at: string;
    published_by?: string;
    note?: string;
  }>;
  weekend_days?: string[];
  [key: string]: any;
}

/**
 * Helper to get parsed metadata from madrasas table
 */
export async function getMadrasaMetadata(madrasaId: string): Promise<MadrasaMetaWithSessions> {
  try {
    const adminClient = await createAdminClient();
    const { data, error } = await adminClient
      .from("madrasas")
      .select("registration_no")
      .eq("id", madrasaId)
      .single();

    if (error || !data || !data.registration_no) {
      return {};
    }

    if (data.registration_no.startsWith("{")) {
      try {
        return JSON.parse(data.registration_no);
      } catch {
        return { reg_no: data.registration_no };
      }
    }

    return { reg_no: data.registration_no };
  } catch (err) {
    console.error("Error reading madrasa metadata:", err);
    return {};
  }
}

/**
 * Helper to save metadata to madrasas table
 */
export async function saveMadrasaMetadata(madrasaId: string, meta: MadrasaMetaWithSessions): Promise<boolean> {
  try {
    const adminClient = await createAdminClient();
    const jsonStr = JSON.stringify(meta);
    const { error } = await adminClient
      .from("madrasas")
      .update({ registration_no: jsonStr })
      .eq("id", madrasaId);

    if (error) {
      console.error("Error saving madrasa metadata:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Exception saving madrasa metadata:", err);
    return false;
  }
}

/**
 * Pure data helper to enrich student object with metadata profile & admissions
 */
export function hydrateStudentWithMetadata(student: any, meta: any) {
  if (!student) return student;
  const profile = meta?.student_profiles?.[student.id] || {};
  const admission = (meta?.admissions || []).find((a: any) => a.confirmed_student_id === student.id);

  const residentialStatus = profile.residential_status !== undefined
    ? profile.residential_status
    : (admission?.residential_status || student.residential_status || "অনাবাসিক");

  const isBoarding = profile.is_boarding !== undefined
    ? Boolean(profile.is_boarding)
    : (student.is_boarding !== undefined ? Boolean(student.is_boarding) : (residentialStatus === "আবাসিক"));

  const boardingType = profile.boarding_type !== undefined
    ? profile.boarding_type
    : (isBoarding ? "সাধারণ পেইং" : "অনাবাসিক");

  const resolvedClassId = profile.class_id || student.class_id || "";
  const resolvedClassName = profile.class_name || (Array.isArray(student.classes) ? student.classes[0]?.name : student.classes?.name) || student.class_name || "";

  return {
    ...student,
    first_name: profile.first_name || student.first_name || "",
    last_name: profile.last_name || student.last_name || "",
    roll_number: profile.roll_number !== undefined && profile.roll_number !== "" ? profile.roll_number : (student.roll_number || ""),
    class_id: resolvedClassId,
    class_name: resolvedClassName,
    classes: student.classes || (resolvedClassName ? { id: resolvedClassId, name: resolvedClassName } : undefined),
    father_name: profile.father_name || student.father_name || "",
    parent_phone: profile.parent_phone || student.parent_phone || "",
    address: profile.address || student.address || "",
    photo_url: profile.photo_url || student.photo_url || admission?.photo_url || "",
    residential_status: residentialStatus,
    is_boarding: isBoarding,
    boarding_type: boardingType,
    mother_name: profile.mother_name || admission?.mother_name || student.mother_name || "",
    guardian_name: profile.guardian_name || admission?.guardian_name || student.guardian_name || "",
    guardian_relation: profile.guardian_relation || admission?.guardian_relation || student.guardian_relation || "",
    emergency_contact: profile.emergency_contact || admission?.emergency_contact || student.emergency_contact || "",
    nid_or_birth_cert: profile.nid_or_birth_cert || admission?.birth_certificate_no || student.nid_or_birth_cert || "",
    previous_madrasa: profile.previous_madrasa || admission?.previous_institution || student.previous_madrasa || "",
    room_no: profile.room_no !== undefined ? profile.room_no : (student.room_no || ""),
    seat_no: profile.seat_no !== undefined ? profile.seat_no : (student.seat_no || ""),
    student_status: profile.student_status || student.student_status || "ACTIVE",
    admission_fee: profile.admission_fee !== undefined ? Number(profile.admission_fee) : 0,
    monthly_fee: profile.monthly_fee !== undefined ? Number(profile.monthly_fee) : (student.monthly_fee || 0),
    khoraki_fee: profile.khoraki_fee !== undefined ? Number(profile.khoraki_fee) : 0,
    accommodation_fee: profile.accommodation_fee !== undefined ? Number(profile.accommodation_fee) : 0,
    transport_fee: profile.transport_fee !== undefined ? Number(profile.transport_fee) : 0,
    other_fee: profile.other_fee !== undefined ? Number(profile.other_fee) : 0,
    fee_discount: profile.fee_discount !== undefined ? Number(profile.fee_discount) : 0,
    fee_discount_reason: profile.fee_discount_reason || "",
    total_monthly_fee: profile.total_monthly_fee !== undefined ? Number(profile.total_monthly_fee) : (
      Number(profile.monthly_fee || student.monthly_fee || 0) +
      Number(profile.khoraki_fee || 0) +
      Number(profile.accommodation_fee || 0) +
      Number(profile.transport_fee || 0) +
      Number(profile.other_fee || 0) -
      Number(profile.fee_discount || 0)
    ),
    father_occupation: profile.father_occupation || "",
    medical_notes: profile.medical_notes !== undefined ? profile.medical_notes : (student.medical_notes || ""),
    remarks: profile.remarks !== undefined ? profile.remarks : (student.remarks || ""),
    blood_group: profile.blood_group || student.blood_group || admission?.blood_group || "",
    date_of_birth: profile.date_of_birth || student.date_of_birth || admission?.date_of_birth || "",
    gender: profile.gender || student.gender || admission?.gender || "MALE",
    madrasa_prefix: meta?.prefix || meta?.short_code || student.madrasa_prefix || "",
    prefix: meta?.prefix || meta?.short_code || student.prefix || "",
  };
}
