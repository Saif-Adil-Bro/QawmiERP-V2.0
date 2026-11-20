import { NextRequest } from "next/server";
import { authenticateMobileRequest, mobileError, mobileSuccess } from "@/lib/mobile-api";
import { parseRoutineItem } from "@/lib/routine-helper";
import { getMadrasaMetadata } from "@/lib/sessions";
import { resolveTeacherIdentityForAuthUser } from "@/lib/teacher-identity";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateMobileRequest(req, {
    requireWrite: false,
    allowPortalRoles: true,
  });
  if (!auth.ok) return auth.response;

  try {
    const madrasaMeta = auth.ctx.madrasaId
      ? await getMadrasaMetadata(auth.ctx.madrasaId)
      : null;

    const identity = await resolveTeacherIdentityForAuthUser({
      adminClient: auth.adminClient,
      madrasaId: auth.ctx.madrasaId,
      user: {
        id: auth.ctx.user?.id || "",
        email: auth.ctx.email || auth.ctx.user?.email,
        phone: auth.ctx.user?.phone,
        user_metadata: auth.ctx.user?.user_metadata,
      },
      userData: auth.ctx.userRow,
      madrasaMeta,
    });

    const teacher = identity.matchedTeacher;
    const candidateIds = identity.candidateIds;
    const candidateSet = new Set(candidateIds);

    const [subjectsRes, routinesRes, classesRes, noticesRes, examsRes] = await Promise.all([
      candidateIds.length > 0
        ? auth.adminClient
            .from("teacher_subjects")
            .select("*, classes(id, name), subjects(id, name, code)")
            .in("teacher_id", candidateIds)
        : Promise.resolve({ data: [] }),
      candidateIds.length > 0
        ? auth.adminClient
            .from("routines")
            .select("*, classes(id, name), subjects(id, name), teachers(id, first_name, last_name)")
            .in("teacher_id", candidateIds)
            .order("start_time", { ascending: true })
        : Promise.resolve({ data: [] }),
      auth.adminClient.from("classes").select("*").eq("madrasa_id", auth.ctx.madrasaId).order("name"),
      auth.adminClient
        .from("notices")
        .select("*")
        .eq("madrasa_id", auth.ctx.madrasaId)
        .order("created_at", { ascending: false })
        .limit(20),
      auth.adminClient
        .from("exams")
        .select("id, title, year, start_date, status")
        .eq("madrasa_id", auth.ctx.madrasaId)
        .order("start_date", { ascending: false })
        .limit(20),
    ]);

    const classTeachersMap = (madrasaMeta as any)?.class_teachers || {};
    const inChargeClassIds = new Set<string>();
    const inChargeClasses: Array<{ class_id: string; class_name: string }> = [];

    for (const c of classesRes.data || []) {
      const fromSql =
        candidateSet.has(String(c.class_teacher_id || "")) ||
        candidateSet.has(String(c.in_charge_teacher_id || ""));
      const ctInfo = classTeachersMap[c.id];
      const fromMeta = Boolean(ctInfo?.teacher_id && candidateSet.has(String(ctInfo.teacher_id)));
      if ((fromSql || fromMeta) && !inChargeClassIds.has(c.id)) {
        inChargeClassIds.add(c.id);
        inChargeClasses.push({ class_id: c.id, class_name: c.name });
      }
    }

    const assignedClassIds = Array.from(
      new Set([
        ...inChargeClasses.map((c: any) => c.class_id),
        ...(subjectsRes.data || []).map((s: any) => s.class_id).filter(Boolean),
      ])
    );

    const studentsQuery = auth.adminClient
      .from("students")
      .select("id, first_name, last_name, roll_number, student_id, photo_url, parent_phone, class_id, status")
      .eq("madrasa_id", auth.ctx.madrasaId)
      .order("roll_number", { ascending: true })
      .limit(250);

    const { data: students } =
      assignedClassIds.length > 0
        ? await studentsQuery.in("class_id", assignedClassIds)
        : await studentsQuery;

    const parsedRoutines = (routinesRes.data || [])
      .filter((r: any) => !r?.madrasa_id || r.madrasa_id === auth.ctx.madrasaId)
      .map((r: any) => {
        const parsed = parseRoutineItem(r);
        const clsName = Array.isArray(r.classes) ? r.classes[0]?.name : r.classes?.name;
        return {
          ...parsed,
          class_name: clsName || r.class_name || "",
        };
      });

    return mobileSuccess(
      {
        teacher:
          teacher ||
          (identity.teacherId
            ? {
                id: identity.teacherId,
                name: identity.teacherName,
                designation: identity.designation,
              }
            : null),
        assigned_subjects: subjectsRes.data || [],
        in_charge_classes: inChargeClasses,
        routines: parsedRoutines,
        classes: classesRes.data || [],
        students: students || [],
        exams: examsRes.data || [],
        notices: noticesRes.data || [],
      },
      "Success",
      undefined,
      200,
      req
    );
  } catch (err: any) {
    return mobileError(err?.message || "Server error", 500, "INTERNAL_ERROR");
  }
}
