"use server";

import { writeGuard } from "@/lib/action-authorization";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

import {
  mergeAndDedupeSubjectCatalog,
  normalizeSubjectKey,
  type SubjectCatalogRow,
} from "@/lib/subject-catalog";

export async function getSubjects() {
  try {
    const supabase = await createClient();
    const adminClient = await createAdminClient();
    const user = await getAuthUser(supabase);
    const { getAuthMadrasaId } = await import("./students");
    const madrasaId = user ? await getAuthMadrasaId(supabase, user) : null;

    const collectedRows: SubjectCatalogRow[] = [];
    const assignedSubjectIds = new Set<string>();
    const catalogTenantIds = new Set<string>();

    const [scopedRes, classesRes, seedMadrasaRes] = await Promise.all([
      adminClient
        .from("subjects")
        .select("*")
        .or(madrasaId ? `madrasa_id.eq.${madrasaId},madrasa_id.is.null` : "madrasa_id.is.null")
        .order("name"),
      madrasaId
        ? adminClient
            .from("classes")
            .select("id")
            .or(`madrasa_id.eq.${madrasaId},madrasa_id.is.null`)
        : Promise.resolve({ data: [] as any[], error: null }),
      adminClient
        .from("madrasas")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1),
    ]);

    if (!scopedRes.error && Array.isArray(scopedRes.data)) {
      collectedRows.push(...scopedRes.data);
    }

    const seedMadrasaId = seedMadrasaRes.data?.[0]?.id;
    if (seedMadrasaId && seedMadrasaId !== madrasaId) {
      catalogTenantIds.add(seedMadrasaId);
    }

    const classIds = (classesRes.data || [])
      .map((c: any) => c?.id)
      .filter(Boolean);

    if (madrasaId || classIds.length > 0) {
      const [classSubRes, teacherSubRes, routineSubRes] = await Promise.all([
        classIds.length > 0
          ? adminClient
              .from("class_subjects")
              .select("subject_id, subjects(*)")
              .in("class_id", classIds)
          : Promise.resolve({ data: [] as any[], error: null }),
        madrasaId
          ? adminClient
              .from("teacher_subjects")
              .select("subject_id, subjects(*)")
              .eq("madrasa_id", madrasaId)
          : Promise.resolve({ data: [] as any[], error: null }),
        madrasaId
          ? adminClient
              .from("routines")
              .select("subject_id, subjects(*)")
              .eq("madrasa_id", madrasaId)
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      for (const linkList of [
        classSubRes.data || [],
        teacherSubRes.data || [],
        routineSubRes.data || [],
      ]) {
        for (const row of linkList) {
          if (row?.subject_id) {
            assignedSubjectIds.add(row.subject_id);
          }
          const sub = Array.isArray(row?.subjects) ? row.subjects[0] : row?.subjects;
          if (sub?.id) {
            collectedRows.push(sub);
            if (sub.madrasa_id && sub.madrasa_id !== madrasaId) {
              catalogTenantIds.add(sub.madrasa_id);
            }
          }
        }
      }
    }

    if (catalogTenantIds.size > 0) {
      const { data: donorSubjects, error: donorErr } = await adminClient
        .from("subjects")
        .select("*")
        .in("madrasa_id", Array.from(catalogTenantIds))
        .order("name");
      if (!donorErr && Array.isArray(donorSubjects)) {
        collectedRows.push(...donorSubjects);
      }
    }

    let merged = mergeAndDedupeSubjectCatalog(collectedRows, {
      madrasaId,
      assignedSubjectIds,
    });

    // Fallback: if catalog still has <= 2 items (e.g. partial 2-row state where seed catalog lives under another row),
    // pull all existing catalog rows non-destructively without mutating any DB rows.
    if (merged.length <= 2) {
      const { data: userData } = await supabase
        .from("subjects")
        .select("*")
        .order("name");
      if (Array.isArray(userData) && userData.length > 0) {
        collectedRows.push(...userData);
      }

      const { data: allData } = await adminClient
        .from("subjects")
        .select("*")
        .order("name");
      if (Array.isArray(allData) && allData.length > 0) {
        collectedRows.push(...allData);
      }

      merged = mergeAndDedupeSubjectCatalog(collectedRows, {
        madrasaId,
        assignedSubjectIds,
      });
    }

    return merged;
  } catch (err) {
    console.error("Exception in getSubjects:", err);
    return [];
  }
}

export async function createSubject(prevState: any, formData: FormData) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("subjects");
    if (!__authz.allowed) return __authz.fallback;
  }

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

    // P2-Fix: first-madrasa fallback সরানো
    if (!madrasaId) {
      return { error: "কোনো মাদরাসা পাওয়া যায়নি।" };
    }

    const name = (formData.get("name") as string)?.trim();
    const code = (formData.get("code") as string)?.trim();
    const description = (formData.get("description") as string)?.trim();

    if (!name) {
      return { error: "বিষয়ের নাম আবশ্যক।" };
    }

    // B04 ফিক্স: দৃশ্যমান সকল বিষয়ের ক্যাটালগের বিপরীতে ডুপ্লিকেট নাম প্রতিরোধ
    const existingSubjects = await getSubjects();
    const targetKey = normalizeSubjectKey(name);
    const duplicate = (existingSubjects || []).find(
      (s: any) => normalizeSubjectKey(s.name) === targetKey,
    );
    if (duplicate) {
      return { error: `"${name}" বিষয়টি ইতিমধ্যেই তালিকায় রয়েছে (${duplicate.name})।` };
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
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("subjects");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const supabase = await createClient();
    const adminClient = await createAdminClient();

    const name = (formData.get("name") as string)?.trim();
    const code = (formData.get("code") as string)?.trim();
    const description = (formData.get("description") as string)?.trim();

    if (!name) {
      return { error: "বিষয়ের নাম আবশ্যক।" };
    }

    const existingSubjects = await getSubjects();
    const targetKey = normalizeSubjectKey(name);
    const duplicate = (existingSubjects || []).find(
      (s: any) => s.id !== subjectId && normalizeSubjectKey(s.name) === targetKey,
    );
    if (duplicate) {
      return { error: `"${name}" বিষয়টি ইতিমধ্যেই তালিকায় রয়েছে (${duplicate.name})।` };
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
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("subjects");
    if (!__authz.allowed) return __authz.fallback;
  }

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
