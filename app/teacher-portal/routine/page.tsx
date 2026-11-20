import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "@/app/actions/students";
import { getTeacherAcademicSchedule } from "@/app/actions/teacher_subjects";
import { resolveTeacherIdentityForAuthUser } from "@/lib/teacher-identity";
import TeacherRoutineViewClient from "./TeacherRoutineViewClient";

export const dynamic = "force-dynamic";

export default async function TeacherPortalRoutine() {
  const supabase = await createClient();
  const adminClient = await createAdminClient();
  const user = await getAuthUser(supabase);
  if (!user) return null;

  // Find user profile first (works reliably even when RLS hides metadata)
  const { data: userData } = await adminClient
    .from("users")
    .select("madrasa_id, full_name, email, phone, role")
    .eq("id", user.id)
    .maybeSingle();

  let madrasaId =
    userData?.madrasa_id ||
    (await getAuthMadrasaId(supabase, user)) ||
    user.user_metadata?.madrasa_id;

  if (!madrasaId) {
    const { data: anyM } = await adminClient.from("madrasas").select("id").limit(1).single();
    madrasaId = anyM?.id || "";
  }

  const { getMadrasaMetadata } = await import("@/lib/sessions");
  const madrasaMeta = madrasaId ? await getMadrasaMetadata(madrasaId) : null;

  const identity = await resolveTeacherIdentityForAuthUser({
    adminClient,
    madrasaId,
    user,
    userData,
    madrasaMeta,
  });

  const teacherId = identity.teacherId;
  const teacherName = identity.teacherName;
  const teacherDesignation = identity.designation;

  // Load comprehensive academic schedule (subjects, in-charge classes, direct routines)
  const schedule = await getTeacherAcademicSchedule(teacherId || user.id, {
    madrasaId,
    candidateIds: identity.candidateIds,
  });

  const activeHolidays = (madrasaMeta?.academic_holidays || [])
    .filter((h) => !h.is_archived && h.publish_to_portal !== false)
    .map((h) => ({
      id: h.id,
      title: h.title,
      start_date: h.start_date,
      end_date: h.end_date,
    }));

  return (
    <TeacherRoutineViewClient
      schedule={schedule}
      holidays={activeHolidays}
      teacherName={teacherName}
      teacherDesignation={teacherDesignation}
    />
  );
}
