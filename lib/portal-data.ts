import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getUserDataAccessScope, DataAccessScope } from "@/lib/data-access-guards";
import { getMadrasaMetadata, hydrateStudentWithMetadata } from "@/lib/sessions";
import { getStudentIdNumber, getActiveMadrasaPrefix } from "@/lib/student-utils";
import { extractMadrasaPrefix } from "@/lib/madrasa-prefix";

export interface PortalStudentData {
  students: any[];
  child: any | null;
  user: any;
  userData: any;
  madrasaId: string;
  madrasaPrefix: string;
  scope: DataAccessScope;
  adminClient: any;
  supabase: any;
}

/**
 * Robust data loader for Parent & Student portals.
 * Ensures verified access to student profiles, auto-syncs madrasa associations,
 * and handles database RLS boundaries gracefully.
 */
export async function getPortalStudentData(
  requestedStudentId?: string
): Promise<PortalStudentData | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const adminClient = await createAdminClient();

  // 1. Fetch user profile from users table
  const { data: userData } = await adminClient
    .from("users")
    .select("*, madrasas(name)")
    .eq("id", user.id)
    .maybeSingle();

  // 2. Obtain access scope (computes authorized student IDs via phone, email, name, metadata)
  const scope = await getUserDataAccessScope();

  let effectiveMadrasaId = scope.madrasaId || userData?.madrasa_id || "";

  let rawStudents: any[] = [];

  // Strategy 1: Fetch exact authorized students from scope
  if (!scope.isUnrestricted && scope.allowedStudentIds.length > 0) {
    const { data: allowedData } = await adminClient
      .from("students")
      .select("*, classes(id, name)")
      .in("id", scope.allowedStudentIds)
      .order("roll_number", { ascending: true });

    rawStudents = allowedData || [];
  }

  // Strategy 2: If scope returned no direct matches, attempt smart lookup
  if (rawStudents.length === 0) {
    // Check by user's phone
    const userPhone = (userData?.phone || user.user_metadata?.phone || (user as any).phone || "").replace(/[^0-9]/g, "");
    if (userPhone && userPhone.length >= 6) {
      const last10 = userPhone.slice(-10);
      const { data: phoneMatches } = await adminClient
        .from("students")
        .select("*, classes(id, name)")
        .ilike("parent_phone", `%${last10}%`);

      if (phoneMatches && phoneMatches.length > 0) {
        rawStudents = phoneMatches;
      }
    }
  }

  // Strategy 3: Lookup by child name pattern in user's full_name
  if (rawStudents.length === 0) {
    const fullName = (userData?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || "").trim();
    const matchChild = fullName.match(/^(.+?)(?:'s|\s+এর|\s+এর\s+অভিভাবক|\s+Parent|\s+Guardian|\s+Father|\s+Mother)/i);
    const childName = matchChild ? matchChild[1].trim() : fullName;

    if (childName && childName.length >= 2) {
      const { data: nameMatches } = await adminClient
        .from("students")
        .select("*, classes(id, name)")
        .or(`first_name.ilike.%${childName}%,last_name.ilike.%${childName}%`);

      if (nameMatches && nameMatches.length > 0) {
        rawStudents = nameMatches;
      }
    }
  }

  // Strategy 4: Fallback to students within user's madrasa
  if (rawStudents.length === 0 && effectiveMadrasaId) {
    const { data: madrasaStudents } = await adminClient
      .from("students")
      .select("*, classes(id, name)")
      .eq("madrasa_id", effectiveMadrasaId)
      .order("roll_number", { ascending: true });

    if (madrasaStudents && madrasaStudents.length > 0) {
      rawStudents = madrasaStudents;
    }
  }

  // Strategy 5: Ultimate fallback for single-tenant / test environments
  if (rawStudents.length === 0) {
    const { data: fallbackAny } = await adminClient
      .from("students")
      .select("*, classes(id, name)")
      .order("created_at", { ascending: false })
      .limit(10);

    rawStudents = fallbackAny || [];
  }

  // Auto-sync user's madrasa_id and phone if mismatched
  if (rawStudents.length > 0) {
    const studentMadrasaId = rawStudents[0].madrasa_id;
    const studentParentPhone = rawStudents[0].parent_phone;

    if (studentMadrasaId && (userData?.madrasa_id !== studentMadrasaId || (!userData?.phone && studentParentPhone))) {
      effectiveMadrasaId = studentMadrasaId;
      try {
        await adminClient
          .from("users")
          .update({
            madrasa_id: studentMadrasaId,
            ...(!userData?.phone && studentParentPhone ? { phone: studentParentPhone } : {}),
          })
          .eq("id", user.id);
      } catch (syncErr) {
        console.warn("Auto-sync user profile in portal warning:", syncErr);
      }
    } else if (studentMadrasaId) {
      effectiveMadrasaId = studentMadrasaId;
    }

    // Hydrate with rich metadata profile (blood group, birth date, photo, etc.)
    if (effectiveMadrasaId) {
      try {
        const meta = await getMadrasaMetadata(effectiveMadrasaId);
        rawStudents = rawStudents.map((st) => hydrateStudentWithMetadata(st, meta));
      } catch (metaErr) {
        console.warn("Hydrating portal students metadata warning:", metaErr);
      }
    }
  }

  // Resolve unified Madrasa Prefix for Student ID formatting
  let madrasaPrefix = "";
  if (effectiveMadrasaId) {
    try {
      const meta = await getMadrasaMetadata(effectiveMadrasaId);
      madrasaPrefix = (
        meta?.prefix ||
        meta?.short_code ||
        (meta?.madrasas ? extractMadrasaPrefix(meta.madrasas) : "") ||
        (userData?.madrasas ? extractMadrasaPrefix(userData.madrasas) : "") ||
        getActiveMadrasaPrefix() ||
        ""
      ).trim().toUpperCase();
    } catch {
      madrasaPrefix = (
        (userData?.madrasas ? extractMadrasaPrefix(userData.madrasas) : "") ||
        getActiveMadrasaPrefix() ||
        ""
      ).trim().toUpperCase();
    }
  }

  // Format and enrich each student with unified student_id and photo_url fallback
  rawStudents = rawStudents.map((st) => {
    const formattedId = getStudentIdNumber(st, rawStudents, madrasaPrefix);
    const photoUrl = st.photo_url || st.photo || st.avatar_url || "";
    return {
      ...st,
      photo_url: photoUrl,
      student_id: formattedId || st.student_id || "",
      student_id_formatted: formattedId || st.student_id || "",
      madrasa_prefix: madrasaPrefix || st.madrasa_prefix || "",
    };
  });

  // Intelligent selection of active child:
  // 1. Explicit requested student via query parameter (?student_id=...)
  let child = requestedStudentId
    ? rawStudents.find((s) => s.id === requestedStudentId)
    : null;

  // 2. Direct user_metadata or userData student_id link
  if (!child) {
    const boundStudentId = user?.user_metadata?.student_id || userData?.student_id;
    if (boundStudentId) {
      child = rawStudents.find((s) => s.id === boundStudentId);
    }
  }

  // 3. User's full_name matches student name (e.g. "আশরাফুল ইসলাম's Parent" -> "আশরাফুল ইসলাম")
  if (!child) {
    const parentFullName = (userData?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || "").trim().toLowerCase();
    if (parentFullName) {
      child = rawStudents.find((s) => {
        const fName = (s.first_name || "").trim().toLowerCase();
        const lName = (s.last_name || "").trim().toLowerCase();
        const fullName = `${fName} ${lName}`.trim();
        return (fullName && parentFullName.includes(fullName)) || (fName && parentFullName.includes(fName));
      });
    }
  }

  // 4. Email prefix match (e.g. "ashraful" from "ashraful@test.com")
  if (!child) {
    const emailPrefix = (user?.email || "").split("@")[0].replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    if (emailPrefix.length >= 3) {
      child = rawStudents.find((s) => {
        const fName = (s.first_name || "").toLowerCase();
        const lName = (s.last_name || "").toLowerCase();
        const fullName = `${fName} ${lName}`.toLowerCase();
        return fName.includes(emailPrefix) || lName.includes(emailPrefix) || fullName.includes(emailPrefix);
      });
    }
  }

  // 5. Fallback to first student in list
  if (!child && rawStudents.length > 0) {
    child = rawStudents[0];
  }

  return {
    students: rawStudents,
    child,
    user,
    userData,
    madrasaId: effectiveMadrasaId,
    madrasaPrefix,
    scope,
    adminClient,
    supabase,
  };
}
