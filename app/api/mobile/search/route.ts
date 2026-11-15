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
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || searchParams.get("search") || "").trim();
    if (!q) {
      return mobileSuccess({ students: [], teachers: [], classes: [], books: [], donors: [] });
    }

    const madrasaId = auth.ctx.madrasaId;
    const [studentsRes, teachersRes, classesRes, booksRes, donorsRes] = await Promise.all([
      auth.adminClient
        .from("students")
        .select("id, full_name, roll_number, student_id_code, photo_url, classes(id, name)")
        .eq("madrasa_id", madrasaId)
        .or(`full_name.ilike.%${q}%,roll_number.ilike.%${q}%,student_id_code.ilike.%${q}%,parent_phone.ilike.%${q}%`)
        .limit(10),
      auth.adminClient
        .from("teachers")
        .select("id, full_name, phone, designation, photo_url")
        .eq("madrasa_id", madrasaId)
        .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(10),
      auth.adminClient
        .from("classes")
        .select("id, name, department")
        .eq("madrasa_id", madrasaId)
        .ilike("name", `%${q}%`)
        .limit(10),
      auth.adminClient
        .from("books")
        .select("id, title, author, isbn")
        .eq("madrasa_id", madrasaId)
        .or(`title.ilike.%${q}%,author.ilike.%${q}%`)
        .limit(10),
      auth.adminClient
        .from("donors")
        .select("id, name, phone")
        .eq("madrasa_id", madrasaId)
        .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(10),
    ]);

    return mobileSuccess(
      {
        students: studentsRes.data || [],
        teachers: teachersRes.data || [],
        classes: classesRes.data || [],
        books: booksRes.data || [],
        donors: donorsRes.data || [],
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
