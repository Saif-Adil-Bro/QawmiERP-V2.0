import { rows } from "./queries";

/** Current class is not a historical class. Prefer an exam/session enrollment and
 * use a current roster only for the current session or installations without sessions. */
export async function examCohort(
  db: any,
  tenant: string,
  exam: any,
  meta: any,
) {
  const sessions: any[] = meta.sessions?.length
    ? meta.sessions
    : await rows(
        () => db.from("academic_sessions").select("*").eq("madrasa_id", tenant),
        true,
      );
  const matches = sessions.filter((s) =>
    exam.session_id
      ? s.id === exam.session_id
      : exam.start_date
        ? s.start_date <= exam.start_date && s.end_date >= exam.start_date
        : !!exam.year &&
          [s.academic_year, s.hijri_year, s.name].includes(exam.year),
  );
  const session = matches.length === 1 ? matches[0] : null;
  const id = exam.session_id || session?.id;
  const sql = id
    ? await rows(
        () =>
          db
            .from("student_enrollments")
            .select("*")
            .eq("madrasa_id", tenant)
            .eq("session_id", id),
        true,
      )
    : [];
  const history = [
    ...sql,
    ...(meta.enrollments || []).filter((e: any) => id && e.session_id === id),
  ];
  const byId = new Map(history.map((e) => [e.student_id, e]));
  return (s: any, resultClass?: string | null) => {
    const enrollment = byId.get(s.id);
    const useCurrent =
      (!id && sessions.length === 0) ||
      (session?.is_current ?? session?.is_active);
    return {
      class_id:
        enrollment?.class_id || resultClass || (useCurrent ? s.class_id : null),
      class_name: enrollment?.class_name,
      roll_number:
        enrollment?.roll_number ?? (useCurrent ? s.roll_number : null),
      section: enrollment?.section ?? (useCurrent ? s.section : null),
    };
  };
}
