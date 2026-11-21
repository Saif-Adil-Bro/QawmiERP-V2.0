"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { webIdentity } from "@/lib/portal/identity";
import { acknowledgeLinkedCase } from "@/lib/student-health/portal";
import {
  staffContext,
  workspace,
  healthWidget,
  roster,
  type StaffContext,
} from "@/lib/student-health/staff";
import { findCase, writeVisit, HealthError } from "@/lib/student-health/store";
import { alertFamily, healthAudit } from "@/lib/student-health/alerts";
import {
  statuses,
  severities,
  filterCases,
  type CreateHealth,
  type Followup,
  type HealthChannel,
  type HealthFilters,
  type HealthRecord,
  type HealthResult,
  type TimelineEntry,
} from "@/lib/student-health/model";

const text = z.string().trim().max(2400),
  short = text.max(160),
  required = short.min(1);
const uuid = z.string().uuid(),
  temp = z.string().trim().max(40).optional();
const report = z.object({
  student_id: uuid,
  illness_type: required,
  status: z.enum(statuses).exclude(["recovered"]),
  severity: z.enum(severities),
  symptoms: text,
  temperature: temp,
  treatment_notes: text.optional(),
  doctor_or_hospital: short.optional(),
  boarding_diet_note: text.optional(),
  notifyGuardian: z.boolean().optional(),
});
const visit = z.object({
  status: z.enum(statuses).optional(),
  severity: z.enum(severities).optional(),
  note: text.min(1),
  temperature: temp,
  treatment_notes: text.optional(),
  boarding_diet_note: text.optional(),
  notifyGuardian: z.boolean().optional(),
  expectedUpdatedAt: z.string().max(64).optional(),
});
const alertOptions = z.object({
  expectedUpdatedAt: z.string().max(64).optional(),
  customMessage: text.max(1200).min(1).optional(),
  channels: z
    .array(z.enum(["sms", "whatsapp", "push"]))
    .min(1)
    .max(3)
    .optional(),
});
const filters = z.object({
  classId: uuid.optional(),
  status: z.enum([...statuses, "active", "urgent"]).optional(),
  severity: z.enum(severities).optional(),
  search: short.optional(),
});
function message(e: unknown) {
  if (e instanceof HealthError) return e.message;
  if (e instanceof z.ZodError)
    return "প্রদত্ত তথ্য সঠিক নয়। আবশ্যক ঘর ও লেখার দৈর্ঘ্য যাচাই করুন।";
  // Log only a diagnostic code, never the clinical payload or provider response.
  console.error(
    "Student health request failed",
    (e as { code?: string })?.code || "UNAVAILABLE",
  );
  return "এই মুহূর্তে স্বাস্থ্য নথির কাজটি সম্পন্ন করা যায়নি। সংযোগ যাচাই করে আবার চেষ্টা করুন।";
}
async function action<T>(
  run: () => Promise<{ data: T; warning?: string }>,
): Promise<HealthResult<T>> {
  try {
    return { ok: true, ...(await run()) };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}
function refresh() {
  for (const p of [
    "/dashboard/students/health",
    "/teacher-portal/health",
    "/dashboard",
  ])
    revalidatePath(p);
  revalidatePath("/portal", "layout");
}
async function afterSave(
  c: StaffContext,
  id: string,
  clinicalVersion: string,
  notify?: boolean,
) {
  let warning;
  if (notify)
    try {
      await alertFamily(c, id, ["sms"], undefined, clinicalVersion);
    } catch (e) {
      warning = message(e);
    }
  refresh();
  return { data: { id }, warning };
}
export async function getSickStudentsAction(f?: HealthFilters) {
  return action(async () => {
    const parsed = filters.parse(f || {});
    const { records } = await workspace();
    return {
      data: filterCases(records, parsed).map((r) => ({
        ...r,
        latest_timeline: r.timeline[0] ?? null,
      })),
    };
  });
}
export async function createHealthRecordAction(payload: CreateHealth) {
  return action(async () => {
    const c = await staffContext(),
      p = report.parse(payload);
    const [s] = await roster(c, [p.student_id]);
    if (!s) throw new HealthError("এই মাদরাসায় শিক্ষার্থীকে পাওয়া যায়নি।");
    const time = new Date().toISOString();
    const r: HealthRecord = {
      id: randomUUID(),
      student_id: s.id,
      madrasa_id: c.tenant,
      class_id: s.class_id,
      illness_type: p.illness_type,
      status: p.status,
      severity: p.severity,
      symptoms: p.symptoms,
      treatment_notes: p.treatment_notes || "",
      doctor_or_hospital: p.doctor_or_hospital || null,
      boarding_diet_note: p.boarding_diet_note || null,
      guardian_acknowledged_at: null,
      guardian_notified_at: null,
      reported_by: c.actor,
      reported_at: time,
      updated_at: time,
      recovered_at: null,
    };
    const v: TimelineEntry = {
      id: randomUUID(),
      record_id: r.id,
      madrasa_id: c.tenant,
      status: r.status,
      severity: r.severity,
      note: p.symptoms || "প্রাথমিক স্বাস্থ্য প্রতিবেদন",
      temperature: p.temperature || null,
      treatment_notes: r.treatment_notes,
      logged_by: c.actor,
      created_at: time,
    };
    await writeVisit(c.db, r, v);
    await healthAudit(
      c,
      r.id,
      "STUDENT_HEALTH_REPORTED",
      "শিক্ষার্থীর স্বাস্থ্য নথি খোলা হয়েছে।",
    );
    return afterSave(c, r.id, time, p.notifyGuardian);
  });
}
export async function addHealthFollowupAction(
  recordId: string,
  payload: Followup,
) {
  return action(async () => {
    const c = await staffContext(),
      id = uuid.parse(recordId),
      p = visit.parse(payload),
      old = await findCase(c.db, c.tenant, id),
      { timeline: _, ...base } = old.row;
    if (base.status === "recovered")
      throw new HealthError(
        "এই নথিতে সুস্থতা নিশ্চিত করা হয়েছে। নতুন অসুস্থতার জন্য আলাদা নথি খুলুন।",
      );
    if (p.expectedUpdatedAt && base.updated_at !== p.expectedUpdatedAt)
      throw new HealthError("আরও সাম্প্রতিক তথ্য আছে। রিফ্রেশ করে নিন।");
    const time = new Date(
        Math.max(Date.now(), Date.parse(base.updated_at) + 1),
      ).toISOString(),
      status = p.status ?? base.status;
    const r: HealthRecord = {
      ...base,
      status,
      severity: p.severity ?? base.severity,
      treatment_notes: p.treatment_notes ?? base.treatment_notes,
      boarding_diet_note: p.boarding_diet_note ?? base.boarding_diet_note,
      updated_at: time,
      recovered_at: status === "recovered" ? time : null,
      guardian_notified_at: null,
      guardian_acknowledged_at: null,
    };
    const v: TimelineEntry = {
      id: randomUUID(),
      record_id: id,
      madrasa_id: c.tenant,
      status,
      severity: r.severity,
      note: p.note,
      temperature: p.temperature || null,
      treatment_notes: r.treatment_notes,
      logged_by: c.actor,
      created_at: time,
    };
    await writeVisit(c.db, r, v, old);
    await healthAudit(
      c,
      id,
      "STUDENT_HEALTH_UPDATED",
      "শিক্ষার্থীর স্বাস্থ্য নথি হালনাগাদ হয়েছে।",
    );
    return afterSave(c, id, time, p.notifyGuardian);
  });
}
export async function sendGuardianHealthAlertAction(
  recordId: string,
  options: {
    customMessage?: string;
    channels?: HealthChannel[];
    expectedUpdatedAt?: string;
  } = {},
) {
  return action(async () => {
    const c = await staffContext(),
      p = alertOptions.parse(options);
    const channel = await alertFamily(
      c,
      uuid.parse(recordId),
      [...new Set(p.channels || ["sms" as const])],
      p.customMessage,
      p.expectedUpdatedAt,
    );
    refresh();
    return { data: { channel } };
  });
}
export async function acknowledgeHealthAlertAction(
  recordId: string,
  expectedUpdatedAt?: string,
) {
  return action(async () => {
    const i = await webIdentity();
    if (!i) throw new HealthError("অনুগ্রহ করে আবার লগইন করুন।");
    await acknowledgeLinkedCase(i, uuid.parse(recordId), expectedUpdatedAt);
    refresh();
    return { data: null };
  });
}

/** A mounted native widget refreshes only its own summary, never the plugin bridge or the entire dashboard. */
export async function getSickStudentsWidgetAction(
  tenant: string,
  actor: string,
) {
  if (!uuid.safeParse(tenant).success || !uuid.safeParse(actor).success)
    return null;
  return healthWidget({ tenant, actor });
}
