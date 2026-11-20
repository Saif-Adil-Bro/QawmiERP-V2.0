import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "@/app/actions/students";
import { getTeacherAcademicSchedule } from "@/app/actions/teacher_subjects";
import TeacherRoutineViewClient from "./TeacherRoutineViewClient";

export const dynamic = "force-dynamic";

export default async function TeacherPortalRoutine() {
  const supabase = await createClient();
  const adminClient = await createAdminClient();
  const user = await getAuthUser(supabase);
  if (!user) return null;

  let madrasaId = await getAuthMadrasaId(supabase, user);
  if (!madrasaId) {
    const { data: anyM } = await adminClient.from("madrasas").select("id").limit(1).single();
    madrasaId = anyM?.id || "";
  }

  // Find user profile
  const { data: userData } = await adminClient
    .from("users")
    .select("full_name, email, role")
    .eq("id", user.id)
    .maybeSingle();

  // Find teacher in teachers table
  let teacherId = "";
  let teacherName = userData?.full_name || "মুহতারাম উস্তাদ";
  let teacherDesignation = "মুদাররিস";

  const { data: teacherRow } = await adminClient
    .from("teachers")
    .select("id, first_name, last_name, designation, email, phone")
    .eq("madrasa_id", madrasaId)
    .or(`email.eq.${user.email},auth_user_id.eq.${user.id}`)
    .maybeSingle();

  if (teacherRow) {
    teacherId = teacherRow.id;
    teacherName = `${teacherRow.first_name || ""} ${teacherRow.last_name || ""}`.trim() || teacherName;
    teacherDesignation = teacherRow.designation || teacherDesignation;
  }

  const { getMadrasaMetadata } = await import("@/lib/sessions");
  const madrasaMeta = madrasaId ? await getMadrasaMetadata(madrasaId) : null;

  // If not found in teachers table, look up in staff metadata
  if (!teacherId && madrasaMeta) {
    const staffMembers = (madrasaMeta as any)?.staff_members || [];
    const staff = staffMembers.find((s: any) => 
      (user.email && s.contact?.email?.toLowerCase() === user.email.toLowerCase()) ||
      (s.personal?.first_name && userData?.full_name?.includes(s.personal.first_name))
    );
    if (staff) {
      teacherId = staff.id;
      teacherName = staff.personal?.full_name_bn || `${staff.personal?.first_name || ""} ${staff.personal?.last_name || ""}`.trim() || teacherName;
      teacherDesignation = staff.employment?.designation || teacherDesignation;
    }
  }

  // Load comprehensive academic schedule (subjects, in-charge classes, routines)
  const schedule = await getTeacherAcademicSchedule(teacherId || user.id);

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
