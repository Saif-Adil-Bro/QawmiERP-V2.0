import { toDhakaDateString } from "@/lib/date-utils";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getEarlyWarningAlerts } from "@/app/actions/early-warning";
import { getTeacherAcademicSchedule } from "@/app/actions/teacher_subjects";
import { getMadrasaMetadata } from "@/lib/sessions";
import { resolveTeacherIdentityForAuthUser } from "@/lib/teacher-identity";
import TeacherDashboardClient from "./TeacherDashboardClient";

export const dynamic = "force-dynamic";

export default async function TeacherPortalOverview() {
  const supabase = await createClient();
  const adminClient = await createAdminClient();
  const user = await getAuthUser(supabase);

  if (!user) return null;

  const { data: userData } = await adminClient
    .from("users")
    .select("madrasa_id, full_name, email, phone, role")
    .eq("id", user.id)
    .maybeSingle();

  let madrasaId = userData?.madrasa_id || user.user_metadata?.madrasa_id;
  if (!madrasaId) {
    const { data: anyM } = await adminClient.from("madrasas").select("id").limit(1).single();
    madrasaId = anyM?.id || "";
  }

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
  const designation = identity.designation;

  const todayStr = toDhakaDateString();

  const [
    classesRes,
    todayAttendanceRes,
    todayHifzRes,
    noticesRes,
    earlyWarningData,
    teacherSchedule,
  ] = await Promise.all([
    adminClient.from("classes").select("id, name").eq("madrasa_id", madrasaId),
    adminClient.from("attendance").select("id").eq("madrasa_id", madrasaId).eq("date", todayStr),
    adminClient.from("hifz_logs").select("id").eq("madrasa_id", madrasaId).eq("log_date", todayStr),
    adminClient
      .from("notices")
      .select("*")
      .eq("madrasa_id", madrasaId)
      .order("created_at", { ascending: false })
      .limit(3),
    getEarlyWarningAlerts(),
    getTeacherAcademicSchedule(teacherId || user.id, {
      madrasaId,
      candidateIds: identity.candidateIds,
    }),
  ]);

  const activeHolidays = (madrasaMeta?.academic_holidays || [])
    .filter((h) => !h.is_archived && h.publish_to_portal !== false)
    .map((h) => ({
      id: h.id,
      title: h.title,
      start_date: h.start_date,
      end_date: h.end_date,
    }));

  return (
    <TeacherDashboardClient
      teacherId={teacherId || user.id}
      teacherName={teacherName}
      designation={designation}
      todayAttendanceCount={todayAttendanceRes.data?.length || 0}
      todayHifzCount={todayHifzRes.data?.length || 0}
      classes={classesRes.data || []}
      notices={noticesRes.data || []}
      holidays={activeHolidays}
      earlyWarningData={earlyWarningData}
      teacherSchedule={teacherSchedule}
    />
  );
}
