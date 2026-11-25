import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableError } from "@/lib/audit-log";
import { DHAKA_TIME_ZONE, toDhakaDateString } from "@/lib/date-utils";
import { getMadrasaMetadata } from "@/lib/sessions";
import { dispatchNotification } from "@/lib/notifications/orchestrator";
import { toBanglaNumber } from "@/lib/numberToBangla";
import { runTrackedCronJob } from "@/lib/automation/cron-auth";
import { resolveStudentClassName } from "@/lib/attendance-truth";

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
    // default enabled
  }
  return true;
}

function getDhakaWeekdayName(dateStr: string): string {
  const refDate = new Date(`${dateStr}T12:00:00+06:00`);
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: DHAKA_TIME_ZONE,
      weekday: "long",
    }).format(refDate);
  } catch {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[refDate.getUTCDay()];
  }
}

export async function runAbsenceAlertsCron(opts: {
  madrasaId?: string | null;
  date?: string;
  triggerSource?: "cron" | "manual" | "retry";
} = {}) {
  const targetDate = opts.date || toDhakaDateString();
  const triggerSource = opts.triggerSource || "cron";
  const madrasaIds = await getTargetMadrasaIds(opts.madrasaId);
  const results: any[] = [];

  for (const madrasaId of madrasaIds) {
    const tracked = await runTrackedCronJob<Record<string, unknown>>(
      "absence_alerts",
      madrasaId,
      triggerSource,
      async () => {
        const enabled = await isRuleEnabled(madrasaId, "absence_alerts");
        if (!enabled) {
          return {
            processedCount: 0,
            successCount: 0,
            failedCount: 0,
            summary: { skipped: true, reason: "Rule disabled", date: targetDate },
          };
        }

        // Check academic_holidays & weekend_days in Asia/Dhaka
        const meta = await getMadrasaMetadata(madrasaId);
        const holidays = Array.isArray(meta.academic_holidays) ? meta.academic_holidays : [];
        const matchedHoliday = holidays.find(
          (h: any) => !h.is_archived && targetDate >= h.start_date && targetDate <= h.end_date
        );

        const weekendDays: string[] = Array.isArray(meta.weekend_days) && meta.weekend_days.length > 0
          ? meta.weekend_days
          : ["Friday"];
        const currentWeekday = getDhakaWeekdayName(targetDate);
        const isWeekend = weekendDays.includes(currentWeekday);

        if (matchedHoliday || isWeekend) {
          return {
            processedCount: 0,
            successCount: 0,
            failedCount: 0,
            summary: {
              skippedHolidayOrWeekend: true,
              date: targetDate,
              weekday: currentWeekday,
              holidayTitle: matchedHoliday?.title || null,
            },
          };
        }

        const admin = await createAdminClient();
        const [attRes, studentsRes, madrasaRes] = await Promise.all([
          admin
            .from("attendance")
            .select("id, student_id, status, date")
            .eq("madrasa_id", madrasaId)
            .eq("date", targetDate)
            .eq("status", "Absent"),
          admin
            .from("students")
            .select("id, first_name, last_name, roll_number, class_id, class_name, parent_phone, classes(id, name)")
            .eq("madrasa_id", madrasaId),
          admin.from("madrasas").select("name").eq("id", madrasaId).maybeSingle(),
        ]);

        const madrasaName = madrasaRes.data?.name || "কওমি মাদরাসা";
        const studentMap = new Map<string, any>();
        for (const s of studentsRes.data || []) {
          studentMap.set(String(s.id), s);
        }

        let processedCount = 0;
        let successCount = 0;
        let failedCount = 0;

        for (const att of attRes.data || []) {
          if (String(att.status) !== "Absent") continue;
          const student = studentMap.get(String(att.student_id));
          if (!student) continue;

          processedCount++;
          const fullName =
            `${student.first_name || ""} ${student.last_name || ""}`.trim() || "শিক্ষার্থী";

          const dispatchRes = await dispatchNotification("attendance.absent", {
            madrasaId,
            recipientStudentId: String(student.id),
            recipientPhone: student.parent_phone || null,
            subject: "অনুপস্থিতি বিজ্ঞপ্তি",
            body: `আসসালামু আলাইকুম, আপনার সন্তান {StudentName} (রোল: {RollNumber}, জামাত: {ClassName}) আজ ({Date}) {MadrasaName}-এ অনুপস্থিত রয়েছে।`,
            variables: {
              StudentName: fullName,
              RollNumber: toBanglaNumber(student.roll_number || "১"),
              ClassName: resolveStudentClassName(student, undefined, "সাধারণ জামাত"),
              Date: targetDate,
              MadrasaName: madrasaName,
            },
            metadata: {
              studentId: student.id,
              date: targetDate,
              attendanceId: att.id,
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
            date: targetDate,
            skippedHolidayOrWeekend: false,
            absentCount: processedCount,
            notifiedCount: successCount,
          },
        };
      }
    );

    results.push({ madrasaId, ...tracked });
  }

  return { date: targetDate, results };
}
