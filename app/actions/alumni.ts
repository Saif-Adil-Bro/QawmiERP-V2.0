"use server";

import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "@/app/actions/students";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";
import { AlumniMember, getDefaultAlumniSeed } from "@/lib/alumni";
import { revalidatePath } from "next/cache";

export async function getAlumniMembers(filters?: {
  graduation_type?: string;
  occupation_type?: string;
  search?: string;
  mahfil_invite_only?: boolean;
}): Promise<AlumniMember[]> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const madrasaId = await getAuthMadrasaId(supabase, user);

    const safeMadrasaId = madrasaId || "default_madrasa_id";
    const meta = await getMadrasaMetadata(safeMadrasaId);
    let list: AlumniMember[] = meta.alumni || [];

    if (!list || list.length === 0) {
      list = getDefaultAlumniSeed(safeMadrasaId);
      meta.alumni = list;
      await saveMadrasaMetadata(safeMadrasaId, meta);
    }

    if (filters?.graduation_type && filters.graduation_type !== "ALL") {
      list = list.filter((m) => m.graduation_type === filters.graduation_type);
    }

    if (filters?.occupation_type && filters.occupation_type !== "ALL") {
      list = list.filter((m) => m.current_occupation_type === filters.occupation_type);
    }

    if (filters?.mahfil_invite_only) {
      list = list.filter((m) => m.mahfil_invite_preferred);
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter(
        (m) =>
          m.name_bn.toLowerCase().includes(q) ||
          (m.name_en && m.name_en.toLowerCase().includes(q)) ||
          m.phone.includes(q) ||
          m.designation_title.toLowerCase().includes(q) ||
          m.institution_or_org.toLowerCase().includes(q) ||
          (m.district && m.district.toLowerCase().includes(q))
      );
    }

    return list.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  } catch (err) {
    console.error("Error in getAlumniMembers:", err);
    return [];
  }
}

export async function getAlumniMemberById(id: string): Promise<AlumniMember | null> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const madrasaId = await getAuthMadrasaId(supabase, user);

    const safeMadrasaId = madrasaId || "default_madrasa_id";
    const meta = await getMadrasaMetadata(safeMadrasaId);
    const list: AlumniMember[] = meta.alumni || getDefaultAlumniSeed(safeMadrasaId);

    return list.find((m) => m.id === id) || null;
  } catch (err) {
    console.error("Error in getAlumniMemberById:", err);
    return null;
  }
}

export async function saveAlumniMember(
  data: Partial<AlumniMember> & { name_bn: string; phone: string; graduation_type: AlumniMember["graduation_type"] }
): Promise<{ success?: boolean; error?: string; id?: string }> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const madrasaId = await getAuthMadrasaId(supabase, user);

    if (!user) return { error: "অননুমোদিত অনুরোধ।" };

    const safeMadrasaId = madrasaId || "default_madrasa_id";
    const meta = await getMadrasaMetadata(safeMadrasaId);
    let list: AlumniMember[] = meta.alumni || getDefaultAlumniSeed(safeMadrasaId);

    const now = new Date().toISOString();

    if (data.id) {
      // Update existing
      const index = list.findIndex((m) => m.id === data.id);
      if (index === -1) return { error: "ফারিগীন সদস্য পাওয়া যায়নি।" };

      list[index] = {
        ...list[index],
        ...data,
        updated_at: now,
      };
    } else {
      // Create new
      const newMember: AlumniMember = {
        id: `alm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        madrasa_id: safeMadrasaId,
        name_bn: data.name_bn,
        name_en: data.name_en || "",
        graduation_type: data.graduation_type,
        graduation_year_hijri: data.graduation_year_hijri || "১৪৪৬ হিজরি",
        graduation_year_ce: data.graduation_year_ce || "২০২৫",
        phone: data.phone,
        alternative_phone: data.alternative_phone || "",
        email: data.email || "",
        blood_group: data.blood_group || "",
        present_address: data.present_address || "",
        permanent_address: data.permanent_address || "",
        district: data.district || "",
        current_occupation_type: data.current_occupation_type || "OTHER",
        designation_title: data.designation_title || "খেদমতগুজার",
        institution_or_org: data.institution_or_org || "",
        workplace_address: data.workplace_address || "",
        is_active_donor: Boolean(data.is_active_donor),
        mahfil_invite_preferred: data.mahfil_invite_preferred ?? true,
        willing_to_mentor: data.willing_to_mentor ?? true,
        notes_or_achievements: data.notes_or_achievements || "",
        created_at: now,
        updated_at: now,
      };
      list = [newMember, ...list];
    }

    meta.alumni = list;
    const saved = await saveMadrasaMetadata(safeMadrasaId, meta);
    if (!saved) return { error: "তথ্য সংরক্ষণ করা যায়নি।" };

    revalidatePath("/dashboard/alumni");
    return { success: true, id: data.id || list[0].id };
  } catch (err: any) {
    console.error("Error saving alumni member:", err);
    return { error: err?.message || "সার্ভার এরর।" };
  }
}

export async function deleteAlumniMember(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const madrasaId = await getAuthMadrasaId(supabase, user);

    if (!user) return { error: "অননুমোদিত অনুরোধ।" };

    const safeMadrasaId = madrasaId || "default_madrasa_id";
    const meta = await getMadrasaMetadata(safeMadrasaId);
    let list: AlumniMember[] = meta.alumni || getDefaultAlumniSeed(safeMadrasaId);

    meta.alumni = list.filter((m) => m.id !== id);
    await saveMadrasaMetadata(safeMadrasaId, meta);

    revalidatePath("/dashboard/alumni");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "মুছে ফেলা সম্ভব হয়নি।" };
  }
}

export async function toggleArchiveAlumniMember(
  id: string,
  isArchived: boolean
): Promise<{ success?: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const madrasaId = await getAuthMadrasaId(supabase, user);

    if (!user) return { error: "অননুমোদিত অনুরোধ।" };

    const safeMadrasaId = madrasaId || "default_madrasa_id";
    const meta = await getMadrasaMetadata(safeMadrasaId);
    let list: AlumniMember[] = meta.alumni || getDefaultAlumniSeed(safeMadrasaId);

    const member = list.find((m) => m.id === id);
    if (!member) return { error: "সদস্য পাওয়া যায়নি।" };

    member.is_archived = isArchived;
    member.updated_at = new Date().toISOString();

    await saveMadrasaMetadata(safeMadrasaId, meta);
    revalidatePath("/dashboard/alumni");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "আর্কাইভ স্ট্যাটাস পরিবর্তন ব্যর্থ হয়েছে।" };
  }
}

export async function bulkUpdateAlumni(
  ids: string[],
  updates: Partial<AlumniMember>
): Promise<{ success?: boolean; count?: number; error?: string }> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const madrasaId = await getAuthMadrasaId(supabase, user);

    if (!user) return { error: "অননুমোদিত অনুরোধ।" };

    const safeMadrasaId = madrasaId || "default_madrasa_id";
    const meta = await getMadrasaMetadata(safeMadrasaId);
    let list: AlumniMember[] = meta.alumni || getDefaultAlumniSeed(safeMadrasaId);

    const now = new Date().toISOString();
    let updatedCount = 0;

    list = list.map((m) => {
      if (ids.includes(m.id)) {
        updatedCount++;
        return {
          ...m,
          ...updates,
          updated_at: now,
        };
      }
      return m;
    });

    meta.alumni = list;
    await saveMadrasaMetadata(safeMadrasaId, meta);
    revalidatePath("/dashboard/alumni");
    return { success: true, count: updatedCount };
  } catch (err: any) {
    return { error: err?.message || "বাল্ক আপডেট ব্যর্থ হয়েছে।" };
  }
}
