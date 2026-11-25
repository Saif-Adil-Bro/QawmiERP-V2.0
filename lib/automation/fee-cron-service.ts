import {getFeeMetadata} from "@/lib/fee-store";
import {billPeriodKey} from '@/lib/finance/bill-period';
import {billingSession} from '@/lib/finance/billing-session';
import {monthlyCharges} from '@/lib/finance/monthly-charges';
import {rows} from "@/lib/portal/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableError, logAuditEvent } from "@/lib/audit-log";
import { toDhakaMonthString } from "@/lib/date-utils";
import { dispatchNotification } from "@/lib/notifications/orchestrator";
import { toBanglaNumber } from "@/lib/numberToBangla";
import { runTrackedCronJob } from "@/lib/automation/cron-auth";

/**
 * DEC-1 Canonical Deduplication Key for monthly fee generation.
 * Ensures a student can never receive duplicate invoices for the same fee type & billing period
 * across automated cron runs, manual triggers, or session transitions.
 */
export function buildMonthlyFeeDedupKey(
  studentId: string,
  feeTypeId: string,
  billingPeriod: string
): string {
  const raw = String(billingPeriod || "").trim();
  const period = /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 7) : billPeriodKey(raw);
  return `${String(studentId).trim()}::${String(feeTypeId).trim()}::${period}`;
}

async function getTargetMadrasaIds(madrasaId?: string | null): Promise<string[]> {
  if (madrasaId) return [madrasaId];
  const admin = await createAdminClient();
  const data = await rows(()=>admin.from("madrasas").select("id"));
  return data.map((m: any) => String(m.id)).filter(Boolean);
}

async function isRuleEnabled(madrasaId: string, ruleKey: string): Promise<boolean> {
  try {
    const admin = await createAdminClient();
    const { data, error } = await admin
      .from("automation_rules")
      .select("is_enabled")
      .eq("madrasa_id", madrasaId)
      .eq("rule_key", ruleKey)
      .maybeSingle();

    if (!error && data) {
      return data.is_enabled !== false;
    }
    if (error && !isMissingTableError(error)) throw error;
  } catch(e) {
    if(!isMissingTableError(e)) throw e;
  }
  return true;
}

export async function runMonthlyFeeGenerationCron(opts: {
  madrasaId?: string | null;
  billingPeriod?: string;
  triggerSource?: "cron" | "manual" | "retry";
} = {}) {
  const billingPeriod = opts.billingPeriod || toDhakaMonthString();
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(billingPeriod)) throw Error("Invalid monthly billing period");
  const yearStr=billingPeriod.slice(0,4);
  const triggerSource = opts.triggerSource || "cron";
  const madrasaIds = await getTargetMadrasaIds(opts.madrasaId);

  const results: any[] = [];

  for (const madrasaId of madrasaIds) {
    const tracked = await runTrackedCronJob<Record<string, unknown>>(
      "monthly_fee_generation",
      madrasaId,
      triggerSource,
      async () => {
        const enabled = await isRuleEnabled(madrasaId, "monthly_fee_generation");
        if (!enabled) {
          return {
            processedCount: 0,
            successCount: 0,
            failedCount: 0,
            summary: { skipped: true, reason: "Rule disabled", billingPeriod },
          };
        }

        const admin = await createAdminClient();
        const [roster, book, activeSession, sqlExistingFees] = await Promise.all([
          rows(() => admin.from("students").select("*").eq("madrasa_id", madrasaId)),
          getFeeMetadata(madrasaId),
          billingSession(admin, madrasaId),
          rows(() =>
            admin
              .from("student_fees")
              .select("student_id, fee_type_id, billing_period, session_id")
              .eq("madrasa_id", madrasaId)
          ),
        ]);
        const students = roster.filter(
          (s) => !s.status || String(s.status).toUpperCase() === "ACTIVE"
        );
        // DEC-1 Strict Deduplication: union of both metadata book.student_fees AND SQL student_fees
        // keyed strictly by (student_id, fee_type_id, normalized billing_period)
        const existingSet = new Set<string>();
        for (const f of book.student_fees || []) {
          if (f?.student_id && f?.fee_type_id && f?.billing_period) {
            existingSet.add(
              buildMonthlyFeeDedupKey(f.student_id, f.fee_type_id, f.billing_period)
            );
          }
        }
        for (const f of sqlExistingFees || []) {
          if (f?.student_id && f?.fee_type_id && f?.billing_period) {
            existingSet.add(
              buildMonthlyFeeDedupKey(f.student_id, f.fee_type_id, f.billing_period)
            );
          }
        }
        let processedCount = 0;
        let successCount = 0;
        let failedCount = 0;
        let skippedExisting = 0;

        for (const student of students) {
          let charges;
          try {
            charges = monthlyCharges(book, student, { sessionId: activeSession, auto: true });
          } catch {
            failedCount++;
            continue;
          }
          for (const { ft, baseAmount, discountAmount, discountReason, payable } of charges) {
            processedCount++;
            const dedupKey = buildMonthlyFeeDedupKey(student.id, ft.id, billingPeriod);
            if (existingSet.has(dedupKey)) {
              skippedExisting++;
              continue;
            }

            const fullName = `${student.first_name || ""} ${student.last_name || ""}`.trim() || "শিক্ষার্থী";
            const id = crypto.randomUUID();
            const after = {
              id,
              fund_id: ft.fund_id,
              fund_name: ft.fund_name,
              madrasa_id: madrasaId,
              session_id: activeSession,
              student_id: student.id,
              student_name: fullName,
              student_roll: student.roll_number || null,
              class_id: student.class_id || null,
              class_name: student.class_name || null,
              fee_type_id: ft.id,
              fee_type_name: ft.name,
              billing_period: billingPeriod,
              month_name: billingPeriod,
              year: yearStr,
              base_amount: baseAmount,
              discount_amount: discountAmount,
              discount_reason: discountReason,
              fine_amount: 0,
              payable_amount: payable,
              paid_amount: 0,
              due_amount: payable,
              status: payable === 0 ? "WAIVED" : "UNPAID",
            };
            const { error: insErr } = await admin.rpc("finance_edit_bills", {
              p_tenant: madrasaId,
              p_changes: [{ id, before: null, after }],
              p_audit: null,
            });

            if (insErr) {
              failedCount++;
            } else {
              successCount++;
              existingSet.add(dedupKey);
            }
          }
        }

        if (successCount > 0 || skippedExisting > 0) {
          await logAuditEvent({
            madrasaId,
            module: "fees",
            action: "AUTOMATION_MONTHLY_FEE_CRON",
            entityType: "student_fees",
            entityId: billingPeriod,
            entityLabel: billingPeriod,
            summary: `মাসিক ফি অটো-জেনারেশন (${triggerSource}): ${billingPeriod}-এ ${successCount}টি নতুন ইনভয়েস তৈরি, ${skippedExisting}টি ডুপ্লিকেট স্কিপ হয়েছে`,
            newValue: {
              billing_period: billingPeriod,
              trigger_source: triggerSource,
              generated_count: successCount,
              skipped_existing: skippedExisting,
              failed_count: failedCount,
              dedup_enabled: true,
            },
          });
        }

        return {
          processedCount,
          successCount,
          failedCount,
          summary: {
            billingPeriod,
            generatedCount: successCount,
            skippedExisting,
            dedupEnabled: true,
            dedupKeyFormat: "student_id::fee_type_id::billing_period",
          },
        };
      }
    );

    results.push({ madrasaId, ...tracked });
  }

  return { billingPeriod, results };
}

export async function runOverdueRemindersCron(opts: {
  madrasaId?: string | null;
  triggerSource?: "cron" | "manual" | "retry";
} = {}) {
  const triggerSource = opts.triggerSource || "cron";
  const madrasaIds = await getTargetMadrasaIds(opts.madrasaId);
  const results: any[] = [];

  for (const madrasaId of madrasaIds) {
    const tracked = await runTrackedCronJob<Record<string, unknown>>(
      "overdue_reminders",
      madrasaId,
      triggerSource,
      async () => {
        const enabled = await isRuleEnabled(madrasaId, "overdue_reminders");
        if (!enabled) {
          return {
            processedCount: 0,
            successCount: 0,
            failedCount: 0,
            summary: { skipped: true, reason: "Rule disabled" },
          };
        }

        const admin = await createAdminClient();
        const [feesRes, studentsRes, madrasaRes] = await Promise.all([
          admin
            .from("student_fees")
            .select("id, student_id, due_amount, billing_period, status")
            .eq("madrasa_id", madrasaId)
            .gt("due_amount", 0)
            .in("status", ["UNPAID", "PARTIAL", "OVERDUE"]),
          admin
            .from("students")
            .select("id, first_name, last_name, roll_number, class_name, parent_phone")
            .eq("madrasa_id", madrasaId),
          admin.from("madrasas").select("name").eq("id", madrasaId).maybeSingle(),
        ]);

        const madrasaName = madrasaRes.data?.name || "কওমি মাদরাসা";
        const studentMap = new Map<string, any>();
        for (const s of studentsRes.data || []) {
          studentMap.set(String(s.id), s);
        }

        const dueByStudent = new Map<string, { totalDue: number; count: number; period: string }>();
        for (const f of feesRes.data || []) {
          const amt = Number(f.due_amount || 0);
          if (amt <= 0) continue;
          const sid = String(f.student_id);
          const curr = dueByStudent.get(sid) || {
            totalDue: 0,
            count: 0,
            period: String(f.billing_period || ""),
          };
          curr.totalDue += amt;
          curr.count += 1;
          dueByStudent.set(sid, curr);
        }

        let processedCount = 0;
        let successCount = 0;
        let failedCount = 0;

        for (const [studentId, dueInfo] of dueByStudent.entries()) {
          if (dueInfo.totalDue <= 0) continue;
          const student = studentMap.get(studentId);
          if (!student) continue;

          processedCount++;
          const fullName =
            `${student.first_name || ""} ${student.last_name || ""}`.trim() || "শিক্ষার্থী";
          const dueBn = toBanglaNumber(dueInfo.totalDue);

          const dispatchRes = await dispatchNotification("fee.overdue", {
            madrasaId,
            recipientStudentId: studentId,
            recipientPhone: student.parent_phone || null,
            subject: "মাসিক ফি বকেয়া রিমাইন্ডার",
            body: `আসসালামু আলাইকুম, ${madrasaName}-এর শিক্ষার্থী {StudentName} (রোল: {RollNumber})-এর মোট {DueAmount} টাকা ফি বকেয়া রয়েছে। অনুগ্রহ করে দ্রুত পরিশোধ করুন।`,
            variables: {
              StudentName: fullName,
              RollNumber: toBanglaNumber(student.roll_number || "১"),
              ClassName: student.class_name || "সাধারণ জামাত",
              DueAmount: dueBn,
              Month: dueInfo.period,
              MadrasaName: madrasaName,
            },
            metadata: {
              studentId,
              totalDue: dueInfo.totalDue,
              unpaidCount: dueInfo.count,
            },
          });

          if (dispatchRes.ok) successCount++;
          else failedCount++;
        }

        return {
          processedCount,
          successCount,
          failedCount,
          summary: {
            studentsWithDue: dueByStudent.size,
            notifiedCount: successCount,
          },
        };
      }
    );

    results.push({ madrasaId, ...tracked });
  }

  return { results };
}
