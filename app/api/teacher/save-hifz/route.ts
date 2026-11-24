import { matchesSyncOwner, teacherClass } from "@/lib/portal/teacher-entry";
import { authorizeApi } from "@/lib/api-auth";
import { EntryError } from "@/lib/hifz/entries";
import { writeHifz } from "@/lib/hifz/write";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest) {
  try {
    if (!(await matchesSyncOwner(req)))
      return NextResponse.json(
        { error: "সিঙ্ক অ্যাকাউন্ট বদলেছে।",code:"OWNER_CHANGED" },
        { status: 409 },
      );
    const auth = await authorizeApi("hifz");
    if (!auth.ok) return auth.response;
    const body = await req.json();
    if (!body?.current_class_id) throw new EntryError("জামাত নির্বাচন করুন।");
    const t = await teacherClass(body.current_class_id);
    if (
      !t?.current ||
      t.i.tenant !== auth.ctx.madrasaId ||
      t.current.id !== body.current_class_id
    )
      throw new EntryError("এই জামাতের অনুমতি নেই।", 403);
    const data = await writeHifz(
      {
        db: t.i.db,
        tenant: t.i.tenant,
        actor: t.i.user.id,
        teacherId: t.scope.teacher?.id,
        roster: t.students,
        legacy: t.scope.meta.student_profiles,
      },
      body,
    );
    for (const path of [
      "/dashboard/hifz",
      "/teacher-portal/hifz",
      "/portal/academic",
      "/portal",
      "/teacher-portal",
    ])
      revalidatePath(path);
    return NextResponse.json({
      success: true,
      count: Array.isArray(data) ? data.length : 1,
      data,
    });
  } catch (e) {
    if (!(e instanceof EntryError)) console.error("Hifz write failed", e);
    return NextResponse.json(
      {
        error:
          e instanceof EntryError
            ? e.message
            : "সংরক্ষণ হয়নি। আবার চেষ্টা করুন।",
      },
      { status: e instanceof EntryError ? e.status : 500 },
    );
  }
}
