import { teacherExamData } from "./teacher-entry";
import {
  linkedStudents,
  teacherScope,
  teacherSchedule,
  teacherStudents,
  hasRole,
  type Identity,
} from "./identity";
import {
  studentRoles,
  teacherRoles,
  studentHomework,
  realAssignments,
  portalHolidays,
} from "./rules";
import { notices, routines, childLogs, rows } from "./queries";
import { portalExams, studentExam } from "./exams";
import { studentLedger } from "./ledger";

export async function portalSnapshot(
  i: Identity,
  portal: "student" | "teacher",
  requested?: string | null,
) {
  if (!hasRole(i, portal === "student" ? studentRoles : teacherRoles))
    return null;
  const profile = {
    id: i.user.id,
    madrasa_id: i.tenant,
    role: i.userRow.role,
    full_name: i.userRow.full_name,
  };
  const base = {
    version: 1,
    portal,
    profile,
    students: [] as any[],
    classes: [] as any[],
    active_student: null as any,
    attendance: [] as any[],
    fees: [] as any[],
    fee_invoices: [] as any[],
    fee_payments: [] as any[],
    fee_discounts: [] as any[],
    exams: [] as any[],
    exam_results: [] as any[],
    exam_summaries: [] as any[],
    hifz_logs: [] as any[],
    kitab_logs: [] as any[],
    notices: [] as any[],
    routines: [] as any[],
    holidays: [] as any[],
    assignments: [] as any[],
  };
  if (portal === "teacher") {
    const s = await teacherScope(i);
    const [schedule, students, news, exams] = await Promise.all([
      teacherSchedule(i, s),
      teacherStudents(i, s),
      notices(
        i.db,
        i.tenant,
        "Teachers",
        s.classes.map((c) => c.id),
        portalHolidays(s.meta.academic_holidays, s.classes),
      ),
      rows(() =>
        i.db
          .from("exams")
          .select("*")
          .eq("madrasa_id", i.tenant)
          .order("start_date", { ascending: false }),
      ),
    ]);
    const ids = students.map((s) => s.id);
    const [attendance, hifz_logs, kitab_logs] = await Promise.all([
      childLogs(i.db, i.tenant, "attendance", ids),
      childLogs(i.db, i.tenant, "hifz_logs", ids),
      childLogs(i.db, i.tenant, "kitab_logs", ids),
    ]);
    const marks: any[] = [],
      subjects: any[] = [];
    for (const exam of exams) {
      const entry = await teacherExamData(i, s, exam, students);
      marks.push(...entry.marks);
      subjects.push(...entry.subjects);
    }
    const teacher = s.teacher || (s.staff ? {id:s.staff.id, name:s.display.name, designation:s.display.designation} : null);
    return {
      ...base,
      exam_results: marks,
      exam_subjects: subjects,
      teacher,
      profile: {
        ...profile,
        teacher,
        exam_subjects: subjects,
        assigned_subjects: schedule.assignedSubjects,
        in_charge_classes: schedule.inChargeClasses,
      },
      assigned_subjects: schedule.assignedSubjects,
      in_charge_classes: schedule.inChargeClasses,
      students,
      classes: s.classes,
      routines: schedule.routines,
      notices: news,
      exams,
      attendance,
      hifz_logs,
      kitab_logs,
      holidays: portalHolidays(s.meta.academic_holidays, s.classes),
      assignments: realAssignments(s.meta.assignments).filter((a) =>
        s.classes.some((c) => c.id === a.class_id),
      ),
    };
  }
  const { students, child, meta } = await linkedStudents(i, requested);
  if (!child) return { ...base, students };
  const ids = [child.id],
    classIds = child.class_id ? [child.class_id] : [];
  const [attendance, hifz_logs, kitab_logs, timetable, news, exams, ledger] =
    await Promise.all([
      childLogs(i.db, i.tenant, "attendance", ids),
      childLogs(i.db, i.tenant, "hifz_logs", ids),
      childLogs(i.db, i.tenant, "kitab_logs", ids),
      routines(i.db, i.tenant, classIds),
      notices(
        i.db,
        i.tenant,
        "Students",
        classIds,
        portalHolidays(
          meta.academic_holidays,
          child.classes ? [child.classes] : [],
        ),
      ),
      portalExams(i.db, i.tenant, meta),
      studentLedger(i.db, i.tenant, child.id, meta),
    ]);
  const results = [],
    summaries = [];
  for (const ex of exams.filter((e) => e.is_published)) {
    const { summary, merit, rawResults } = await studentExam(
      i.db,
      i.tenant,
      ex,
      child.id,
      meta,
    );
    results.push(...rawResults);
    summaries.push({
      id: `${child.id}_${ex.id}`,
      student_id: child.id,
      exam_id: ex.id,
      exam_title: ex.title,
      exam_year: ex.year,
      has_marks: summary.hasMarks,
      is_published: true,
      total_obtained: summary.totalObtained,
      total_max: summary.totalMax,
      percentage: summary.percentage,
      gpa: summary.gpa,
      grade_label: summary.gradeLabel,
      grade_color: summary.gradeColor,
      is_passed: summary.isPassed,
      status_label: summary.statusLabel,
      failed_subject_count: summary.failedSubjectCount,
      subjects: summary.subjects,
      merit_position: merit.meritPosition,
      merit_label: merit.formattedPosition,
      formatted_merit: merit.formattedPosition,
      total_candidates: merit.totalCandidates,
      summary,
      merit,
    });
  }
  const classes = child.classes ? [child.classes] : [];
  return {
    ...base,
    students,
    classes,
    active_student: child,
    attendance,
    hifz_logs,
    kitab_logs,
    routines: timetable,
    notices: news,
    exams,
    exam_results: results,
    exam_summaries: summaries,
    fees: ledger.payments.map((p) => ({
      ...p,
      amount: p.total_amount_received,
      fee_type: p.allocations
        ?.map((a: any) => a.fee_type_name)
        .filter(Boolean)
        .join(", "),
    })),
    fee_invoices: ledger.fees,
    fee_payments: ledger.payments,
    fee_discounts: ledger.discounts,
    total_paid: ledger.total_paid,
    total_due: ledger.total_due,
    holidays: portalHolidays(meta.academic_holidays, classes),
    assignments: studentHomework(meta.assignments, child),
  };
}
