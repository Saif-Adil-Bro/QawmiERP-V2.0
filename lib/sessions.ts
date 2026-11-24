import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { AcademicHoliday, HOLIDAY_CATEGORIES } from "./holidays";
import { getStudentIdNumber, isUuid } from "./student-utils";

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
  section?: string;
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

/**
 * Deduplicate academic sessions list to prevent duplicate sessions from restore or multiple initializations
 */
export function deduplicateSessions(sessions: AcademicSession[]): AcademicSession[] {
  if (!Array.isArray(sessions) || sessions.length <= 1) {
    return Array.isArray(sessions) ? sessions : [];
  }

  const seenMap = new Map<string, AcademicSession>();

  // Sort candidate sessions so active/current or more recently updated sessions take priority
  const sorted = [...sessions].sort((a, b) => {
    if (a.is_current && !b.is_current) return -1;
    if (!a.is_current && b.is_current) return 1;
    if (a.status === "ACTIVE" && b.status === "ARCHIVED") return -1;
    if (a.status === "ARCHIVED" && b.status === "ACTIVE") return 1;
    const dateA = a.updated_at || a.created_at || a.start_date || "";
    const dateB = b.updated_at || b.created_at || b.start_date || "";
    return dateB.localeCompare(dateA);
  });

  for (const s of sorted) {
    if (!s) continue;
    const normName = (s.name || "").trim().replace(/\s+/g, " ").toLowerCase();
    const normHijri = (s.hijri_year || "").trim().replace(/\s+/g, " ").toLowerCase();
    const normAcademic = (s.academic_year || "").trim().replace(/\s+/g, " ").toLowerCase();

    const keyId = s.id ? `id:${s.id}` : "";
    const keyName = normName ? `name:${normName}` : "";
    const keyYears = (normHijri || normAcademic) ? `years:${normHijri}_${normAcademic}` : "";

    if ((keyId && seenMap.has(keyId)) || (keyName && seenMap.has(keyName)) || (keyYears && seenMap.has(keyYears))) {
      continue;
    }

    if (keyId) seenMap.set(keyId, s);
    if (keyName) seenMap.set(keyName, s);
    if (keyYears) seenMap.set(keyYears, s);
  }

  // Extract unique items preserving order
  const uniqueList = Array.from(new Set(seenMap.values()));

  // Ensure exactly one current session if any current sessions are flagged
  let hasCurrent = false;
  return uniqueList.map((s) => {
    if (s.is_current) {
      if (!hasCurrent) {
        hasCurrent = true;
        return s;
      } else {
        return { ...s, is_current: false };
      }
    }
    return s;
  });
}

export interface ExtendedStudentProfile {
  student_id?: string;
  student_id_formatted?: string;
  student_code?: string;
  first_name?: string;
  last_name?: string;
  roll_number?: string;
  class_id?: string;
  class_name?: string;
  section?: string;
  section_id?: string;
  department_id?: string | null;
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
  completed_hifz_paras?: number[];
  hifz_stage?: "QAIDA" | "NAZERA" | "HIFZ" | "DAWR" | string;
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
  biometric_devices?: any[];
  biometric_mappings?: any[];
  biometric_logs?: any[];
  [key: string]: any;
}

function cloneMetadataObject<T extends Record<string, any>>(obj: T): T {
  try {
    return structuredClone(obj);
  } catch {
    return JSON.parse(JSON.stringify(obj));
  }
}

const getRequestMadrasaMetaCache = cache(
  () => new Map<string, Promise<MadrasaMetaWithSessions>>()
);

/**
 * Uncached direct reader for madrasa metadata from the madrasas table.
 */
export async function getMadrasaMetadataUncached(
  madrasaId: string,
  strict = false
): Promise<MadrasaMetaWithSessions> {
  try {
    const adminClient = await createAdminClient();
    const { data, error } = await adminClient
      .from("madrasas")
      .select("*")
      .eq("id", madrasaId)
      .single();
    if (strict && (error || !data))
      throw new Error(error?.message || "প্রতিষ্ঠানের তথ্য পাওয়া যায়নি।");
    if (error || !data) return {};
    const dedicated =
      data.metadata && typeof data.metadata === "object" ? data.metadata : {};
    if (!data.registration_no) {
      return dedicated;
    }

    if (data.registration_no.trimStart().startsWith("{")) {
      try {
        return { ...dedicated, ...JSON.parse(data.registration_no) };
      } catch {
        if (strict) throw new Error("প্রতিষ্ঠানের সংরক্ষিত ডেটা পড়া যায়নি।");
        return { ...dedicated, reg_no: data.registration_no };
      }
    }

    return { ...dedicated, reg_no: data.registration_no };
  } catch (err) {
    if (strict) throw err;
    console.error("Error reading madrasa metadata:", err);
    return {};
  }
}

/**
 * Helper to get parsed metadata from madrasas table with per-request deduplication
 * and write-through cache invalidation on saveMadrasaMetadata.
 */
export async function getMadrasaMetadata(
  madrasaId: string,
  strict = false
): Promise<MadrasaMetaWithSessions> {
  if (!madrasaId) return {};
  const cacheMap = getRequestMadrasaMetaCache();
  const key = `${madrasaId}:${strict ? "1" : "0"}`;
  let pending = cacheMap.get(key);
  if (!pending) {
    pending = getMadrasaMetadataUncached(madrasaId, strict).catch((err) => {
      cacheMap.delete(key);
      throw err;
    });
    cacheMap.set(key, pending);
  }
  const meta = await pending;
  return cloneMetadataObject(meta);
}

/**
 * Helper to save metadata to madrasas table and immediately update the request cache
 * so no post-write read within the same request can observe stale metadata.
 */
export async function saveMadrasaMetadata(
  madrasaId: string,
  meta: MadrasaMetaWithSessions
): Promise<boolean> {
  const cacheMap = getRequestMadrasaMetaCache();
  try {
    const adminClient = await createAdminClient();
    const jsonStr = JSON.stringify(meta);
    const { error } = await adminClient
      .from("madrasas")
      .update({ registration_no: jsonStr })
      .eq("id", madrasaId);

    if (error) {
      console.error("Error saving madrasa metadata:", error);
      cacheMap.delete(`${madrasaId}:0`);
      cacheMap.delete(`${madrasaId}:1`);
      return false;
    }
    const snap = cloneMetadataObject(meta);
    cacheMap.set(`${madrasaId}:0`, Promise.resolve(snap));
    cacheMap.set(`${madrasaId}:1`, Promise.resolve(snap));
    return true;
  } catch (err) {
    console.error("Exception saving madrasa metadata:", err);
    cacheMap.delete(`${madrasaId}:0`);
    cacheMap.delete(`${madrasaId}:1`);
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

  // Promotion/transfer updates students.class_id (including an intentional NULL).
  const resolvedClassId = ('class_id' in student ? student.class_id : profile.class_id) || '';
  const sameClass = resolvedClassId && (!profile.class_id || profile.class_id === resolvedClassId);
  const resolvedClassName = (Array.isArray(student.classes) ? student.classes[0]?.name : student.classes?.name) || (sameClass && profile.class_name) || (resolvedClassId && student.class_name) || "";

  const rawExplicitId =
    profile.student_code ||
    profile.student_id_formatted ||
    (!isUuid(profile.student_id) ? profile.student_id : "") ||
    student.student_code ||
    student.student_id_formatted ||
    (!isUuid(student.student_id) ? student.student_id : "") ||
    (!isUuid(student.id_number) ? student.id_number : "") ||
    admission?.student_id ||
    admission?.admission_no ||
    "";

  const resolvedStudentId = rawExplicitId || "";

  const rawFirst = String(profile.first_name ?? student.first_name ?? "").trim();
  const rawLast = String(
    profile.last_name !== undefined ? profile.last_name : student.last_name ?? "",
  ).trim();
  const dedupedLast =
    rawFirst && rawLast && rawLast.startsWith(rawFirst)
      ? rawLast.slice(rawFirst.length).trim()
      : rawLast === rawFirst
        ? ""
        : rawLast;

  const rawPhotoUrl = String(
    profile.photo_url || student.photo_url || admission?.photo_url || "",
  ).trim();
  const isLegacyStockPhoto =
    rawPhotoUrl.includes("photo-1544717305-2782549b5136") ||
    rawPhotoUrl.includes("photo-1534528741775-53994a69daeb") ||
    rawPhotoUrl.includes("images.unsplash.com");
  const cleanPhotoUrl = isLegacyStockPhoto ? "" : rawPhotoUrl;

  return {
    ...student,
    first_name: rawFirst,
    last_name: dedupedLast,
    student_id: resolvedStudentId,
    student_id_formatted: resolvedStudentId,
    roll_number: 'roll_number' in student ? (student.roll_number || '') : (profile.roll_number || ''),
    section: 'section' in student ? student.section || '' : sameClass && profile.section || '',
    department_id: student.department_id ?? profile.department_id ?? null,
    class_id: resolvedClassId,
    class_name: resolvedClassName,
    classes: student.classes || (resolvedClassName ? { id: resolvedClassId, name: resolvedClassName } : undefined),
    father_name: profile.father_name || student.father_name || "",
    parent_phone: profile.parent_phone || student.parent_phone || "",
    address: profile.address || student.address || "",
    photo_url: cleanPhotoUrl,
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
    gender: profile.gender || student.gender || admission?.gender || "",
    madrasa_prefix: meta?.prefix || meta?.short_code || student.madrasa_prefix || "",
    prefix: meta?.prefix || meta?.short_code || student.prefix || "",
  };
}
