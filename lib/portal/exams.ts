import { published } from "./rules";
import { cache } from "react";
import { getExamSettingsBundle } from "../structured-config";
import { examCohort } from "./cohort";
import {
  computeStudentExamSummary,
  rankSummaries,
  toBanglaOrdinal,
} from "../exam-grading";
import { rows } from "./queries";

export async function publicationFlags(
  db: any,
  tenant: string,
  meta: any,
): Promise<Record<string, any>> {
  const flags = await rows(
    () =>
      db
        .from("exam_settings")
        .select("id,scope_key,setting_value")
        .eq("madrasa_id", tenant)
        .eq("setting_key", "publish_info"),
    true,
  );
  return {
    ...meta.published_exams,
    ...Object.fromEntries(flags.map((r) => [r.scope_key, r.setting_value])),
  };
}
export async function portalExams(db: any, tenant: string, meta: any) {
  const [exams, flags] = await Promise.all([
    rows(() =>
      db
        .from("exams")
        .select("*")
        .eq("madrasa_id", tenant)
        .order("start_date", { ascending: false, nullsFirst: false }),
    ),
    publicationFlags(db, tenant, meta),
  ]);
  return exams.map((e) => {
    const flag = flags[e.id];
    return {
      ...e,
      is_published: published(flags, e),
      published_at: flag?.published_at,
      publish_note: flag?.note,
    };
  });
}

// Admin tabulation and portal summaries use the same exam-date roster. Never union enrollment
// history from unrelated sessions. Read only one exam and never return classmates to the portal.
export const examReport = cache(
  async (db: any, tenant: string, exam: any, meta: any) => {
    const [students, entries, definitions, bundle, cohort, classes] =
      await Promise.all([
        rows(() =>
          db
            .from("students")
            .select(
              "id,first_name,last_name,roll_number,class_id,classes(id,name)",
            )
            .eq("madrasa_id", tenant)
            .order("roll_number"),
        ),
        rows(() =>
          db
            .from("exam_results")
            .select("*")
            .eq("madrasa_id", tenant)
            .eq("exam_id", exam.id),
        ),
        rows(
          () =>
            db
              .from("exam_subjects")
              .select("*")
              .eq("madrasa_id", tenant)
              .eq("exam_id", exam.id),
          true,
        ),
        getExamSettingsBundle(tenant, exam.id),
        examCohort(db, tenant, exam, meta),
        rows(() =>
          db.from("classes").select("id,name").eq("madrasa_id", tenant),
        ),
      ]);
    const byStudent = new Map<string, any[]>();
    for (const r of entries) {
      if (!byStudent.has(r.student_id)) byStudent.set(r.student_id, []);
      byStudent.get(r.student_id)!.push(r);
    }
    const classNames = new Map(classes.map((c) => [c.id, c.name]));
    const roster = students.map((s) => {
      const own = byStudent.get(s.id) || [];
      const enr = cohort(s, own.find((r) => r.class_id)?.class_id);
      return {
        ...s,
        ...enr,
        class_name: enr.class_name || classNames.get(enr.class_id) || "",
        own,
      };
    });
    const setup = new Map<string, any[]>();
    for (const d of definitions) {
      if (!setup.has(d.class_id)) setup.set(d.class_id, []);
      setup.get(d.class_id)!.push(d);
    }
    const configured = new Set(setup.keys());
    const highest = new Map<string, number>();
    for (const s of roster)
      for (const r of s.own) {
        if (s.class_id && !configured.has(s.class_id)) {
          const defs = setup.get(s.class_id) || [];
          if (!defs.some((d) => d.subject_name === r.subject_name))
            defs.push({
              ...r,
              total_marks: r.total_marks,
              class_id: s.class_id,
            });
          setup.set(s.class_id, defs);
        }
        const key = `${bundle.gradingConfig.highestMarksScope === "exam" ? "*" : s.class_id}:${r.subject_name}`;
        highest.set(
          key,
          Math.max(highest.get(key) || 0, Number(r.marks_obtained) || 0),
        );
      }
    return roster.map((s) => {
      const defs = setup.get(s.class_id) || [];
      const summary = computeStudentExamSummary(s.own, bundle.gradingConfig, {
        classId: s.class_id,
        examSubjects: defs,
        compulsorySubjects: bundle.compulsorySubjects,
        failPolicy: bundle.evaluationRules.fail_policy,
      });
      const marks = summary.subjects.map((m) => ({
        id: m.id,
        student_id: s.id,
        exam_id: exam.id,
        subject_name: m.subjectName,
        marks_obtained: m.marksObtained,
        total_marks: m.totalMarks,
        pass_marks: m.passMarks,
        is_compulsory: m.isCompulsory,
        is_failed: m.isFailed,
        has_entered_marks: m.hasEntered,
        exam_type:
          defs.find((d) => d.subject_name === m.subjectName)?.exam_type ||
          "Written",
        highest_marks:
          highest.get(
            `${bundle.gradingConfig.highestMarksScope === "exam" ? "*" : s.class_id}:${m.subjectName}`,
          ) || 0,
        grade: m.gradeLabel,
        gpa: m.gpa,
        percentage: m.percentage,
      }));
      return {
        ...s,
        marks,
        summary,
        totalObtained: summary.totalObtained,
        totalMax: summary.totalMax,
        percentage: summary.percentage.toFixed(2),
        grade: summary.hasMarks ? summary.gradeLabel : "N/A",
        gpa: summary.hasMarks ? summary.gpa.toFixed(2) : "N/A",
        grading_mode: bundle.gradingConfig.calculationMode,
        highest_marks_scope: bundle.gradingConfig.highestMarksScope,
        is_failed: summary.hasMarks && !summary.isPassed,
        fail_reason:
          summary.hasMarks && !summary.isPassed ? summary.statusLabel : "",
        failed_compulsory_count: marks.filter(
          (m) => m.is_compulsory && m.is_failed,
        ).length,
        failed_total_count: summary.failedSubjectCount,
      };
    });
  },
);
export async function studentExam(
  db: any,
  tenant: string,
  exam: any,
  childId: string,
  meta: any,
) {
  const report = exam?.is_published
    ? await examReport(db, tenant, exam, meta)
    : [];
  const own = report.find((s) => s.id === childId);
  const summary = own?.summary ?? computeStudentExamSummary([]);
  const { ranks, totalCandidates } = rankSummaries(
    own?.class_id ? report.filter((s) => s.class_id === own.class_id) : [],
  );
  const meritPosition = ranks.get(childId) ?? null;
  const merit = {
    meritPosition,
    totalCandidates,
    formattedPosition: meritPosition
      ? toBanglaOrdinal(meritPosition)
      : summary.hasMarks && !summary.isPassed
        ? "প্রযোজ্য নয়"
        : "অপেক্ষমাণ",
  };
  return { summary, merit, rawResults: own?.own || [] };
}
