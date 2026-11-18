import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableError } from "@/lib/audit-log";
import { getDhakaYear, toDhakaMonthString } from "@/lib/date-utils";
import { dispatchNotification } from "@/lib/notifications/orchestrator";
import { toBanglaNumber } from "@/lib/numberToBangla";
import { runTrackedCronJob } from "@/lib/automation/cron-auth";

async function getTargetMadrasaIds(madrasaId?: string | null): Promise<string[]> {
  if (madrasaId) return [madrasaId];
  const admin = await createAdminClient();
  const { data } = await admin.from("madrasas").select("id");
  return (data || []).map((m: any) => String(m.id)).filter(Boolean);
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
    if (error && !isMissingTableError(error)) {
      return true;
    }
  } catch {
    // default enabled if table missing
  }
  return true;
}

export async function runMonthlyFeeGenerationCron(opts: {
  madrasaId?: string | null;
  billingPeriod?: string;
  triggerSource?: "cron" | "manual" | "retry";
} = {}) {
  const billingPeriod = opts.billingPeriod || toDhakaMonthString();
  const yearStr = String(getDhakaYear());
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
        const [studentsRes, structuresRes, itemsRes, feeTypesRes, existingFeesRes, sessionsRes] =
          await Promise.all([
            admin
              .from("students")
              .select("id, first_name, last_name, roll_number, class_id, class_name, status")
              .eq("madrasa_id", madrasaId),
            admin
              .from("fee_structures")
              .select("*")
              .eq("madrasa_id", madrasaId)
              .eq("is_active", true),
            admin
              .from("fee_structure_items")
              .select("*")
              .eq("madrasa_id", madrasaId),
            admin
              .from("fee_types")
              .select("*")
              .eq("madrasa_id", madrasaId),
            admin
              .from("student_fees")
              .select("student_id, fee_type_id, billing_period")
              .eq("madrasa_id", madrasaId)
              .eq("billing_period", billingPeriod),
            admin
              .from("academic_sessions")
              .select("id, is_current")
              .eq("madrasa_id", madrasaId),
          ]);

        const students = (studentsRes.data || []).filter(
          (s: any) => !s.status || String(s.status).toUpperCase() === "ACTIVE"
        );
        const structures = structuresRes.data || [];
        const items = itemsRes.data || [];
        const feeTypes = feeTypesRes.data || [];
        const existingSet = new Set(
          (existingFeesRes.data || []).map(
            (f: any) => `${f.student_id}::${f.fee_type_id}::${f.billing_period}`
          )
        );
        const activeSession =
          (sessionsRes.data || []).find((s: any) => s.is_current)?.id ||
          (sessionsRes.data || [])[0]?.id ||
          "default";

        const feeTypeMap = new Map<string, any>();
        for (const ft of feeTypes) feeTypeMap.set(String(ft.id), ft);

        let processedCount = 0;
        let successCount = 0;
        let failedCount = 0;
        let skippedExisting = 0;

        for (const student of students) {
          // Find matching structure items for student's class, or fallback to monthly fee types
          const matchingStructures = structures.filter(
            (st: any) => !st.class_id || String(st.class_id) === String(student.class_id || "")
          );
          const matchingStructureIds = new Set(matchingStructures.map((st: any) => String(st.id)));
          const studentItems = items.filter((it: any) =>
            matchingStructureIds.has(String(it.fee_structure_id))
          );

          const targetFees: Array<{ fee_type_id: string; fee_type_name: string; amount: number }> =
            studentItems.length > 0
              ? studentItems.map((it: any) => {
                  const ft = feeTypeMap.get(String(it.fee_type_id));
                  return {
                    fee_type_id: String(it.fee_type_id),
                    fee_type_name: String(it.fee_type_name || ft?.name || "মাসিক বেতন"),
                    amount: Number(it.amount || ft?.default_amount || 0),
                  };
                })
              : feeTypes
                  .filter(
                    (ft: any) =>
                      ft.is_active !== false &&
                      (!ft.frequency || String(ft.frequency).toUpperCase() === "MONTHLY")
                  )
                  .map((ft: any) => ({
                    fee_type_id: String(ft.id),
                    fee_type_name: String(ft.name || "মাসিক বেতন"),
                    amount: Number(ft.default_amount || 0),
                  }));

          for (const tf of targetFees) {
            if (!tf.fee_type_id || tf.amount <= 0) continue;
            processedCount++;
            const dedupKey = `${student.id}::${tf.fee_type_id}::${billingPeriod}`;
            if (existingSet.has(dedupKey)) {
              skippedExisting++;
              continue;
            }

            const fullName = `${student.first_name || ""} ${student.last_name || ""}`.trim() || "শিক্ষার্থী";
            const { error: insErr } = await admin.from("student_fees").insert({
              madrasa_id: madrasaId,
              session_id: activeSession,
              student_id: student.id,
              student_name: fullName,
              student_roll: student.roll_number || null,
              class_id: student.class_id || null,
              class_name: student.class_name || null,
              fee_type_id: tf.fee_type_id,
              fee_type_name: tf.fee_type_name,
              billing_period: billingPeriod,
              month_name: billingPeriod,
              year: yearStr,
              base_amount: tf.amount,
              discount_amount: 0,
              fine_amount: 0,
              payable_amount: tf.amount,
              paid_amount: 0,
              due_amount: tf.amount,
              status: "UNPAID",
            });

            if (insErr) {
              failedCount++;
            } else {
              successCount++;
              existingSet.add(dedupKey);
            }
          }
        }

        return {
          processedCount,
          successCount,
          failedCount,
          summary: {
            billingPeriod,
            generatedCount: successCount,
            skippedExisting,
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
