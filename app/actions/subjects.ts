"use server";

import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getSubjects() {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase
      .from("subjects")
      .select("*")
      .order("name");

    if (!userError && userData && userData.length > 0) {
      return userData;
    }

    const adminClient = await createAdminClient();
    const { data: adminData, error: adminError } = await adminClient
      .from("subjects")
      .select("*")
      .order("name");

    if (!adminError && adminData && adminData.length > 0) {
      return adminData;
    }

    return userData || [];
  } catch (err) {
    console.error("Exception in getSubjects:", err);
    return [];
  }
}

export async function createSubject(prevState: any, formData: FormData) {
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
      return { error: "কোনো মাদরাসা পাওয়া যায়নি।" };
    }

    const name = (formData.get("name") as string)?.trim();
    const code = (formData.get("code") as string)?.trim();
    const description = (formData.get("description") as string)?.trim();

    if (!name) {
      return { error: "বিষয়ের নাম আবশ্যক।" };
    }

    const { error: userError } = await supabase.from("subjects").insert({
      madrasa_id: madrasaId,
      name,
      code,
      description,
    });

    if (!userError) {
      revalidatePath("/dashboard/subjects");
      return { success: true };
    }

    const { error: adminError } = await adminClient.from("subjects").insert({
      madrasa_id: madrasaId,
      name,
      code,
      description,
    });

    if (adminError) {
      return { error: userError?.message || adminError.message };
    }

    revalidatePath("/dashboard/subjects");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "সার্ভার এরর হয়েছে।" };
  }
}

export async function getSubjectById(subjectId: string) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase
      .from("subjects")
      .select("*")
      .eq("id", subjectId)
      .single();

    if (!userError && userData) {
      return userData;
    }

    const adminClient = await createAdminClient();
    const { data: adminData } = await adminClient
      .from("subjects")
      .select("*")
      .eq("id", subjectId)
      .single();

    return adminData || null;
  } catch (err) {
    console.error("Exception in getSubjectById:", err);
    return null;
  }
}

export async function updateSubject(subjectId: string, prevState: any, formData: FormData) {
  try {
    const supabase = await createClient();
    const adminClient = await createAdminClient();

    const name = (formData.get("name") as string)?.trim();
    const code = (formData.get("code") as string)?.trim();
    const description = (formData.get("description") as string)?.trim();

    if (!name) {
      return { error: "বিষয়ের নাম আবশ্যক।" };
    }

    const updatePayload = {
      name,
      code: code || null,
      description: description || null,
      updated_at: new Date().toISOString(),
    };

    const { error: userError } = await supabase
      .from("subjects")
      .update(updatePayload)
      .eq("id", subjectId);

    if (!userError) {
      revalidatePath("/dashboard/subjects");
      revalidatePath("/dashboard/classes");
      return { success: true };
    }

    const { error: adminError } = await adminClient
      .from("subjects")
      .update(updatePayload)
      .eq("id", subjectId);

    if (adminError) {
      return { error: userError?.message || adminError.message };
    }

    revalidatePath("/dashboard/subjects");
    revalidatePath("/dashboard/classes");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "সার্ভার এরর হয়েছে।" };
  }
}

export async function deleteSubject(subjectId: string) {
  try {
    const supabase = await createClient();
    const adminClient = await createAdminClient();

    const { error: userError } = await supabase
      .from("subjects")
      .delete()
      .eq("id", subjectId);

    if (!userError) {
      revalidatePath("/dashboard/subjects");
      return { success: true };
    }

    const { error: adminError } = await adminClient
      .from("subjects")
      .delete()
      .eq("id", subjectId);

    if (adminError) {
      return { error: userError?.message || adminError.message };
    }

    revalidatePath("/dashboard/subjects");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "সার্ভার এরর হয়েছে।" };
  }
}
