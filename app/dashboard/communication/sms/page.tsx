import { createClient } from "@/lib/supabase/server";
import { getSMSTemplates, getSMSGatewayConfig } from "@/app/actions/communication";
import { getMadrasaDetails } from "@/app/actions/tenant";
import { getStudents, getClasses } from "@/app/actions/students";
import SMSClient from "./SMSClient";

export const metadata = {
  title: "এসএমএস ও নোটিফিকেশন সিস্টেম | QawmiERP",
};

export default async function SMSPage() {
  // 1. Robustly fetch students with admin fallback
  const rawStudents = await getStudents();

  // 2. Robustly fetch classes with admin fallback
  const classes = await getClasses();

  // 3. Fetch Templates
  const templates = await getSMSTemplates();

  // 4. Fetch SMS Gateway Config (Mram, Greenweb, BulkSMS, Custom API)
  const gatewayConfig = await getSMSGatewayConfig();

  // 5. Fetch Madrasa Details
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

  // 6. Fetch Recent SMS Logs
  const supabase = await createClient();
  let logs: any[] = [];
  try {
    const { data } = await supabase
      .from("sms_logs")
      .select("*")
      .order("sent_at", { ascending: false })
      .limit(50);
    logs = data || [];
  } catch (e) {
    logs = [];
  }

  // Format students with all possible phone and name field variations
  const students = (rawStudents || []).map((s: any) => ({
    ...s,
    first_name: s.first_name || "",
    last_name: s.last_name || "",
    name: `${s.first_name || ""} ${s.last_name || ""}`.trim() || s.name || "শিক্ষার্থী",
    roll_number: s.roll_number !== undefined && s.roll_number !== null ? s.roll_number : s.roll ?? "",
    student_id: s.student_id || s.id,
    parent_phone: s.parent_phone || s.phone || s.guardian_phone || s.emergency_contact || "",
    phone: s.parent_phone || s.phone || s.guardian_phone || s.emergency_contact || "",
    father_name: s.father_name || s.guardian_name || "",
    class_name: s.classes?.name || s.class_name || (typeof s.classes === "string" ? s.classes : "সাধারণ জামাত"),
    class_id: s.class_id || s.classes?.id || "",
    monthly_fee: s.monthly_fee || 1200,
    due_amount: s.due_amount || 0,
  }));

  return (
    <SMSClient
      initialStudents={students}
      initialClasses={classes || []}
      initialTemplates={templates}
      initialGatewayConfig={gatewayConfig}
      initialLogs={logs || []}
      madrasaInfo={{
        name: madrasaName,
        phone: madrasaPhone,
      }}
    />
  );
}


