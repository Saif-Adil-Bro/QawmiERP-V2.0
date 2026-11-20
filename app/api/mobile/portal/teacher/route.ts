import { NextRequest } from "next/server";
import { authenticateMobileRequest, mobileError, mobileSuccess } from "@/lib/mobile-api";
import { parseRoutineItem } from "@/lib/routine-helper";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateMobileRequest(req, {
    requireWrite: false,
    allowPortalRoles: true,
  });
  if (!auth.ok) return auth.response;

  try {
    const phone = String(auth.ctx.userRow?.phone || "").trim();
    const email = String(auth.ctx.email || "").trim();
    const orFilters = [
      email ? `email.eq.${email}` : "",
      phone ? `phone.eq.${phone}` : "",
      auth.ctx.user?.id ? `auth_user_id.eq.${auth.ctx.user.id}` : "",
    ].filter(Boolean);

    let teacher: any = null;
    if (orFilters.length > 0) {
      const { data } = await auth.adminClient
        .from("teachers")
        .select("*")
        .eq("madrasa_id", auth.ctx.madrasaId)
        .or(orFilters.join(","))
        .maybeSingle();
      teacher = data;
    }

    const [subjectsRes, routinesRes, classesRes, noticesRes, examsRes] = await Promise.all([
      teacher
        ? auth.adminClient
            .from("teacher_subjects")
            .select("*, classes(id, name), subjects(id, name, code)")
            .eq("teacher_id", teacher.id)
        : Promise.resolve({ data: [] }),
      teacher
        ? auth.adminClient
            .from("routines")
            .select("*, classes(id, name), subjects(id, name)")
            .eq("teacher_id", teacher.id)
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

    const inChargeClasses = (classesRes.data || [])
      .filter((c: any) => teacher && (c.class_teacher_id === teacher.id || c.in_charge_teacher_id === teacher.id))
      .map((c: any) => ({ class_id: c.id, class_name: c.name }));

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

    const parsedRoutines = (routinesRes.data || []).map((r: any) => {
      const parsed = parseRoutineItem(r);
      const clsName = Array.isArray(r.classes) ? r.classes[0]?.name : r.classes?.name;
      return {
        ...parsed,
        class_name: clsName || r.class_name || "",
      };
    });

    return mobileSuccess(
      {
        teacher: teacher || null,
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
