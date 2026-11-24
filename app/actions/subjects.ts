"use server";

import { writeGuard } from "@/lib/action-authorization";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function normalizeSubjectKey(raw?: string | null): string {
  const s = String(raw || "")
    .normalize("NFC")
    .replace(/\u09AF\u09BC/g, "\u09DF")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (s === "basic english" || s === "বেসিক ইংলিশ" || s === "ইংলিশ" || s === "ইংরেজি") {
    return "english";
  }
  if (s === "gonit" || s === "general math" || s === "সাধারণ গণিত" || s === "গণিত") {
    return "general math";
  }
  return s;
}

export async function getSubjects() {
  try {
    const supabase = await createClient();
    const adminClient = await createAdminClient();
    const user = await getAuthUser(supabase);
    const { getAuthMadrasaId } = await import("./students");
    const madrasaId = user ? await getAuthMadrasaId(supabase, user) : null;

    let rawList: any[] = [];

    if (madrasaId) {
      const { data: scopedData, error: scopedErr } = await adminClient
        .from("subjects")
        .select("*")
        .or(`madrasa_id.eq.${madrasaId},madrasa_id.is.null`)
        .order("name");
      if (!scopedErr && scopedData && scopedData.length > 0) {
        rawList = scopedData;
      }
    }

    if (rawList.length === 0) {
      const { data: userData, error: userError } = await supabase
        .from("subjects")
        .select("*")
        .order("name");
      if (!userError && userData && userData.length > 0) {
        rawList = userData;
      }
    }

    if (rawList.length === 0) {
      const { data: allData, error: allError } = await adminClient
        .from("subjects")
        .select("*")
        .order("name");
      if (!allError && allData && allData.length > 0) {
        rawList = allData;
      }
    }

    // B26 ফিক্স: আলাদা "নাহবেমীর" এবং "কাফিয়া" বিষয় ক্যাটালগে নিশ্চিত করা
    const hasSeparateNahbemir = rawList.some((s) => {
      const n = String(s.name || "").normalize("NFC").replace(/\u09AF\u09BC/g, "\u09DF").trim();
      return n === "নাহবেমীর";
    });
    const hasSeparateKafiya = rawList.some((s) => {
      const n = String(s.name || "").normalize("NFC").replace(/\u09AF\u09BC/g, "\u09DF").trim();
      return n === "কাফিয়া";
    });

    if (rawList.length > 0 && (!hasSeparateNahbemir || !hasSeparateKafiya)) {
      try {
        if (!hasSeparateNahbemir) {
          const { data: insNah } = await adminClient
            .from("subjects")
            .insert({
              ...(madrasaId ? { madrasa_id: madrasaId } : {}),
              name: "নাহবেমীর",
              code: "NAH",
              description: "ইলমুন নাহু-এর প্রাথমিক কিতাব ও বাক্য বিশ্লেষণ",
            })
            .select("*")
            .maybeSingle();
          if (insNah) rawList.push(insNah);
        }
        if (!hasSeparateKafiya) {
          const { data: insKaf } = await adminClient
            .from("subjects")
            .insert({
              ...(madrasaId ? { madrasa_id: madrasaId } : {}),
              name: "কাফিয়া",
              code: "KAF",
              description: "উচ্চতর ইলমুন নাহু ও আরবি ব্যাকরণ",
            })
            .select("*")
            .maybeSingle();
          if (insKaf) rawList.push(insKaf);
        }
      } catch {
        // non-fatal if DB insert fails
      }
    }

    // B04 ফিক্স: ডুপ্লিকেট বিষয় (যেমন Practical দুইবার, English/Basic English, Gonit/General Math) একীভূত করা
    // তবে বর্তমান মাদরাসার নিজস্ব রেকর্ড থাকলে তাকে অগ্রাধিকার দেওয়া
    const sorted = [...rawList].sort((a, b) => {
      const aOwn = madrasaId && a.madrasa_id === madrasaId ? 0 : 1;
      const bOwn = madrasaId && b.madrasa_id === madrasaId ? 0 : 1;
      if (aOwn !== bOwn) return aOwn - bOwn;
      const aHasMeta = (a.code ? 1 : 0) + (a.description ? 1 : 0);
      const bHasMeta = (b.code ? 1 : 0) + (b.description ? 1 : 0);
      return bHasMeta - aHasMeta;
    });

    const seenKeys = new Set<string>();
    const deduped: any[] = [];
    for (const item of sorted) {
      const key = normalizeSubjectKey(item.name);
      if (!key || seenKeys.has(key)) continue;
      seenKeys.add(key);
      deduped.push(item);
    }

    return deduped.sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "bn"),
    );
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
