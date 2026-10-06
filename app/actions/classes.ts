"use server";

import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";
import { isTeachingStaff } from "@/lib/staff-management";

// Helper to parse sequence and actual description from a stored description text
function parseClassDescription(description: string | null): { sequence: number; actualDescription: string } {
  if (!description) return { sequence: 0, actualDescription: "" };
  const match = description.match(/^\[seq:(\d+)\]\s*(.*)/);
  if (match) {
    return {
      sequence: parseInt(match[1], 10),
      actualDescription: match[2] || "",
    };
  }
  return { sequence: 0, actualDescription: description };
}

// Helper to format sequence and actual description into description text
function formatClassDescription(sequence: number, actualDescription: string | null): string {
  const cleanDesc = actualDescription ? actualDescription.replace(/^\[seq:\d+\]\s*/, "") : "";
  return `[seq:${sequence}] ${cleanDesc}`;
}

export interface AvailableTeacher {
  id: string;
  name: string;
  staff_id_code?: string;
  designation?: string;
  phone?: string;
  email?: string;
}

export interface EnrichedClassItem {
  id: string;
  name: string;
  description: string | null;
  sequence: number;
  madrasa_id?: string;
  created_at?: string;
  class_teacher_id?: string | null;
  class_teacher_name?: string | null;
  class_teacher_code?: string | null;
  class_teacher_designation?: string | null;
  class_teacher_phone?: string | null;
}

/**
 * Fetch all available teachers for class in-charge assignment
 */
export async function getTeachersForClassAssignment(): Promise<AvailableTeacher[]> {
  try {
    const supabase = await createClient();
    const adminClient = await createAdminClient();
    let madrasaId = "";

    try {
      const user = await getAuthUser(supabase);
      if (user) {
        const { getAuthMadrasaId } = await import("./students");
        madrasaId = (await getAuthMadrasaId(supabase, user)) || "";
      }
    } catch (e) {
      console.warn("Could not get user madrasa:", e);
    }

    if (!madrasaId) {
      const { data: anyMadrasa } = await adminClient.from("madrasas").select("id").limit(1).single();
      madrasaId = anyMadrasa?.id || "";
    }

    const teachersList: AvailableTeacher[] = [];
    const seenIds = new Set<string>();

    // 1. Fetch from Madrasa Metadata (Staff Management)
    if (madrasaId) {
      const meta = (await getMadrasaMetadata(madrasaId)) as any;
      const staffMembers = meta?.staff_members || [];

      staffMembers.forEach((s: any) => {
        if (isTeachingStaff(s) || s.employment?.category_id === "cat-teaching" || s.employment?.category_id === "cat_teaching") {
          const name = s.personal?.full_name_bn || `${s.personal?.first_name || ""} ${s.personal?.last_name || ""}`.trim() || "শিক্ষক";
          teachersList.push({
            id: s.id,
            name,
            staff_id_code: s.staff_id_code || s.employment?.staff_id_code || "",
            designation: s.employment?.designation || "মুদাররিস",
            phone: s.contact?.phone || "",
            email: s.contact?.email || "",
          });
          seenIds.add(s.id);
          if (s.legacy_id) seenIds.add(s.legacy_id);
        }
      });
    }

    // 2. Fetch from SQL `teachers` table as well
    const { data: dbTeachers } = await adminClient
      .from("teachers")
      .select("id, first_name, last_name, designation, phone, email")
      .eq("madrasa_id", madrasaId);

    (dbTeachers || []).forEach((t) => {
      if (!seenIds.has(t.id)) {
        const name = `${t.first_name || ""} ${t.last_name || ""}`.trim() || "শিক্ষক";
        teachersList.push({
          id: t.id,
          name,
          designation: t.designation || "মুদাররিস",
          phone: t.phone || "",
          email: t.email || "",
        });
        seenIds.add(t.id);
      }
    });

    return teachersList;
  } catch (err) {
    console.error("Error in getTeachersForClassAssignment:", err);
    return [];
  }
}

export async function getClasses(): Promise<EnrichedClassItem[]> {
  try {
    const supabase = await createClient();
    const adminClient = await createAdminClient();
    let madrasaId = "";

    try {
      const user = await getAuthUser(supabase);
      if (user) {
        const { getAuthMadrasaId } = await import("./students");
        madrasaId = (await getAuthMadrasaId(supabase, user)) || "";
      }
    } catch (e) {
      console.warn("Could not get user madrasa:", e);
    }

    if (!madrasaId) {
      const { data: anyMadrasa } = await adminClient.from("madrasas").select("id").limit(1).single();
      madrasaId = anyMadrasa?.id || "";
    }

    let rawData: any[] = [];
    const { data: userData, error: userError } = await supabase
      .from("classes")
      .select("*")
      .order("name");

    if (!userError && userData && userData.length > 0) {
      rawData = userData;
    } else {
      const { data: adminData } = await adminClient
        .from("classes")
        .select("*")
        .order("name");
      rawData = adminData || [];
    }

    // Load metadata to attach class teachers
    let meta: any = null;
    let classTeacherMap: Record<string, any> = {};
    const teachersMap = new Map<string, AvailableTeacher>();

    if (madrasaId) {
      meta = await getMadrasaMetadata(madrasaId);
      classTeacherMap = meta?.class_teachers || {};

      const teachers = await getTeachersForClassAssignment();
      teachers.forEach((t) => {
        teachersMap.set(t.id, t);
      });
    }

    const processed = rawData.map((cls) => {
      const { sequence, actualDescription } = parseClassDescription(cls.description);
      const assignment = classTeacherMap[cls.id];
      const teacher = assignment?.teacher_id ? teachersMap.get(assignment.teacher_id) : null;

      return {
        ...cls,
        sequence,
        description: actualDescription,
        class_teacher_id: teacher?.id || assignment?.teacher_id || null,
        class_teacher_name: teacher?.name || assignment?.teacher_name || null,
        class_teacher_code: teacher?.staff_id_code || assignment?.teacher_code || null,
        class_teacher_designation: teacher?.designation || assignment?.teacher_designation || null,
        class_teacher_phone: teacher?.phone || assignment?.teacher_phone || null,
      };
    });

    processed.sort((a, b) => {
      if (a.sequence !== b.sequence) {
        return a.sequence - b.sequence;
      }
      return (a.name || "").localeCompare(b.name || "");
    });

    return processed;
  } catch (err) {
    console.error("Exception in getClasses:", err);
    return [];
  }
}

/**
 * Assign or change a class's Jimmadar / Class Teacher
 */
export async function assignClassTeacher(classId: string, teacherId: string | null) {
  try {
    const supabase = await createClient();
    const adminClient = await createAdminClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুমতি নেই। অনুগ্রহ করে লগইন করুন।" };

    const { getAuthMadrasaId } = await import("./students");
    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি।" };

    const meta = ((await getMadrasaMetadata(madrasaId)) as any) || {};
    if (!meta.class_teachers) meta.class_teachers = {};

    if (!teacherId || teacherId === "NONE") {
      delete meta.class_teachers[classId];
    } else {
      const teachers = await getTeachersForClassAssignment();
      const teacher = teachers.find((t) => t.id === teacherId);

      meta.class_teachers[classId] = {
        teacher_id: teacherId,
        teacher_name: teacher?.name || "শ্রেণি শিক্ষক",
        teacher_code: teacher?.staff_id_code || "",
        teacher_designation: teacher?.designation || "মুদাররিস",
        teacher_phone: teacher?.phone || "",
        assigned_at: new Date().toISOString(),
        assigned_by: user.email || "অ্যাডমিন",
      };
    }

    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath("/dashboard/classes");
    revalidatePath("/dashboard/academic");
    revalidatePath("/dashboard/staff");

    return { success: true };
  } catch (err: any) {
    console.error("Error assigning class teacher:", err);
    return { error: err.message || "শ্রেণি শিক্ষক নির্ধারণে ত্রুটি হয়েছে।" };
  }
}

export async function createClass(prevState: any, formData: FormData) {
  try {
    const supabase = await createClient();
    const adminClient = await createAdminClient();

    let madrasaId = "";
    try {
      const user = await getAuthUser(supabase);
      if (user) {
        const { getAuthMadrasaId } = await import("./students");
        madrasaId = (await getAuthMadrasaId(supabase, user)) || "";
      }
    } catch (e) {
      console.warn("Could not get user madrasa:", e);
    }

    if (!madrasaId) {
      const { data: anyMadrasa } = await adminClient.from("madrasas").select("id").limit(1).single();
      madrasaId = anyMadrasa?.id || "";
    }

    if (!madrasaId) {
      return { error: "কোনো মাদরাসা খুঁজে পাওয়া যায়নি।" };
    }

    const name = (formData.get("name") as string)?.trim();
    const description = (formData.get("description") as string)?.trim();
    const sequenceVal = formData.get("sequence") ? parseInt(formData.get("sequence") as string, 10) : 0;
    const classTeacherId = (formData.get("class_teacher_id") as string)?.trim();

    if (!name) {
      return { error: "জামাতের নাম আবশ্যক।" };
    }

    const formattedDescription = formatClassDescription(sequenceVal, description);

    // Insert class
    const { data: newClassData, error: userError } = await supabase
      .from("classes")
      .insert({
        madrasa_id: madrasaId,
        name,
        description: formattedDescription,
      })
      .select("id")
      .single();

    let createdClassId = newClassData?.id;

    if (userError || !createdClassId) {
      const { data: adminCreated, error: adminError } = await adminClient
        .from("classes")
        .insert({
          madrasa_id: madrasaId,
          name,
          description: formattedDescription,
        })
        .select("id")
        .single();

      if (adminError) {
        return { error: userError?.message || adminError.message };
      }
      createdClassId = adminCreated?.id;
    }

    // If a class teacher is selected, record in metadata
    if (createdClassId && classTeacherId && classTeacherId !== "NONE") {
      await assignClassTeacher(createdClassId, classTeacherId);
    }

    revalidatePath("/dashboard/classes");
    revalidatePath("/dashboard/academic");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "সার্ভার এরর হয়েছে।" };
  }
}

export async function updateClass(
  classId: string,
  name: string,
  description: string,
  sequence?: number,
  classTeacherId?: string | null
) {
  try {
    const supabase = await createClient();
    const adminClient = await createAdminClient();

    const trimmedName = name.trim();
    if (!trimmedName) {
      return { error: "জামাতের নাম আবশ্যক।" };
    }

    const seqVal = sequence !== undefined ? sequence : 0;
    const formattedDescription = formatClassDescription(seqVal, description.trim());

    const { error: userError } = await supabase
      .from("classes")
      .update({
        name: trimmedName,
        description: formattedDescription,
      })
      .eq("id", classId);

    if (userError) {
      const { error: adminError } = await adminClient
        .from("classes")
        .update({
          name: trimmedName,
          description: formattedDescription,
        })
        .eq("id", classId);

      if (adminError) {
        return { error: userError?.message || adminError.message };
      }
    }

    // Update class teacher if provided
    if (classTeacherId !== undefined) {
      await assignClassTeacher(classId, classTeacherId);
    }

    revalidatePath("/dashboard/classes");
    revalidatePath("/dashboard/academic");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "সার্ভার এরর হয়েছে।" };
  }
}

export async function deleteClass(classId: string) {
  try {
    const supabase = await createClient();
    const adminClient = await createAdminClient();

    const { error: userError } = await supabase
      .from("classes")
      .delete()
      .eq("id", classId);

    if (userError) {
      const { error: adminError } = await adminClient
        .from("classes")
        .delete()
        .eq("id", classId);

      if (adminError) {
        return { error: userError?.message || adminError.message };
      }
    }

    // Clean up class teacher from metadata
    try {
      const user = await getAuthUser(supabase);
      if (user) {
        const { getAuthMadrasaId } = await import("./students");
        const madrasaId = await getAuthMadrasaId(supabase, user);
        if (madrasaId) {
          const meta = ((await getMadrasaMetadata(madrasaId)) as any) || {};
          if (meta.class_teachers && meta.class_teachers[classId]) {
            delete meta.class_teachers[classId];
            await saveMadrasaMetadata(madrasaId, meta);
          }
        }
      }
    } catch (cleanErr) {
      console.warn("Class metadata delete warning:", cleanErr);
    }

    revalidatePath("/dashboard/classes");
    revalidatePath("/dashboard/academic");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "সার্ভার এরর হয়েছে।" };
  }
}

// Update sequence ordering for classes
export async function updateClassSequences(sequences: { id: string; sequence: number }[]) {
  try {
    const supabase = await createClient();
    const adminClient = await createAdminClient();

    for (const item of sequences) {
      let currentDesc = "";
      const { data: clsUser } = await supabase
        .from("classes")
        .select("description")
        .eq("id", item.id)
        .single();

      if (clsUser) {
        currentDesc = clsUser.description || "";
      } else {
        const { data: clsAdmin } = await adminClient
          .from("classes")
          .select("description")
          .eq("id", item.id)
          .single();
        currentDesc = clsAdmin ? clsAdmin.description : "";
      }

      const { actualDescription } = parseClassDescription(currentDesc);
      const newFormattedDescription = formatClassDescription(item.sequence, actualDescription);

      const { error: userError } = await supabase
        .from("classes")
        .update({ description: newFormattedDescription })
        .eq("id", item.id);

      if (userError) {
        const { error: adminError } = await adminClient
          .from("classes")
          .update({ description: newFormattedDescription })
          .eq("id", item.id);
        if (adminError) {
          console.error(`Error updating sequence for class ${item.id}:`, userError || adminError);
        }
      }
    }

    revalidatePath("/dashboard/classes");
    revalidatePath("/dashboard/academic");
    return { success: true };
  } catch (err: any) {
    console.error("Exception in updateClassSequences:", err);
    return { error: err.message || "ক্রম সংরক্ষণ করা যায়নি।" };
  }
}

// Get student list by class ID
export async function getStudentsByClass(classId: string) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase
      .from("students")
      .select("id, first_name, last_name, roll_number, father_name")
      .eq("class_id", classId)
      .order("roll_number", { ascending: true });

    if (!userError && userData) {
      return userData;
    }

    const adminClient = await createAdminClient();
    const { data: adminData } = await adminClient
      .from("students")
      .select("id, first_name, last_name, roll_number, father_name")
      .eq("class_id", classId)
      .order("roll_number", { ascending: true });

    return adminData || [];
  } catch (err) {
    console.error("Exception in getStudentsByClass:", err);
    return [];
  }
}

// Promote students to another class
export async function promoteStudents(studentIds: string[], nextClassId: string | null) {
  try {
    if (!studentIds || studentIds.length === 0) {
      return { error: "কোনো শিক্ষার্থী নির্বাচন করা হয়নি।" };
    }

    const supabase = await createClient();
    const adminClient = await createAdminClient();
    const targetClassId = nextClassId === "graduated" ? null : nextClassId;

    const { error: userError } = await supabase
      .from("students")
      .update({ class_id: targetClassId })
      .in("id", studentIds);

    if (userError) {
      const { error: adminError } = await adminClient
        .from("students")
        .update({ class_id: targetClassId })
        .in("id", studentIds);

      if (adminError) {
        console.error("Error promoting students:", userError || adminError);
        return { error: userError?.message || adminError.message || "প্রমোশন ব্যর্থ হয়েছে।" };
      }
    }

    revalidatePath("/dashboard/classes");
    revalidatePath("/dashboard/students");
    revalidatePath("/dashboard/academic");
    return { success: true };
  } catch (err: any) {
    console.error("Exception in promoteStudents:", err);
    return { error: err.message || "সার্ভার এরর হয়েছে।" };
  }
}
