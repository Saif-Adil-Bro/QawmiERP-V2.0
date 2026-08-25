"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
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
    const adminClient = await createAdminClient();
    const { data, error } = await adminClient
      .from("classes")
      .select("*")
      .order("name");

    if (error) {
      console.error("Error fetching classes with admin client:", error);
      const supabase = await createClient();
      const { data: userFetchData } = await supabase.from("classes").select("*").order("name");
      return processClassesData(userFetchData || []);
    }

    return processClassesData(data || []);
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
    const adminClient = await createAdminClient();

    let madrasaId = "";
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
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

    const { error } = await adminClient.from("classes").insert({
      madrasa_id: madrasaId,
      name,
      description: formattedDescription,
    });

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/dashboard/classes");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "সার্ভার এরর হয়েছে।" };
  }
}

export async function deleteClass(classId: string) {
  try {
    const adminClient = await createAdminClient();
    const { error } = await adminClient
      .from("classes")
      .delete()
      .eq("id", classId);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/dashboard/classes");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "সার্ভার এরর হয়েছে।" };
  }
}

// Update sequence ordering for classes
export async function updateClassSequences(sequences: { id: string; sequence: number }[]) {
  try {
    const adminClient = await createAdminClient();

    for (const item of sequences) {
      const { data: cls } = await adminClient
        .from("classes")
        .select("description")
        .eq("id", item.id)
        .single();
      
      const currentDesc = cls ? cls.description : "";
      const { actualDescription } = parseClassDescription(currentDesc);
      const newFormattedDescription = formatClassDescription(item.sequence, actualDescription);

      const { error } = await adminClient
        .from("classes")
        .update({ description: newFormattedDescription })
        .eq("id", item.id);
      
      if (error) {
        console.error(`Error updating sequence for class ${item.id}:`, error);
      }
    }

    revalidatePath("/dashboard/classes");
    return { success: true };
  } catch (err: any) {
    console.error("Exception in updateClassSequences:", err);
    return { error: err.message || "ক্রম সংরক্ষণ করা যায়নি।" };
  }
}

// Get student list by class ID
export async function getStudentsByClass(classId: string) {
  try {
    const adminClient = await createAdminClient();
    const { data, error } = await adminClient
      .from("students")
      .select("id, first_name, last_name, roll_number, father_name")
      .eq("class_id", classId)
      .order("roll_number", { ascending: true });

    if (error) {
      console.error("Error fetching students with admin client:", error);
      const supabase = await createClient();
      const { data: userFetchData } = await supabase
        .from("students")
        .select("id, first_name, last_name, roll_number, father_name")
        .eq("class_id", classId)
        .order("roll_number", { ascending: true });
      return userFetchData || [];
    }
    return data || [];
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

    const adminClient = await createAdminClient();
    const targetClassId = nextClassId === "graduated" ? null : nextClassId;

    const { error } = await adminClient
      .from("students")
      .update({ class_id: targetClassId })
      .in("id", studentIds);

    if (error) {
      console.error("Error promoting students:", error);
      return { error: error.message || "প্রমোশন ব্যর্থ হয়েছে।" };
    }

    revalidatePath("/dashboard/classes");
    revalidatePath("/dashboard/students");
    return { success: true };
  } catch (err: any) {
    console.error("Exception in promoteStudents:", err);
    return { error: err.message || "সার্ভার এরর হয়েছে।" };
  }
}
