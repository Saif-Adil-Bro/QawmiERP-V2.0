"use server";

import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getAuthMadrasaId } from "./students";
import {
  AcademicSession,
  StudentEnrollment,
  getDefaultSessions,
  getMadrasaMetadata,
  saveMadrasaMetadata,
} from "@/lib/sessions";

const COOKIE_NAME = "qawmi_selected_session_id";

/**
 * Get the currently selected session ID from cookie
 */
export async function getSelectedSessionId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(COOKIE_NAME);
    return cookie?.value || null;
  } catch {
    return null;
  }
}

/**
 * Set the selected session ID in cookie
 */
export async function setSelectedSessionCookie(sessionId: string) {
  try {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, sessionId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

/**
 * Get all academic sessions for current madrasa
 */
export async function getAcademicSessions(targetMadrasaId?: string): Promise<AcademicSession[]> {
  try {
    const supabase = await createClient();
    let madrasaId = targetMadrasaId;

    if (!madrasaId) {
      const user = await getAuthUser(supabase);
      if (user) {
        madrasaId = (await getAuthMadrasaId(supabase, user)) || undefined;
      }
    }

    if (!madrasaId) {
      return getDefaultSessions("default");
    }

    const meta = await getMadrasaMetadata(madrasaId);

    // If no sessions exist in meta, initialize with defaults and save
    if (!meta.sessions || !Array.isArray(meta.sessions) || meta.sessions.length === 0) {
      const defaults = getDefaultSessions(madrasaId);
      meta.sessions = defaults;
      try {
        await saveMadrasaMetadata(madrasaId, meta);
      } catch {}
      return defaults;
    }

    // Sort: is_current first, then active, then by start_date descending
    return meta.sessions.sort((a, b) => {
      if (a.is_current) return -1;
      if (b.is_current) return 1;
      if (a.status === "ACTIVE" && b.status === "ARCHIVED") return -1;
      if (a.status === "ARCHIVED" && b.status === "ACTIVE") return 1;
      return (b.start_date || "").localeCompare(a.start_date || "");
    });
  } catch (err) {
    console.error("Error fetching academic sessions:", err);
    return getDefaultSessions(targetMadrasaId || "default");
  }
}

/**
 * Get the current active session for the madrasa
 */
export async function getCurrentSession(targetMadrasaId?: string): Promise<AcademicSession | null> {
  try {
    const sessions = await getAcademicSessions(targetMadrasaId);
    if (!sessions || sessions.length === 0) return null;

    const current = sessions.find((s) => s.is_current);
    if (current) return current;

    const active = sessions.find((s) => s.status === "ACTIVE");
    return active || sessions[0];
  } catch (err) {
    console.error("Error fetching current session:", err);
    return null;
  }
}

/**
 * Get a specific session by ID
 */
export async function getSessionById(sessionId: string, targetMadrasaId?: string): Promise<AcademicSession | null> {
  try {
    const sessions = await getAcademicSessions(targetMadrasaId);
    return sessions.find((s) => s.id === sessionId) || null;
  } catch (err) {
    console.error("Error fetching session by id:", err);
    return null;
  }
}

/**
 * Create a new academic session
 */
export async function createAcademicSession(prevState: any, formData: FormData) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস। অনুগ্রহ করে লগইন করুন।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদরাসা খুঁজে পাওয়া যায়নি।" };

    const name = (formData.get("name") as string)?.trim();
    const academicYear = (formData.get("academic_year") as string)?.trim();
    const hijriYear = (formData.get("hijri_year") as string)?.trim();
    const startDate = (formData.get("start_date") as string)?.trim();
    const endDate = (formData.get("end_date") as string)?.trim();
    const isCurrent = formData.get("is_current") === "true" || formData.get("is_current") === "on";
    const description = (formData.get("description") as string)?.trim() || "";

    if (!name) return { error: "শিক্ষাবর্ষের নাম আবশ্যক।" };
    if (!academicYear) return { error: "ইংরেজি শিক্ষাবর্ষ (Academic Year) আবশ্যক।" };
    if (!startDate) return { error: "শুরুর তারিখ আবশ্যক।" };
    if (!endDate) return { error: "শেষের তারিখ আবশ্যক।" };

    if (new Date(endDate) < new Date(startDate)) {
      return { error: "শেষের তারিখ শুরুর তারিখের আগের হতে পারে না।" };
    }

    const meta = await getMadrasaMetadata(madrasaId);
    let sessions = meta.sessions || getDefaultSessions(madrasaId);

    // Prevent duplicate session name
    const existing = sessions.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      return { error: `"${name}" নামে একটি শিক্ষাবর্ষ ইতিমধ্যেই বিদ্যমান রয়েছে।` };
    }

    const newId = `session_${madrasaId.substring(0, 8)}_${Date.now()}`;
    const now = new Date().toISOString();

    // If marked as current, unmark all others
    if (isCurrent) {
      sessions = sessions.map((s) => ({ ...s, is_current: false }));
    }

    const newSession: AcademicSession = {
      id: newId,
      madrasa_id: madrasaId,
      name,
      academic_year: academicYear,
      hijri_year: hijriYear || name,
      start_date: startDate,
      end_date: endDate,
      status: "ACTIVE",
      is_current: isCurrent || sessions.length === 0,
      description,
      created_at: now,
      updated_at: now,
    };

    sessions.push(newSession);
    meta.sessions = sessions;

    const saved = await saveMadrasaMetadata(madrasaId, meta);
    if (!saved) return { error: "ডাটাবেসে সংরক্ষণ ব্যর্থ হয়েছে।" };

    // Auto set cookie if marked as current
    if (newSession.is_current) {
      await setSelectedSessionCookie(newSession.id);
    }

    revalidatePath("/dashboard/academic/sessions");
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/students");

    return { success: true, session: newSession };
  } catch (err: any) {
    console.error("Exception in createAcademicSession:", err);
    return { error: err.message || "সার্ভার এরর হয়েছে।" };
  }
}

/**
 * Update an existing academic session
 */
export async function updateAcademicSession(prevState: any, formData: FormData) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদরাসা খুঁজে পাওয়া যায়নি।" };

    const sessionId = formData.get("id") as string;
    const name = (formData.get("name") as string)?.trim();
    const academicYear = (formData.get("academic_year") as string)?.trim();
    const hijriYear = (formData.get("hijri_year") as string)?.trim();
    const startDate = (formData.get("start_date") as string)?.trim();
    const endDate = (formData.get("end_date") as string)?.trim();
    const status = (formData.get("status") as "ACTIVE" | "ARCHIVED") || "ACTIVE";
    const isCurrent = formData.get("is_current") === "true" || formData.get("is_current") === "on";
    const description = (formData.get("description") as string)?.trim() || "";

    if (!sessionId) return { error: "সেশন আইডি পাওয়া যায়নি।" };
    if (!name) return { error: "শিক্ষাবর্ষের নাম আবশ্যক।" };
    if (!academicYear) return { error: "ইংরেজি শিক্ষাবর্ষ আবশ্যক।" };
    if (!startDate || !endDate) return { error: "শুরু এবং শেষের তারিখ আবশ্যক।" };

    if (new Date(endDate) < new Date(startDate)) {
      return { error: "শেষের তারিখ শুরুর তারিখের আগের হতে পারে না।" };
    }

    const meta = await getMadrasaMetadata(madrasaId);
    let sessions = meta.sessions || getDefaultSessions(madrasaId);

    const index = sessions.findIndex((s) => s.id === sessionId);
    if (index === -1) return { error: "শিক্ষাবর্ষটি খুঁজে পাওয়া যায়নি।" };

    // Check duplicate name on other sessions
    const dup = sessions.find((s) => s.id !== sessionId && s.name.toLowerCase() === name.toLowerCase());
    if (dup) return { error: `"${name}" নামের অন্য একটি শিক্ষাবর্ষ রয়েছে।` };

    const now = new Date().toISOString();

    if (isCurrent) {
      sessions = sessions.map((s) => ({ ...s, is_current: false }));
    }

    sessions[index] = {
      ...sessions[index],
      name,
      academic_year: academicYear,
      hijri_year: hijriYear || name,
      start_date: startDate,
      end_date: endDate,
      status: isCurrent ? "ACTIVE" : status,
      is_current: isCurrent,
      description,
      updated_at: now,
    };

    meta.sessions = sessions;
    const saved = await saveMadrasaMetadata(madrasaId, meta);
    if (!saved) return { error: "ডাটাবেসে আপডেট ব্যর্থ হয়েছে।" };

    if (isCurrent) {
      await setSelectedSessionCookie(sessionId);
    }

    revalidatePath("/dashboard/academic/sessions");
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/students");

    return { success: true };
  } catch (err: any) {
    console.error("Exception in updateAcademicSession:", err);
    return { error: err.message || "সার্ভার এরর হয়েছে।" };
  }
}

/**
 * Set a specific session as the Current Active Session
 */
export async function setCurrentAcademicSession(sessionId: string) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদরাসা খুঁজে পাওয়া যায়নি।" };

    const meta = await getMadrasaMetadata(madrasaId);
    let sessions = meta.sessions || getDefaultSessions(madrasaId);

    const target = sessions.find((s) => s.id === sessionId);
    if (!target) return { error: "শিক্ষাবর্ষটি খুঁজে পাওয়া যায়নি।" };

    sessions = sessions.map((s) => {
      if (s.id === sessionId) {
        return { ...s, is_current: true, status: "ACTIVE", updated_at: new Date().toISOString() };
      }
      return { ...s, is_current: false };
    });

    meta.sessions = sessions;
    const saved = await saveMadrasaMetadata(madrasaId, meta);
    if (!saved) return { error: "ডাটাবেসে সংরক্ষণ ব্যর্থ হয়েছে।" };

    await setSelectedSessionCookie(sessionId);

    revalidatePath("/dashboard/academic/sessions");
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/students");
    revalidatePath("/dashboard/classes");

    return { success: true, message: `"${target.name}" বর্তমান শিক্ষাবর্ষ হিসেবে নির্ধারণ করা হয়েছে।` };
  } catch (err: any) {
    console.error("Exception in setCurrentAcademicSession:", err);
    return { error: err.message || "সার্ভার এরর হয়েছে।" };
  }
}

/**
 * Archive a session (safely sets status to ARCHIVED, removes is_current if set)
 */
export async function archiveAcademicSession(sessionId: string) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদরাসা খুঁজে পাওয়া যায়নি।" };

    const meta = await getMadrasaMetadata(madrasaId);
    let sessions = meta.sessions || getDefaultSessions(madrasaId);

    const target = sessions.find((s) => s.id === sessionId);
    if (!target) return { error: "শিক্ষাবর্ষটি খুঁজে পাওয়া যায়নি।" };

    if (target.is_current) {
      // Find another active session to make current
      const another = sessions.find((s) => s.id !== sessionId && s.status === "ACTIVE");
      if (!another) {
        return { error: "একমাত্র সক্রিয় শিক্ষাবর্ষটি আর্কাইভ করা যাবে না। প্রথমে অন্য একটি শিক্ষাবর্ষ তৈরি বা সক্রিয় করুন।" };
      }
      another.is_current = true;
    }

    sessions = sessions.map((s) => {
      if (s.id === sessionId) {
        return { ...s, status: "ARCHIVED", is_current: false, updated_at: new Date().toISOString() };
      }
      return s;
    });

    meta.sessions = sessions;
    const saved = await saveMadrasaMetadata(madrasaId, meta);
    if (!saved) return { error: "আর্কাইভ ব্যর্থ হয়েছে।" };

    revalidatePath("/dashboard/academic/sessions");
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/students");

    return { success: true, message: `"${target.name}" শিক্ষাবর্ষটি সফলভাবে আর্কাইভ করা হয়েছে। এর সকল তথ্য সংরক্ষিত আছে।` };
  } catch (err: any) {
    console.error("Exception in archiveAcademicSession:", err);
    return { error: err.message || "সার্ভার এরর হয়েছে।" };
  }
}

/**
 * Unarchive a session (re-activates it)
 */
export async function unarchiveAcademicSession(sessionId: string) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদরাসা খুঁজে পাওয়া যায়নি।" };

    const meta = await getMadrasaMetadata(madrasaId);
    let sessions = meta.sessions || getDefaultSessions(madrasaId);

    const target = sessions.find((s) => s.id === sessionId);
    if (!target) return { error: "শিক্ষাবর্ষটি খুঁজে পাওয়া যায়নি।" };

    sessions = sessions.map((s) => {
      if (s.id === sessionId) {
        return { ...s, status: "ACTIVE", updated_at: new Date().toISOString() };
      }
      return s;
    });

    meta.sessions = sessions;
    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath("/dashboard/academic/sessions");
    return { success: true, message: `"${target.name}" পুনরায় সক্রিয় করা হয়েছে।` };
  } catch (err: any) {
    return { error: err.message || "সার্ভার এরর হয়েছে।" };
  }
}

/**
 * Delete a session (Strict validation: never allow deleting current session or session with historical enrollments)
 */
export async function deleteAcademicSession(sessionId: string) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদরাসা খুঁজে পাওয়া যায়নি।" };

    const meta = await getMadrasaMetadata(madrasaId);
    let sessions = meta.sessions || getDefaultSessions(madrasaId);

    const target = sessions.find((s) => s.id === sessionId);
    if (!target) return { error: "শিক্ষাবর্ষটি খুঁজে পাওয়া যায়নি।" };

    if (target.is_current) {
      return { error: "বর্তমান রানিং শিক্ষাবর্ষ ডিলিট করা সম্ভব নয়। অন্য সেশন সক্রিয় করে আর্কাইভ করুন।" };
    }

    if (sessions.length <= 1) {
      return { error: "সিস্টেমে অন্তত একটি শিক্ষাবর্ষ থাকতে হবে।" };
    }

    // Check if enrollments exist
    const enrollments = meta.enrollments || [];
    const hasEnrollments = enrollments.some((e) => e.session_id === sessionId);
    if (hasEnrollments) {
      return { error: "এই শিক্ষাবর্ষে শিক্ষার্থীদের এনরোলমেন্ট ডাটা রয়েছে। ডাটা হারানোর ঝুঁকি এড়াতে এটি ডিলিট না করে 'Archive' করুন।" };
    }

    sessions = sessions.filter((s) => s.id !== sessionId);
    meta.sessions = sessions;

    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath("/dashboard/academic/sessions");
    return { success: true, message: "শিক্ষাবর্ষটি ডিলিট করা হয়েছে।" };
  } catch (err: any) {
    return { error: err.message || "সার্ভার এরর হয়েছে।" };
  }
}

/**
 * ==========================================
 * STUDENT ENROLLMENT & ACADEMIC HISTORY
 * ==========================================
 */

/**
 * Get all student enrollments for a session (or filtered by class)
 */
export async function getStudentEnrollments(
  sessionId?: string,
  classId?: string,
  targetMadrasaId?: string
): Promise<StudentEnrollment[]> {
  try {
    const supabase = await createClient();
    let madrasaId = targetMadrasaId;

    if (!madrasaId) {
      const user = await getAuthUser(supabase);
      if (!user) return [];
      madrasaId = (await getAuthMadrasaId(supabase, user)) || undefined;
    }

    if (!madrasaId) return [];

    // Fetch all students and classes from Supabase
    const [{ data: students }, { data: classes }, meta] = await Promise.all([
      supabase.from("students").select("*, classes(*)").eq("madrasa_id", madrasaId).order("created_at", { ascending: false }),
      supabase.from("classes").select("*").eq("madrasa_id", madrasaId).order("name"),
      getMadrasaMetadata(madrasaId),
    ]);

    const sessions = meta.sessions || getDefaultSessions(madrasaId);
    const currentSession = sessions.find((s) => s.is_current) || sessions[0];
    const targetSessionId = sessionId || currentSession?.id;

    let storedEnrollments: StudentEnrollment[] = meta.enrollments || [];

    // Auto-sync / migration: If no stored enrollments exist, automatically generate baseline enrollments for all existing students
    if (storedEnrollments.length === 0 && students && students.length > 0 && currentSession) {
      const initialEnrollments: StudentEnrollment[] = students.map((std) => ({
        id: `enr_${std.id}_${currentSession.id}`,
        madrasa_id: madrasaId!,
        student_id: std.id,
        session_id: currentSession.id,
        class_id: std.class_id || undefined,
        class_name: std.classes?.name || std.class_name || undefined,
        roll_number: std.roll_number || undefined,
        status: "ACTIVE",
        enrollment_date: std.created_at || new Date().toISOString(),
        created_at: std.created_at || new Date().toISOString(),
      }));

      meta.enrollments = initialEnrollments;
      await saveMadrasaMetadata(madrasaId, meta);
      storedEnrollments = initialEnrollments;
    }

    // Filter by session
    let filtered = storedEnrollments;
    if (targetSessionId && targetSessionId !== "ALL") {
      filtered = filtered.filter((e) => e.session_id === targetSessionId);
    }

    // Filter by class
    if (classId && classId !== "ALL") {
      filtered = filtered.filter((e) => e.class_id === classId);
    }

    // Hydrate with full student details, class details, and session details
    const studentMap = new Map((students || []).map((s) => [s.id, s]));
    const classMap = new Map((classes || []).map((c) => [c.id, c]));
    const sessionMap = new Map(sessions.map((s) => [s.id, s]));

    const hydrated: StudentEnrollment[] = filtered
      .map((enr) => {
        const student = studentMap.get(enr.student_id);
        const cls = enr.class_id ? classMap.get(enr.class_id) : undefined;
        const sess = sessionMap.get(enr.session_id);

        if (!student) return null;

        return {
          ...enr,
          student: {
            id: student.id,
            first_name: student.first_name,
            last_name: student.last_name,
            roll_number: enr.roll_number || student.roll_number,
            parent_phone: student.parent_phone,
            father_name: student.father_name,
            photo_url: student.photo_url,
            student_id: student.student_id || student.id,
          },
          classes: cls ? { id: cls.id, name: cls.name } : undefined,
          class_name: cls?.name || enr.class_name || "অনির্ধারিত",
          session: sess,
        };
      })
      .filter(Boolean) as StudentEnrollment[];

    // Sort by roll number numerically or name
    hydrated.sort((a, b) => {
      const rollA = parseInt(a.roll_number || "9999", 10);
      const rollB = parseInt(b.roll_number || "9999", 10);
      if (!isNaN(rollA) && !isNaN(rollB) && rollA !== rollB) {
        return rollA - rollB;
      }
      const nameA = `${a.student?.first_name || ""} ${a.student?.last_name || ""}`;
      const nameB = `${b.student?.first_name || ""} ${b.student?.last_name || ""}`;
      return nameA.localeCompare(nameB);
    });

    return hydrated;
  } catch (err) {
    console.error("Error in getStudentEnrollments:", err);
    return [];
  }
}

/**
 * Get the complete academic history for a specific student
 */
export async function getStudentAcademicHistory(
  studentId: string,
  targetMadrasaId?: string
): Promise<{
  student: any;
  currentEnrollment: StudentEnrollment | null;
  history: StudentEnrollment[];
}> {
  try {
    const supabase = await createClient();
    let madrasaId = targetMadrasaId;

    if (!madrasaId) {
      const user = await getAuthUser(supabase);
      if (user) {
        madrasaId = (await getAuthMadrasaId(supabase, user)) || undefined;
      }
    }

    const { data: student } = await supabase
      .from("students")
      .select("*, classes(*)")
      .eq("id", studentId)
      .single();

    if (!student) {
      return { student: null, currentEnrollment: null, history: [] };
    }

    const currentMadrasaId = madrasaId || student.madrasa_id;
    const meta = await getMadrasaMetadata(currentMadrasaId);
    const sessions = meta.sessions || getDefaultSessions(currentMadrasaId);
    const currentSession = sessions.find((s) => s.is_current) || sessions[0];

    const sessionMap = new Map(sessions.map((s) => [s.id, s]));
    let enrollments = (meta.enrollments || []).filter((e) => e.student_id === studentId);

    // If student has no enrollment in metadata, synthesize baseline from student table
    if (enrollments.length === 0 && currentSession) {
      const baseline: StudentEnrollment = {
        id: `enr_${student.id}_${currentSession.id}`,
        madrasa_id: currentMadrasaId,
        student_id: student.id,
        session_id: currentSession.id,
        class_id: student.class_id || undefined,
        class_name: student.classes?.name || student.class_name,
        roll_number: student.roll_number,
        status: "ACTIVE",
        enrollment_date: student.created_at || new Date().toISOString(),
        created_at: student.created_at || new Date().toISOString(),
      };
      enrollments = [baseline];
    }

    // Hydrate sessions and classes
    const { data: classes } = await supabase.from("classes").select("*").eq("madrasa_id", currentMadrasaId);
    const classMap = new Map((classes || []).map((c) => [c.id, c]));

    const hydratedHistory = enrollments.map((enr) => {
      const sess = sessionMap.get(enr.session_id);
      const cls = enr.class_id ? classMap.get(enr.class_id) : undefined;
      return {
        ...enr,
        session: sess,
        classes: cls ? { id: cls.id, name: cls.name } : undefined,
        class_name: cls?.name || enr.class_name || "অনির্ধারিত",
      };
    });

    // Sort history from latest to oldest
    hydratedHistory.sort((a, b) => {
      const dateA = a.session?.start_date || a.enrollment_date || "";
      const dateB = b.session?.start_date || b.enrollment_date || "";
      return dateB.localeCompare(dateA);
    });

    const currentEnrollment =
      hydratedHistory.find((h) => h.session_id === currentSession?.id) ||
      hydratedHistory.find((h) => h.status === "ACTIVE") ||
      hydratedHistory[0] ||
      null;

    return {
      student,
      currentEnrollment,
      history: hydratedHistory,
    };
  } catch (err) {
    console.error("Error in getStudentAcademicHistory:", err);
    return { student: null, currentEnrollment: null, history: [] };
  }
}

/**
 * ==========================================
 * STUDENT PROMOTION WORKFLOW
 * ==========================================
 */

export interface StudentPromotionItem {
  studentId: string;
  targetClassId: string | null;
  targetRoll: string;
  actionStatus: "PROMOTE" | "REPEAT" | "TRANSFER" | "GRADUATE" | "WITHDRAW";
  remarks?: string;
}

export interface PromotionRequest {
  fromSessionId: string;
  toSessionId: string;
  fromClassId: string;
  items: StudentPromotionItem[];
}

/**
 * Execute promotion workflow:
 * 1. Preserves old enrollments with updated historical status (e.g. PROMOTED, REPEAT, etc.)
 * 2. Creates brand new enrollment records for the new session
 * 3. Updates student's latest active class & roll in main student profile if targeting active session
 */
export async function executeStudentPromotion(request: PromotionRequest) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদরাসা খুঁজে পাওয়া যায়নি।" };

    const { fromSessionId, toSessionId, fromClassId, items } = request;

    if (!fromSessionId || !toSessionId) {
      return { error: "উৎস ও গন্তব্য শিক্ষাবর্ষ উভয়ই নির্বাচন করতে হবে।" };
    }

    if (fromSessionId === toSessionId) {
      return { error: "উৎস ও গন্তব্য একই শিক্ষাবর্ষ হতে পারে না।" };
    }

    if (!items || items.length === 0) {
      return { error: "প্রমোশনের জন্য কোনো শিক্ষার্থী নির্বাচন করা হয়নি।" };
    }

    const meta = await getMadrasaMetadata(madrasaId);
    const sessions = meta.sessions || getDefaultSessions(madrasaId);
    const toSession = sessions.find((s) => s.id === toSessionId);
    const fromSession = sessions.find((s) => s.id === fromSessionId);

    if (!toSession) return { error: "টার্গেট শিক্ষাবর্ষ পাওয়া যায়নি।" };

    let enrollments = meta.enrollments || [];
    const now = new Date().toISOString();

    const { data: classes } = await supabase.from("classes").select("*").eq("madrasa_id", madrasaId);
    const classMap = new Map((classes || []).map((c) => [c.id, c]));

    let promotedCount = 0;
    let repeatedCount = 0;
    let otherCount = 0;

    for (const item of items) {
      const { studentId, targetClassId, targetRoll, actionStatus, remarks } = item;

      // 1. Update old enrollment record status in the previous session
      const oldIndex = enrollments.findIndex(
        (e) => e.student_id === studentId && e.session_id === fromSessionId
      );

      const oldStatusMap: Record<string, StudentEnrollment["status"]> = {
        PROMOTE: "PROMOTED",
        REPEAT: "REPEAT",
        TRANSFER: "TRANSFERRED",
        GRADUATE: "GRADUATED",
        WITHDRAW: "WITHDRAWN",
      };

      const oldStatus = oldStatusMap[actionStatus] || "PROMOTED";

      if (oldIndex !== -1) {
        enrollments[oldIndex] = {
          ...enrollments[oldIndex],
          status: oldStatus,
          promotion_status: `Promoted to ${toSession.name}`,
          leaving_date: now.split("T")[0],
          remarks: remarks || enrollments[oldIndex].remarks,
        };
      } else {
        // Synthesize old record if not present
        enrollments.push({
          id: `enr_${studentId}_${fromSessionId}`,
          madrasa_id: madrasaId,
          student_id: studentId,
          session_id: fromSessionId,
          class_id: fromClassId,
          roll_number: targetRoll,
          status: oldStatus,
          enrollment_date: fromSession?.start_date || now.split("T")[0],
          leaving_date: now.split("T")[0],
          promotion_status: `Promoted to ${toSession.name}`,
          remarks: remarks,
          created_at: now,
        });
      }

      // 2. Create NEW enrollment in the destination session (unless withdrawn or transferred without continuing)
      if (actionStatus === "PROMOTE" || actionStatus === "REPEAT") {
        const destinationClassId = actionStatus === "PROMOTE" ? targetClassId : fromClassId;
        const clsObj = destinationClassId ? classMap.get(destinationClassId) : null;

        // Check if an enrollment in destination session already exists
        const existingDestIndex = enrollments.findIndex(
          (e) => e.student_id === studentId && e.session_id === toSessionId
        );

        const newEnrollmentRecord: StudentEnrollment = {
          id: `enr_${studentId}_${toSessionId}`,
          madrasa_id: madrasaId,
          student_id: studentId,
          session_id: toSessionId,
          class_id: destinationClassId || undefined,
          class_name: clsObj?.name || undefined,
          roll_number: targetRoll || undefined,
          status: "ACTIVE",
          enrollment_date: toSession.start_date || now.split("T")[0],
          remarks: remarks || (actionStatus === "PROMOTE" ? "উত্তীর্ণ হয়ে প্রমোশন প্রাপ্ত" : "একই জামাতে পুনরাবৃত্তি"),
          created_at: now,
        };

        if (existingDestIndex !== -1) {
          enrollments[existingDestIndex] = newEnrollmentRecord;
        } else {
          enrollments.push(newEnrollmentRecord);
        }

        // 3. If target session is current/active, update student's main row in Supabase table
        if (toSession.is_current) {
          await supabase
            .from("students")
            .update({
              class_id: destinationClassId || null,
              roll_number: targetRoll || null,
            })
            .eq("id", studentId);
        }

        if (actionStatus === "PROMOTE") promotedCount++;
        else repeatedCount++;
      } else {
        otherCount++;
        // If graduate or withdraw and target session is current, update status
        if (toSession.is_current && (actionStatus === "GRADUATE" || actionStatus === "TRANSFER")) {
          await supabase
            .from("students")
            .update({
              class_id: null,
            })
            .eq("id", studentId);
        }
      }
    }

    meta.enrollments = enrollments;
    const saved = await saveMadrasaMetadata(madrasaId, meta);
    if (!saved) return { error: "প্রমোশন ডাটা সেভ করতে সমস্যা হয়েছে।" };

    revalidatePath("/dashboard/students");
    revalidatePath("/dashboard/students/promotion");
    revalidatePath("/dashboard/academic/promotion");
    revalidatePath("/dashboard/classes");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `মোট ${items.length} জন শিক্ষার্থীর প্রমোশন সফলভাবে সম্পন্ন হয়েছে! (উত্তীর্ণ: ${promotedCount}, পুনরাবৃত্তি: ${repeatedCount}, অন্যান্য: ${otherCount})`,
      promotedCount,
      repeatedCount,
      otherCount,
    };
  } catch (err: any) {
    console.error("Exception in executeStudentPromotion:", err);
    return { error: err.message || "সার্ভার এরর হয়েছে।" };
  }
}

/**
 * Sync / Initialize all unlinked students to the current session
 */
export async function syncExistingStudentsWithCurrentSession() {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "Unauthorized" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "Madrasa not found" };

    const meta = await getMadrasaMetadata(madrasaId);
    const sessions = meta.sessions || getDefaultSessions(madrasaId);
    const currentSession = sessions.find((s) => s.is_current) || sessions[0];

    const { data: students } = await supabase
      .from("students")
      .select("*, classes(*)")
      .eq("madrasa_id", madrasaId);

    if (!students || students.length === 0) {
      return { success: true, count: 0, message: "কোনো শিক্ষার্থী পাওয়া যায়নি।" };
    }

    let enrollments = meta.enrollments || [];
    let addedCount = 0;
    const now = new Date().toISOString();

    for (const std of students) {
      const exists = enrollments.some(
        (e) => e.student_id === std.id && e.session_id === currentSession.id
      );

      if (!exists) {
        enrollments.push({
          id: `enr_${std.id}_${currentSession.id}`,
          madrasa_id: madrasaId,
          student_id: std.id,
          session_id: currentSession.id,
          class_id: std.class_id || undefined,
          class_name: std.classes?.name || std.class_name,
          roll_number: std.roll_number,
          status: "ACTIVE",
          enrollment_date: std.created_at || now,
          created_at: now,
        });
        addedCount++;
      }
    }

    meta.enrollments = enrollments;
    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath("/dashboard/academic/sessions");
    revalidatePath("/dashboard/students");

    return {
      success: true,
      count: addedCount,
      message: `${addedCount} জন শিক্ষার্থী বর্তমান শিক্ষাবর্ষ (${currentSession.name})-এ সংযুক্ত হয়েছে।`,
    };
  } catch (err: any) {
    return { error: err.message };
  }
}
