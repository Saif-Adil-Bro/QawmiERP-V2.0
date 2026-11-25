export interface AttendanceTruthSummary {
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  leaveCount: number;
  unmarkedCount: number;
  markedCount: number;
  presentPercentage: number;
  statusByStudentId: Map<string, "Present" | "Absent" | "Late" | "Leave" | "Unmarked">;
}

/**
 * Resolves a student's class name reliably from joined `classes(id, name)`,
 * an optional `classMap`, or `student.class_name`, falling back to `fallback`.
 */
export function resolveStudentClassName(
  student: any,
  classMap?: Map<string, string>,
  fallback = "সাধারণ জামাত"
): string {
  if (!student) return fallback;

  const joined = student.classes;
  if (joined) {
    if (Array.isArray(joined) && joined[0]?.name && String(joined[0].name).trim()) {
      return String(joined[0].name).trim();
    }
    if (typeof joined === "object" && joined.name && String(joined.name).trim()) {
      return String(joined.name).trim();
    }
  }

  if (student.class_id && classMap?.has(String(student.class_id))) {
    const mapped = classMap.get(String(student.class_id));
    if (mapped && mapped.trim()) return mapped.trim();
  }

  const rawClassName = typeof student.class_name === "string" ? student.class_name.trim() : "";
  if (
    rawClassName &&
    rawClassName !== "N/A" &&
    rawClassName !== "null" &&
    rawClassName !== "undefined" &&
    rawClassName !== "সাধারণ জামাত" &&
    rawClassName !== "সাধারণ"
  ) {
    return rawClassName;
  }

  if (rawClassName) {
    return rawClassName;
  }

  return fallback;
}

/**
 * Normalizes a raw attendance status string into one of the canonical values.
 * Saved DB records are the ONLY source of truth:
 * - "Present" -> "Present"
 * - "Absent"  -> "Absent"
 * - "Late"    -> "Late" (NEVER treated as Absent!)
 * - "Leave"   -> "Leave"
 * - Anything else / missing -> "Unmarked" ("হাজিরা বাকি")
 */
export function normalizeAttendanceStatus(
  rawStatus?: string | null
): "Present" | "Absent" | "Late" | "Leave" | "Unmarked" {
  const s = String(rawStatus || "").trim().toLowerCase();
  if (s === "present" || s === "উপস্থিত") return "Present";
  if (s === "absent" || s === "অনুপস্থিত") return "Absent";
  if (s === "late" || s === "বিলম্বে" || s === "দেরি") return "Late";
  if (s === "leave" || s === "ছুটি") return "Leave";
  return "Unmarked";
}

/**
 * Single Source of Truth for roster-scoped attendance counts (N6).
 * - Counts ONLY students present in the active `roster` (ignoring orphan attendance rows for deleted/inactive students).
 * - Never assumes an unmarked student is "Present" or "Absent".
 * - Keeps "Late" strictly separate from "Absent".
 */
export function computeRosterAttendanceTruth(
  roster: Array<{ id: string; [key: string]: any }>,
  records: Array<{ student_id: string; status?: string | null; [key: string]: any }>
): AttendanceTruthSummary {
  const activeRoster = Array.isArray(roster) ? roster.filter((s) => s && s.id) : [];
  const rosterIds = new Set(activeRoster.map((s) => String(s.id)));

  // Latest status wins if duplicate records exist for the same student_id
  const recordStatusMap = new Map<string, "Present" | "Absent" | "Late" | "Leave" | "Unmarked">();
  for (const rec of Array.isArray(records) ? records : []) {
    const sid = String(rec?.student_id || "");
    if (!sid || !rosterIds.has(sid)) continue;
    const normalized = normalizeAttendanceStatus(rec?.status);
    if (normalized !== "Unmarked") {
      recordStatusMap.set(sid, normalized);
    }
  }

  const statusByStudentId = new Map<string, "Present" | "Absent" | "Late" | "Leave" | "Unmarked">();
  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;
  let leaveCount = 0;
  let unmarkedCount = 0;

  for (const student of activeRoster) {
    const sid = String(student.id);
    const status = recordStatusMap.get(sid) || "Unmarked";
    statusByStudentId.set(sid, status);

    if (status === "Present") presentCount++;
    else if (status === "Absent") absentCount++;
    else if (status === "Late") lateCount++;
    else if (status === "Leave") leaveCount++;
    else unmarkedCount++;
  }

  const totalStudents = activeRoster.length;
  const markedCount = presentCount + absentCount + lateCount + leaveCount;
  const presentPercentage =
    totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

  return {
    totalStudents,
    presentCount,
    absentCount,
    lateCount,
    leaveCount,
    unmarkedCount,
    markedCount,
    presentPercentage,
    statusByStudentId,
  };
}

/**
 * N2: A student is 100% present ("শতভাগ উপস্থিত") ONLY when they have at least 1 recorded
 * attendance day AND every recorded day is "Present" (`stats.total > 0 && stats.present === stats.total`).
 * Students with Late or Leave days (even if `absent === 0`) are NOT 100% present.
 */
export function is100PercentPresent(stats?: {
  total?: number | null;
  present?: number | null;
  absent?: number | null;
  late?: number | null;
  leave?: number | null;
} | null): boolean {
  const total = Number(stats?.total || 0);
  const present = Number(stats?.present || 0);
  return total > 0 && present === total;
}

/**
 * Computes consecutive absence streak and monthly absence total for a student.
 * N6: ONLY "Absent" counts as an absence — "Late" or "Unmarked" NEVER count as absent.
 */
export function computeAbsenceStreakAndMonthly(
  history: Array<{ date: string; status?: string | null }>,
  targetDate: string,
  excludeExcusedLeaves = true
): { consecutiveAbsent: number; monthlyAbsent: number } {
  const monthPrefix = String(targetDate || "").slice(0, 7);
  const sorted = [...(Array.isArray(history) ? history : [])].sort((a, b) =>
    String(b.date || "").localeCompare(String(a.date || ""))
  );

  let consecutiveAbsent = 0;
  let monthlyAbsent = 0;
  let streakBroken = false;

  for (const rec of sorted) {
    const status = normalizeAttendanceStatus(rec.status);
    if (String(rec.date || "").startsWith(monthPrefix) && status === "Absent") {
      monthlyAbsent++;
    }

    if (!streakBroken) {
      if (status === "Absent") {
        consecutiveAbsent++;
      } else if (status === "Leave" && excludeExcusedLeaves) {
        continue;
      } else if (status === "Present" || status === "Late" || status === "Leave") {
        streakBroken = true;
      }
    }
  }

  return { consecutiveAbsent, monthlyAbsent };
}
