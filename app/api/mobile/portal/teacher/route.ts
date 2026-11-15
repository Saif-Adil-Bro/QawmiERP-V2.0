import { NextRequest } from "next/server";
import { authenticateMobileRequest, mobileError, mobileSuccess } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateMobileRequest(req, {
    requireWrite: false,
    allowPortalRoles: true,
  });
  if (!auth.ok) return auth.response;

  try {
    const { data: teacher } = await auth.adminClient
      .from("teachers")
      .select("*")
      .eq("madrasa_id", auth.ctx.madrasaId)
      .or(`email.eq.${auth.ctx.email},phone.eq.${auth.ctx.userRow?.phone || ""}`)
      .maybeSingle();

    const [subjectsRes, routinesRes, classesRes, noticesRes] = await Promise.all([
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
        : Promise.resolve({ data: [] }),
      auth.adminClient.from("classes").select("*").eq("madrasa_id", auth.ctx.madrasaId),
      auth.adminClient
        .from("notices")
        .select("*")
        .eq("madrasa_id", auth.ctx.madrasaId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    return mobileSuccess(
      {
        teacher: teacher || null,
        assigned_subjects: subjectsRes.data || [],
        routines: routinesRes.data || [],
        classes: classesRes.data || [],
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
