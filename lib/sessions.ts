import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "@/app/actions/students";

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
