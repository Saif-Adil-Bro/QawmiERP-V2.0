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
import { getExamSettingsBundle } from "../structured-config";
import { sanitizeSubParts } from "../exam-subparts";

export async function teacherClass(requested?: string) {
  const t = await webTeacher(true);
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
  const [definitions, direct, cohort, explicit, classSubRows, settingsBundle] = await Promise.all([
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
    rows(() =>
      i.db
        .from("class_subjects")
        .select("id,class_id,subject_id,subjects(name)")
        .in("class_id", classIds),
    ),
    getExamSettingsBundle(i.tenant, exam.id),
  ]);
  const normSub = (v: unknown) =>
    typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
  const subjects = classes.flatMap((c) => {
    const isJimmadar = s.inCharge.some((ic) => ic.id === c.id);
    const assignedNames = [...s.assignments, ...direct, ...explicit]
      .filter((a) => a.class_id === c.id)
      .map((a) => normSub(a.subjects?.name || a.subject_name))
      .filter(Boolean);
    const own = new Set(assignedNames);
    const setup = definitions.filter((d) => d.class_id === c.id);

    // If teacher is explicitly assigned subjects in this class, filter to those;
    // If teacher is the class Jimmadar and has no separate subject rows yet, grant class subjects/exam subjects for their Jimmadar class.
    let list: any[] = [];
    if (setup.length) {
      const matched = setup.filter((d) => own.has(normSub(d.subject_name)));
      if (matched.length > 0) {
        list = matched;
      } else if (isJimmadar && own.size === 0) {
        list = setup;
      } else if (own.size > 0) {
        // Teacher has assigned subjects that are not in exam_subjects yet — allow entering marks for their assigned subjects
        list = [...own].map((subject_name) => ({
          exam_id: exam.id,
          class_id: c.id,
          subject_name,
          total_marks: 100,
          pass_marks: 33,
        }));
      }
    } else {
      const fallbackNames =
        own.size > 0
          ? [...own]
          : isJimmadar
            ? (classSubRows || [])
                .filter((cs: any) => cs.class_id === c.id)
                .map((cs: any) => normSub(cs.subjects?.name))
                .filter(Boolean)
            : [];
      list = [...new Set(fallbackNames)].map((subject_name) => ({
        exam_id: exam.id,
        class_id: c.id,
        subject_name,
        total_marks: 100,
        pass_marks: 33,
      }));
    }
    return list.map((sub: any) => ({
      ...sub,
      sub_parts: sanitizeSubParts(
        settingsBundle.subjectSubParts?.[`${c.id}:${sub.subject_name}`] ?? sub.sub_parts,
      ),
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
    for (let pos = 0; pos < ids.length; pos += 80) {
      const batch = await rows(() =>
        i.db
          .from("exam_results")
          .select("*")
          .eq("madrasa_id", i.tenant)
          .eq("exam_id", exam.id)
          .in("student_id", ids.slice(pos, pos + 80))
          .in("subject_name", names),
      );
      for (const row of batch) {
        const storedSub =
          settingsBundle.resultSubPartMarks?.[`${row.student_id}:${row.subject_name}`] || null;
        marks.push({
          ...row,
          sub_part_marks: storedSub || row.sub_part_marks || null,
        });
      }
    }
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
  const t = await webTeacher(true);
  return !!t && expected === `${t.i.tenant}:${t.i.user.id}:teacher`;
}
