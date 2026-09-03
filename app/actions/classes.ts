"use server";

import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Helper to parse sequence and actual description from a stored description text
function parseClassDescription(description: string | null): { sequence: number; actualDescription: string } {
  if (!description) return { sequence: 0, actualDescription: "" };
  const match = description.match(/^\[seq:(\d+)\]\s*(.*)/);
  if (match) {
    return {
      sequence: parseInt(match[1], 10),
      actualDescription: match[2] || ""
    };
  }
  return { sequence: 0, actualDescription: description };
}

// Helper to format sequence and actual description into description text
function formatClassDescription(sequence: number, actualDescription: string | null): string {
  const cleanDesc = actualDescription ? actualDescription.replace(/^\[seq:\d+\]\s*/, "") : "";
  return `[seq:${sequence}] ${cleanDesc}`;
}

export async function getClasses() {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase
      .from("classes")
      .select("*")
      .order("name");

    if (!userError && userData && userData.length > 0) {
      return processClassesData(userData);
    }

    // Fallback to adminClient if user client returns empty or fails
    const adminClient = await createAdminClient();
    const { data: adminData, error: adminError } = await adminClient
      .from("classes")
      .select("*")
      .order("name");

    if (!adminError && adminData && adminData.length > 0) {
      return processClassesData(adminData);
    }

    if (userData) {
      return processClassesData(userData);
    }

    return [];
  } catch (err) {
    console.error("Exception in getClasses:", err);
    try {
      const supabase = await createClient();
      const { data } = await supabase.from("classes").select("*").order("name");
      return processClassesData(data || []);
    } catch {
      return [];
    }
  }
}

function processClassesData(data: any[]) {
  const classesWithSeq = (data || []).map(cls => {
    const { sequence, actualDescription } = parseClassDescription(cls.description);
    return {
      ...cls,
      sequence,
      description: actualDescription,
    };
  });

  classesWithSeq.sort((a, b) => {
    if (a.sequence !== b.sequence) {
      return a.sequence - b.sequence;
    }
    return (a.name || "").localeCompare(b.name || "");
  });

  return classesWithSeq;
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

    if (!name) {
      return { error: "জামাতের নাম আবশ্যক।" };
    }

    const formattedDescription = formatClassDescription(sequenceVal, description);

    // Try insert via user authenticated client first
    const { error: userError } = await supabase.from("classes").insert({
      madrasa_id: madrasaId,
      name,
      description: formattedDescription,
    });

    if (!userError) {
      revalidatePath("/dashboard/classes");
      revalidatePath("/dashboard/academic");
      return { success: true };
    }

    // Fallback to adminClient if user insert fails
    const { error: adminError } = await adminClient.from("classes").insert({
      madrasa_id: madrasaId,
      name,
      description: formattedDescription,
    });

    if (adminError) {
      console.error("Create class error:", userError || adminError);
      return { error: userError?.message || adminError.message };
    }

    revalidatePath("/dashboard/classes");
    revalidatePath("/dashboard/academic");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "সার্ভার এরর হয়েছে।" };
  }
}

export async function updateClass(classId: string, name: string, description: string, sequence?: number) {
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

    if (!userError) {
      revalidatePath("/dashboard/classes");
      revalidatePath("/dashboard/academic");
      return { success: true };
    }

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

    if (!userError) {
      revalidatePath("/dashboard/classes");
      revalidatePath("/dashboard/academic");
      return { success: true };
    }

    const { error: adminError } = await adminClient
      .from("classes")
      .delete()
      .eq("id", classId);

    if (adminError) {
      return { error: userError?.message || adminError.message };
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
