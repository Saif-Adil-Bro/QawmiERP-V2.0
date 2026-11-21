import { NextRequest } from "next/server";
import { authenticateMobileRequest, mobileError, mobileSuccess } from "@/lib/mobile-api";
import { readJsonStore, writeJsonStore } from "@/lib/madrasa-store";
import { NOORANI_TAKHTIS, MAKHRAJ_LIST } from "@/lib/noorani-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateMobileRequest(req, {
    module: "hifz",
    requireWrite: false,
  });
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("student_id");
  const store = await readJsonStore(auth.ctx.madrasaId, "meta");
  const progressMap = store.noorani_progress || {};
  const curriculum = { takhtis: NOORANI_TAKHTIS, makharij: MAKHRAJ_LIST };

  if (studentId) {
    return mobileSuccess(
      {
        curriculum,
        progress: progressMap[studentId] || null,
      },
      "Success",
      undefined,
      200,
      req
    );
  }

  return mobileSuccess(
    {
      curriculum,
      progress_map: progressMap,
    },
    "Success",
    undefined,
    200,
    req
  );
}

export async function POST(req: NextRequest) {
  const auth = await authenticateMobileRequest(req, {
    module: "hifz",
    requireWrite: true,
  });
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const studentId = String(body.student_id || "").trim();
    if (!studentId) {
      return mobileError("student_id আবশ্যক।", 400, "VALIDATION_ERROR");
    }

    const store = await readJsonStore(auth.ctx.madrasaId, "meta");
    const progressMap = store.noorani_progress || {};
    progressMap[studentId] = {
      ...(progressMap[studentId] || {}),
      ...body,
      student_id: studentId,
      updated_at: new Date().toISOString(),
    };
    store.noorani_progress = progressMap;
    await writeJsonStore(auth.ctx.madrasaId, "meta", store);

    return mobileSuccess(progressMap[studentId], "নূরানী অগ্রগতি সংরক্ষিত হয়েছে।", undefined, 200, req);
  } catch (err: any) {
    return mobileError(err?.message || "Server error", 500, "INTERNAL_ERROR");
  }
}
