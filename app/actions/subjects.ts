"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getSubjects() {
  try {
    const adminClient = await createAdminClient();
    const { data, error } = await adminClient
      .from("subjects")
      .select("*")
      .order("name");

    if (error) {
      console.error("Error fetching subjects with admin client:", error);
      const supabase = await createClient();
      const { data: userFetchData } = await supabase
        .from("subjects")
        .select("*")
        .order("name");
      return userFetchData || [];
    }
    return data || [];
  } catch (err) {
    console.error("Exception in getSubjects:", err);
    return [];
  }
}

export async function createSubject(prevState: any, formData: FormData) {
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
      return { error: "কোনো মাদরাসা পাওয়া যায়নি।" };
    }

    const name = (formData.get("name") as string)?.trim();
    const code = (formData.get("code") as string)?.trim();
    const description = (formData.get("description") as string)?.trim();

    if (!name) {
      return { error: "বিষয়ের নাম আবশ্যক।" };
    }

    const { error } = await adminClient.from("subjects").insert({
      madrasa_id: madrasaId,
      name,
      code,
      description,
    });

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/dashboard/subjects");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "সার্ভার এরর হয়েছে।" };
  }
}

export async function deleteSubject(subjectId: string) {
  try {
    const adminClient = await createAdminClient();
    const { error } = await adminClient
      .from("subjects")
      .delete()
      .eq("id", subjectId);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/dashboard/subjects");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "সার্ভার এরর হয়েছে।" };
  }
}
