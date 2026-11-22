import { dispatchNotification } from "@/lib/notifications/orchestrator";
import {
  normalizePhoneNumber,
  hasSmsReceipt,
  dispatchSMSGatewayRequest,
  DEFAULT_SMS_GATEWAY_CONFIG,
} from "@/lib/sms-gateway";
import { getMadrasaMetadata } from "@/lib/sessions";
import { readJsonStore } from "@/lib/madrasa-store";
import { rows } from "@/lib/portal/queries";
import { linkedIds } from "@/lib/portal/rules";
import { guardianMessage, type HealthChannel } from "./model";
import { roster, type StaffContext } from "./staff";
import { findCase, stamp, HealthError } from "./store";
import { logAuditEvent } from "@/lib/audit-log";

export async function healthAudit(
  c: StaffContext,
  id: string,
  action: string,
  summary: string,
  channel?: string,
) {
  await logAuditEvent({
    madrasaId: c.tenant,
    actorId: c.actor,
    module: "students",
    entityType: "student_health_record",
    entityId: id,
    action,
    summary,
    metadata: channel ? { channel } : {},
  });
}
// Device registrations can contain a client-supplied student_id. Route private push
// only by a server-verified, active linked guardian USER, never by that device hint.
async function guardianUser(c: StaffContext, student: string) {
  const [users, security] = await Promise.all([
    rows(() => c.db.from("users").select("*").eq("madrasa_id", c.tenant)),
    readJsonStore(c.tenant, "security", true),
  ]);
  return users.find((u) => {
    const p = security.user_security_profiles?.[u.id];
    return (
      (!p?.status || p.status === "ACTIVE") &&
      [u.role, p?.primaryRole, ...(p?.roles || [])].some((r) =>
        ["guardian", "guardian_student", "parent"].includes(r),
      ) &&
      linkedIds(u, p).includes(student)
    );
  })?.id;
}
export async function alertFamily(
  c: StaffContext,
  id: string,
  channels: HealthChannel[],
  customMessage?: string,
  clinicalVersion?: string,
) {
  const found = await findCase(c.db, c.tenant, id),
    r = found.row;
  if (
    clinicalVersion &&
    Date.parse(clinicalVersion) !== Date.parse(r.updated_at)
  )
    throw new HealthError(
      "নতুন স্বাস্থ্য আপডেট এসেছে। বর্তমান নথি দেখে বার্তাটি আবার লিখুন।",
    );
  const [s] = await roster(c, [r.student_id]);
  if (!s) throw new HealthError("শিক্ষার্থীর সংযোগ পাওয়া যায়নি।");
  const phone = normalizePhoneNumber(s.parent_phone);
  const validPhone = /^01[3-9]\d{8}$/.test(phone);
  if (!validPhone && !channels.includes("push"))
    throw new HealthError("অভিভাবকের সঠিক মোবাইল নম্বর সংরক্ষণ করুন।");
  const user = channels.includes("push")
    ? await guardianUser(c, s.id)
    : undefined;
  const allowed = channels.filter((ch) =>
    ch === "push" ? !!user : validPhone,
  );
  if (!allowed.length)
    throw new HealthError("নির্বাচিত মাধ্যমে সংযুক্ত অভিভাবক পাওয়া যায়নি।");
  const body = customMessage || guardianMessage(s.name, r.illness_type, r);
  const result = await dispatchNotification("STUDENT_HEALTH_ALERT", {
    madrasaId: c.tenant,
    recipientUserId: user,
    recipientPhone: phone,
    subject: "মাদরাসা থেকে স্বাস্থ্য আপডেট",
    body,
    channels: allowed,
    confidential: true,
    maxAttempts: 1,
    actorId: c.actor,
  });
  let channel =
    result.ok && result.status === "SENT" ? result.deliveredChannel : undefined;
  // No retry after an uncertain network outcome. Use legacy gateway only when the
  // orchestrator definitively did NOT send an SMS. Never count a simulated send.
  if (
    !channel &&
    result.status === "FAILED" &&
    result.attemptedChannels.some(
      (a) => a.channel === "sms" && a.error === "SMS gateway is not configured",
    )
  ) {
    const meta = await getMadrasaMetadata(c.tenant, true),
      cfg = { ...DEFAULT_SMS_GATEWAY_CONFIG, ...meta.sms_gateway };
    if (
      cfg.isEnabled &&
      cfg.apiEndpoint &&
      (cfg.apiKey || cfg.provider === "custom")
    ) {
      const sent = await dispatchSMSGatewayRequest(cfg, phone, body);
      if (sent.success && hasSmsReceipt(sent.rawResponse)) channel = "sms";
    }
  }
  if (!channel)
    throw new HealthError(
      "বার্তা পাঠানোর নিশ্চয়তা পাওয়া যায়নি। প্রেরণ ব্যবস্থা যাচাই করুন অথবা অভিভাবককে ফোন করুন।",
    );
  await healthAudit(
    c,
    id,
    "GUARDIAN_HEALTH_ALERT_SENT",
    "অভিভাবকের কাছে স্বাস্থ্য আপডেট পাঠানো হয়েছে।",
    channel,
  );
  try {
    await stamp(c.db, found, "guardian_notified_at", c.actor);
  } catch {
    throw new HealthError(
      "বার্তা পাঠানো হয়েছে, কিন্তু এই আপডেটে প্রেরণের সময় সংরক্ষণ করা যায়নি। আবার পাঠানোর আগে নথিটি দেখুন।",
    );
  }
  return channel;
}
