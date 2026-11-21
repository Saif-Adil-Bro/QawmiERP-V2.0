import { toDhakaDateString, toDhakaDateStringFrom } from "@/lib/date-utils";

export const HEALTH_ROLES = [
  "super_admin",
  "muhtamim",
  "naib_muhtamim",
  "admin",
  "hostel_manager",
  "teacher",
  "office_staff",
];
export const severities = ["mild", "moderate", "severe", "critical"] as const;
export const statuses = [
  "observing",
  "under_treatment",
  "hospitalized",
  "home_rest",
  "recovered",
] as const;
export type Severity = (typeof severities)[number];
export type HealthStatus = (typeof statuses)[number];
export const severityLabel: Record<Severity, string> = {
  mild: "মৃদু",
  moderate: "মাঝারি",
  severe: "গুরুতর",
  critical: "অতি জরুরি",
};
export const statusLabel: Record<HealthStatus, string> = {
  observing: "পর্যবেক্ষণে",
  under_treatment: "চিকিৎসাধীন",
  hospitalized: "হাসপাতালে ভর্তি",
  home_rest: "বাড়িতে বিশ্রাম",
  recovered: "সুস্থ",
};
export const illnessTypes = [
  "জ্বর",
  "সর্দি-কাশি",
  "পেটের পীড়া",
  "চর্মরোগ",
  "আঘাত/চোট",
  "শ্বাসকষ্ট",
  "অন্যান্য",
];
export type HealthChannel = "sms" | "whatsapp" | "push";
export type HealthStudent = {
  id: string;
  name: string;
  class_id: string | null;
  class_name: string;
  roll_number: string;
  student_id_code: string;
  photo_url: string;
  guardian_name: string;
  parent_phone: string;
};
export type ClinicalState = { status: HealthStatus; severity: Severity };
export interface HealthRecord extends ClinicalState {
  id: string;
  madrasa_id: string;
  student_id: string;
  class_id: string | null;
  illness_type: string;
  symptoms: string;
  treatment_notes: string;
  doctor_or_hospital: string | null;
  boarding_diet_note: string | null;
  guardian_notified_at: string | null;
  guardian_acknowledged_at: string | null;
  reported_by: string;
  reported_at: string;
  updated_at: string;
  recovered_at: string | null;
}
export interface TimelineEntry extends ClinicalState {
  id: string;
  record_id: string;
  madrasa_id: string;
  note: string;
  temperature: string | null;
  treatment_notes: string;
  logged_by: string;
  created_at: string;
}
export interface HealthCase extends HealthRecord {
  timeline: TimelineEntry[];
}
export interface StaffCase extends HealthCase {
  student: HealthStudent;
}
export type PortalCase = Pick<
  HealthCase,
  | "id"
  | "student_id"
  | "illness_type"
  | "severity"
  | "status"
  | "doctor_or_hospital"
  | "treatment_notes"
  | "updated_at"
  | "recovered_at"
  | "guardian_acknowledged_at"
> & {
  timeline: Pick<
    TimelineEntry,
    "id" | "status" | "note" | "temperature" | "treatment_notes" | "created_at"
  >[];
};
export type WidgetCase = Pick<
  StaffCase,
  "id" | "status" | "severity" | "illness_type"
> &
  Pick<HealthStudent, "name" | "class_name" | "roll_number">;
export type HealthWidgetData = {
  active: number;
  urgent: number;
  cases: WidgetCase[];
};
export type HealthFilters = {
  classId?: string;
  status?: HealthStatus | "active" | "urgent";
  severity?: Severity;
  search?: string;
};
export type CreateHealth = ClinicalState & {
  student_id: string;
  illness_type: string;
  symptoms: string;
  temperature?: string;
  treatment_notes?: string;
  doctor_or_hospital?: string;
  boarding_diet_note?: string;
  notifyGuardian?: boolean;
};
export type Followup = Partial<ClinicalState> & {
  note: string;
  temperature?: string;
  treatment_notes?: string;
  boarding_diet_note?: string;
  notifyGuardian?: boolean;
  expectedUpdatedAt?: string;
};
export type HealthResult<T> =
  | { ok: true; data: T; warning?: string }
  | { ok: false; error: string };
export function urgent(s: ClinicalState) {
  return (
    s.status !== "recovered" &&
    (s.severity === "severe" ||
      s.severity === "critical" ||
      s.status === "hospitalized")
  );
}
export function priority(s: ClinicalState) {
  return (urgent(s) ? 10 : 0) + severities.indexOf(s.severity);
}
export function healthStats(records: HealthRecord[], now = new Date()) {
  const active = records.filter((r) => r.status !== "recovered");
  const count = (rows: HealthRecord[]) =>
    new Set(rows.map((r) => r.student_id)).size;
  return {
    active: count(active),
    urgent: count(active.filter(urgent)),
    recovered: count(
      records.filter(
        (r) =>
          r.status === "recovered" &&
          toDhakaDateStringFrom(r.recovered_at) === toDhakaDateString(now),
      ),
    ),
    pending: count(
      active.filter(
        (r) => !r.guardian_notified_at && !r.guardian_acknowledged_at,
      ),
    ),
  };
}
export function guardianMessage(
  name: string,
  illness: string,
  state: ClinicalState,
) {
  const greeting = `সম্মানিত অভিভাবক, আসসালামু আলাইকুম। `;
  if (state.status === "recovered")
    return (
      greeting +
      `আলহামদুলিল্লাহ, ${name} এখন সুস্থ। বিস্তারিত স্বাস্থ্য আপডেট অভিভাবক পোর্টালে দেখতে পারবেন।`
    );
  const info = `${name} ${illness} নিয়ে বর্তমানে ${statusLabel[state.status]}। `;
  return (
    greeting +
    info +
    (urgent(state)
      ? "অনুগ্রহ করে এখনই মাদরাসায় যোগাযোগ করুন। প্রয়োজনে সন্তানকে নিতে আসার ব্যবস্থা করুন।"
      : "আমরা তাঁর অবস্থার খোঁজ রাখছি। বিস্তারিত জানতে পোর্টাল দেখুন অথবা মাদরাসায় যোগাযোগ করুন।")
  );
}
export function recentRecovery(
  r: Pick<HealthRecord, "status" | "recovered_at">,
  now = Date.now(),
) {
  const age = now - Date.parse(r.recovered_at || "");
  return r.status === "recovered" && age >= 0 && age < 48 * 3600_000;
}
export function searchStudent(s: HealthStudent, term: string) {
  const norm = (v: string) =>
    v
      .normalize("NFC")
      .toLowerCase()
      .replace(/[০-৯]/g, (n) => String("০১২৩৪৫৬৭৮৯".indexOf(n)));
  return norm(`${s.name} ${s.roll_number} ${s.student_id_code}`).includes(
    norm(term.trim()),
  );
}
export function filterCases(list: StaffCase[], f: HealthFilters) {
  return list.filter(
    (r) =>
      (!f.classId || r.student.class_id === f.classId) &&
      (!f.severity || r.severity === f.severity) &&
      (!f.status ||
        (f.status === "active"
          ? r.status !== "recovered"
          : f.status === "urgent"
            ? urgent(r)
            : r.status === f.status)) &&
      (!f.search || searchStudent(r.student, f.search)),
  );
}
export function displayTime(ts: string) {
  return new Date(ts).toLocaleString("bn-BD", {
    timeZone: "Asia/Dhaka",
    dateStyle: "medium",
    timeStyle: "short",
  });
}
export function dialable(phone: string) {
  const cleaned = phone
    .replace(/[০-৯]/g, (n) => String("০১২৩৪৫৬৭৮৯".indexOf(n)))
    .replace(/[\s()-]/g, "");
  return /^\+?\d{7,15}$/.test(cleaned) ? cleaned : "";
}
