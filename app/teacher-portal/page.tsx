import { toDhakaDateString } from "@/lib/date-utils";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getEarlyWarningAlerts } from "@/app/actions/early-warning";
import { getTeacherAcademicSchedule } from "@/app/actions/teacher_subjects";
import { getMadrasaMetadata } from "@/lib/sessions";
import TeacherDashboardClient from "./TeacherDashboardClient";

export const dynamic = "force-dynamic";

export default async function TeacherPortalOverview() {
  const supabase = await createClient();
  const adminClient = await createAdminClient();
  const user = await getAuthUser(supabase);

  if (!user) return null;

  const { data: userData } = await adminClient
    .from("users")
    .select("madrasa_id, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  let madrasaId = userData?.madrasa_id;
  if (!madrasaId) {
    const { data: anyM } = await adminClient.from("madrasas").select("id").limit(1).single();
    madrasaId = anyM?.id || "";
  }

  let teacherId = "";
  let teacherName = userData?.full_name || "মুহতারাম উস্তাদ";
  let designation = "মুদাররিস";

  const [{ data: teacher }, madrasaMeta] = await Promise.all([
    adminClient
      .from("teachers")
      .select("id, first_name, last_name, designation, phone")
      .eq("madrasa_id", madrasaId)
      .or(`email.eq.${user.email},auth_user_id.eq.${user.id}`)
      .maybeSingle(),
    madrasaId ? getMadrasaMetadata(madrasaId) : Promise.resolve(null),
  ]);

  if (teacher) {
    teacherId = teacher.id;
    teacherName = `${teacher.first_name || ""} ${teacher.last_name || ""}`.trim() || teacherName;
    designation = teacher.designation || designation;
  }

  if (!teacherId && madrasaMeta) {
    const staffMembers = (madrasaMeta as any)?.staff_members || [];
    const staff = staffMembers.find(
      (s: any) =>
        (user.email && s.contact?.email?.toLowerCase() === user.email.toLowerCase()) ||
        (s.personal?.first_name && userData?.full_name?.includes(s.personal.first_name))
    );
    if (staff) {
      teacherId = staff.id;
      teacherName =
        staff.personal?.full_name_bn ||
        `${staff.personal?.first_name || ""} ${staff.personal?.last_name || ""}`.trim() ||
        teacherName;
      designation = staff.employment?.designation || designation;
    }
  }

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
    getTeacherAcademicSchedule(teacherId || user.id),
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
