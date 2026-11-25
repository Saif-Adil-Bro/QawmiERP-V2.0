import { NextRequest, NextResponse } from "next/server";
import { writeGuard } from "@/lib/action-authorization";
import {
  assignSubjectToTeacher,
  removeSubjectFromTeacher,
} from "@/app/actions/teacher_subjects";

export const dynamic = "force-dynamic";

function isSameOriginMutation(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const requestedWith = request.headers.get("x-requested-with");
  if (!origin) {
    // Allow same-origin keepalive requests that include X-Requested-With or Sec-Fetch-Site: same-origin
    const fetchSite = request.headers.get("sec-fetch-site");
    return (
      requestedWith === "XMLHttpRequest" ||
      fetchSite === "same-origin" ||
      fetchSite === "same-site" ||
      !fetchSite
    );
  }
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = (forwardedHost || request.headers.get("host") || "").toLowerCase();
  try {
    const parsedOrigin = new URL(origin);
    return parsedOrigin.host.toLowerCase() === host;
  } catch {
    return false;
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (!isSameOriginMutation(request)) {
      return NextResponse.json(
        { error: "অবৈধ অনুরোধ উৎস।" },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }

    const guard = await writeGuard("staff");
    if (!guard.allowed) {
      const status = guard.errorCode === "UNAUTHENTICATED" ? 401 : 403;
      return NextResponse.json(
        { error: guard.error || "অননুমোদিত অ্যাক্সেস।" },
        { status, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { id: teacherId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const classId = typeof body?.classId === "string" ? body.classId.trim() : "";
    const subjectId = typeof body?.subjectId === "string" ? body.subjectId.trim() : "";

    if (!teacherId || !classId || !subjectId) {
      return NextResponse.json(
        { error: "শিক্ষক, জামাত ও বিষয় নির্বাচন আবশ্যক।" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const result = await assignSubjectToTeacher(teacherId, classId, subjectId);
    const status = (result as any)?.error ? 400 : 200;
    return NextResponse.json(result, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "বিষয় এসাইন করতে সার্ভার ত্রুটি হয়েছে।" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (!isSameOriginMutation(request)) {
      return NextResponse.json(
        { error: "অবৈধ অনুরোধ উৎস।" },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }

    const guard = await writeGuard("staff");
    if (!guard.allowed) {
      const status = guard.errorCode === "UNAUTHENTICATED" ? 401 : 403;
      return NextResponse.json(
        { error: guard.error || "অননুমোদিত অ্যাক্সেস।" },
        { status, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { id: teacherId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const teacherSubjectId =
      typeof body?.teacherSubjectId === "string" ? body.teacherSubjectId.trim() : "";

    if (!teacherId || !teacherSubjectId) {
      return NextResponse.json(
        { error: "বরাদ্দকৃত বিষয় শনাক্ত করা যায়নি।" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const result = await removeSubjectFromTeacher(teacherSubjectId, teacherId);
    const status = (result as any)?.error ? 400 : 200;
    return NextResponse.json(result, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "বিষয় বরাদ্দ মুছতে সার্ভার ত্রুটি হয়েছে।" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
