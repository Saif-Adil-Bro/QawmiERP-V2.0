import { examCohort } from "./cohort";
import {
  webIdentity,
  hasRole,
  webTeacher,
  teacherStudents,
  type Identity,
  type TeacherScope,
} from "./identity";
import { rows } from "./queries";
import { selected, studentRoles } from "./rules";

export async function teacherClass(requested?: string) {
  const t = await webTeacher();
  if (!t) return null;
  const current = selected(t.scope.classes, requested);
  const students = current
    ? await teacherStudents(t.i, t.scope, [current.id])
    : [];
  return { ...t, current, students };
}
// One set of subject grants for the online entry form, its POST and the offline snapshot.
export async function teacherExamData(
  i: Identity,
  s: TeacherScope,
  exam: any,
  students: any[],
  classId?: string,
) {
  const classes = s.classes.filter((c) => !classId || c.id === classId);
  if (!classes.length || !exam)
    return { subjects: [] as any[], students: [] as any[], marks: [] as any[] };
  const classIds = classes.map((c) => c.id);
  const [definitions, direct, cohort, explicit] = await Promise.all([
    rows(
      () =>
        i.db
          .from("exam_subjects")
          .select("*")
          .eq("madrasa_id", i.tenant)
          .eq("exam_id", exam.id)
          .in("class_id", classIds),
      true,
    ),
    s.teacher
      ? rows(() =>
          i.db
            .from("routines")
            .select("id,class_id,subjects(name)")
            .eq("madrasa_id", i.tenant)
            .eq("teacher_id", s.teacher.id)
            .in("class_id", classIds),
        )
      : [],
    examCohort(i.db, i.tenant, exam, s.meta),
    i.perms.profile.assignedSubjectIds?.length
      ? rows(() =>
          i.db
            .from("class_subjects")
            .select("id,class_id,subject_id,subjects(name)")
            .eq("madrasa_id", i.tenant)
            .in("class_id", classIds)
            .in("subject_id", i.perms.profile.assignedSubjectIds),
        )
      : [],
  ]);
  const subjects = classes.flatMap((c) => {
    const own = new Set(
      [...s.assignments, ...direct, ...explicit]
        .filter((a) => a.class_id === c.id)
        .map((a) => a.subjects?.name)
        .filter(Boolean),
    );
    // A class-directory grant is not a grant to alter every subject in that class.
    const setup = definitions.filter((d) => d.class_id === c.id);
    return setup.length
      ? setup.filter((d) => own.has(d.subject_name))
      : [...own].map((subject_name) => ({
          exam_id: exam.id,
          class_id: c.id,
          subject_name,
          total_marks: 100,
          pass_marks: 33,
        }));
  });
  const resultStudents = students.filter(
    (s) => classIds.includes(s.class_id) && cohort(s).class_id === s.class_id,
  );
  const marks: any[] = [];
  for (const c of classes) {
    const ids = resultStudents
      .filter((s) => s.class_id === c.id)
      .map((s) => s.id);
    const names = subjects
      .filter((d) => d.class_id === c.id)
      .map((d) => d.subject_name);
    if (!names.length) continue;
    for (let pos = 0; pos < ids.length; pos += 80)
      marks.push(
        ...(await rows(() =>
          i.db
            .from("exam_results")
            .select("*")
            .eq("madrasa_id", i.tenant)
            .eq("exam_id", exam.id)
            .in("student_id", ids.slice(pos, pos + 80))
            .in("subject_name", names),
        )),
      );
  }
  return { subjects, students: resultStudents, marks };
}
export async function verifyRoster(
  tenant: string,
  records: any[],
  classId?: string,
) {
  const i = await webIdentity();
  if (
    !i ||
    hasRole(i, studentRoles) ||
    i.tenant !== tenant ||
    !records.length ||
    records.some((r) => !r?.student_id)
  )
    return false;
  const t = await webTeacher();
  const ids = [...new Set(records.map((r) => r.student_id))];
  const members = t
    ? await teacherStudents(i, t.scope, classId ? [classId] : undefined)
    : await rows(() =>
        i.db
          .from("students")
          .select("id,class_id")
          .eq("madrasa_id", tenant)
          .in("id", ids),
      );
  const roster = new Map(members.map((r) => [r.id, r.class_id]));
  return records.every(
    (r) =>
      roster.has(r.student_id) &&
      (!classId || classId === roster.get(r.student_id)) &&
      (!r.class_id || r.class_id === roster.get(r.student_id)),
  );
}

// Never treat this header as authorization. It is an extra equality check on queued writes
// after cookies changed in another tab; the route must still authorize module/class/subject.
export async function matchesSyncOwner(req: Request) {
  const expected = req.headers.get("X-Qawmi-Sync-Owner");
  if (!expected) return true;
  const t = await webTeacher();
  return !!t && expected === `${t.i.tenant}:${t.i.user.id}:teacher`;
}
