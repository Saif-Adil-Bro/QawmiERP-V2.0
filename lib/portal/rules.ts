import type { AssignmentItem } from "../assignmentTypes";
import type { AcademicHoliday } from "../holidays";

export const studentRoles = [
  "parent",
  "guardian",
  "student",
  "guardian_student",
];
export const teacherRoles = [
  "teacher",
  "hifz_teacher",
  "hifz_supervisor",
  "ustad",
];
export function selected<T extends { id: string }>(
  rows: T[],
  requested?: string | null,
): T | null {
  return (
    (requested ? rows.find((row) => row.id === requested) : rows[0]) ?? null
  );
}

export function linkedIds(
  row: { student_id?: string },
  profile?: { linkedStudentIds?: string[] } | null,
) {
  return [
    ...new Set(
      [row.student_id, ...(profile?.linkedStudentIds ?? [])].filter(
        (id): id is string => !!id,
      ),
    ),
  ];
}

export function realAssignments(items: AssignmentItem[] = []) {
  return items.filter((a) => !a.id.startsWith("asg-seed-"));
}
export function studentHomework(
  items: AssignmentItem[] | undefined,
  student: { id: string; class_id?: string },
) {
  return realAssignments(items).filter(
    (a) =>
      a.status !== "ARCHIVED" &&
      (a.target_type === "STUDENT"
        ? a.student_id === student.id
        : a.target_type === "CLASS" &&
          !!student.class_id &&
          a.class_id === student.class_id),
  );
}
export function holidayApplies(
  h: Pick<AcademicHoliday, "applicable_to" | "applicable_classes">,
  classes: any[],
) {
  if (!h.applicable_to || h.applicable_to === "all") return true;
  if (h.applicable_to === "specific_classes")
    return classes.some((c) => h.applicable_classes?.includes(c.id));
  const labels: Record<string, string[]> = {
    hifz: ["হিফজ", "হিফয"],
    kitab: ["কিতাব"],
    nurani: ["নূরানী", "নুরানি", "মক্তব"],
    najera: ["নাজেরা", "নাযেরা"],
  };
  return classes.some((c) => {
    const department = String(
      c.department || c.department_name || c.name || "",
    ).toLowerCase();
    return (
      department === h.applicable_to ||
      labels[h.applicable_to!]?.some((label) => department.includes(label))
    );
  });
}
export function portalHolidays(items: AcademicHoliday[] = [], classes: any[]) {
  return items
    .filter(
      (h) =>
        !h.is_archived &&
        h.publish_to_portal !== false &&
        holidayApplies(h, classes),
    )
    .map((h) => ({
      ...h,
      portalClassIds:
        h.applicable_to && h.applicable_to !== "all"
          ? classes.filter((c) => holidayApplies(h, [c])).map((c) => c.id)
          : undefined,
    }));
}
export const attendanceStatuses = [
  "Present",
  "Absent",
  "Late",
  "Leave",
] as const;
export function attendanceStats(rows: { status: string }[]) {
  const stats = { present: 0, absent: 0, late: 0, leave: 0, total: 0 };
  for (const { status } of rows)
    if (attendanceStatuses.some((s) => s === status)) {
      stats[status.toLowerCase() as "present" | "absent" | "late" | "leave"]++;
      stats.total++;
    }
  return {
    ...stats,
    percentage: stats.total
      ? Math.round((stats.present * 100) / stats.total)
      : null,
  };
}

export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(d.valueOf()) && d.toISOString().slice(0, 10) === value;
}

export function isLeaveFeedback(f: {
  category?: string;
  action_type?: string;
}) {
  return f.category === "ছুটির আবেদন" || f.action_type === "LEAVE_APPLICATION";
}

// A stored publication record wins over legacy status, including false or a malformed record.
export function published(
  flags: Record<string, any>,
  exam: { id: string; status?: string },
) {
  return Object.hasOwn(flags, exam.id)
    ? flags[exam.id]?.is_published === true
    : exam.status === "Published";
}
