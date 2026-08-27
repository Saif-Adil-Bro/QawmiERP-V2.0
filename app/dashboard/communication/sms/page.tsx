import { createClient } from "@/lib/supabase/server";
import { getSMSTemplates } from "@/app/actions/communication";
import { getMadrasaDetails } from "@/app/actions/tenant";
import { getAuthMadrasaId } from "@/app/actions/students";
import SMSClient from "./SMSClient";

export default async function SMSPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const finalMadrasaId = user ? await getAuthMadrasaId(supabase, user) : null;

  // 1. Fetch Students with their class relations
  let studentsQuery = supabase
    .from("students")
    .select("id, student_id, first_name, last_name, roll_number, parent_phone, father_name, class_id, classes(id, name)")
    .order("first_name");

  if (finalMadrasaId) {
    studentsQuery = studentsQuery.eq("madrasa_id", finalMadrasaId);
  }

  const { data: rawStudents } = await studentsQuery;

  // 2. Fetch Classes
  let classesQuery = supabase.from("classes").select("id, name").order("name");
  if (finalMadrasaId) {
    classesQuery = classesQuery.eq("madrasa_id", finalMadrasaId);
  }
  const { data: classes } = await classesQuery;

  // 3. Fetch Templates
  const templates = await getSMSTemplates();

  // 4. Fetch Madrasa Details
  let madrasaName = "মাদ্রাসাতুল মুসলিমীন";
  let madrasaPhone = "০১৮১২৩৪৫৬৭৮";
  try {
    const madrasa = await getMadrasaDetails();
    if (madrasa?.name) madrasaName = madrasa.name;
    if (madrasa?.contact_phone || madrasa?.phone) {
      madrasaPhone = madrasa.contact_phone || madrasa.phone;
    }
  } catch (e) {
    // fallback
  }

  // 5. Fetch Recent SMS Logs
  let logsQuery = supabase
    .from("sms_logs")
    .select("*")
    .order("sent_at", { ascending: false })
    .limit(50);
  
  if (finalMadrasaId) {
    logsQuery = logsQuery.eq("madrasa_id", finalMadrasaId);
  }
  const { data: logs } = await logsQuery;

  // Format students with class name fallback
  const students = (rawStudents || []).map((s: any) => ({
    ...s,
    class_name: s.classes?.name || "সাধারণ জামাত",
  }));

  return (
    <SMSClient
      initialStudents={students}
      initialClasses={classes || []}
      initialTemplates={templates}
      initialLogs={logs || []}
      madrasaInfo={{
        name: madrasaName,
        phone: madrasaPhone,
      }}
    />
  );
}

