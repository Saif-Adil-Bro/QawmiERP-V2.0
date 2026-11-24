export type AttendanceStatusValue = "Present" | "Absent" | "Late" | "Leave";

export interface StudentAttendanceRowState {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  roll_number?: string | number | null;
  class_id?: string | null;
  classes?: any;
  savedStatus: AttendanceStatusValue | null;
  status: AttendanceStatusValue | null;
  isSaved: boolean;
  isHolidayOrWeekend?: boolean;
  [key: string]: any;
}

const VALID_STATUSES = new Set<string>(["Present", "Absent", "Late", "Leave"]);

export function isValidAttendanceStatus(
  val: unknown,
): val is AttendanceStatusValue {
  return typeof val === "string" && VALID_STATUSES.has(val);
}

export function computeSavedAttendanceSummary(
  students: Array<{ savedStatus?: string | null }>,
) {
  let present = 0;
  let absent = 0;
  let late = 0;
  let leave = 0;
  let unmarked = 0;

  for (const s of students || []) {
    const saved = s?.savedStatus || null;
    if (saved === "Present") present += 1;
    else if (saved === "Absent") absent += 1;
    else if (saved === "Late") late += 1;
    else if (saved === "Leave") leave += 1;
    else unmarked += 1;
  }

  return {
    total: (students || []).length,
    present,
    absent,
    late,
    leave,
    unmarked,
  };
}

export function buildAttendanceSavePayload(
  students: Array<{ id: string; status?: string | null }>,
): Array<{ student_id: string; status: AttendanceStatusValue }> {
  const payload: Array<{ student_id: string; status: AttendanceStatusValue }> = [];
  for (const s of students || []) {
    if (s?.id && isValidAttendanceStatus(s.status)) {
      payload.push({
        student_id: s.id,
        status: s.status,
      });
    }
  }
  return payload;
}
