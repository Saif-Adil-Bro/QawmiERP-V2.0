import { NextRequest, NextResponse } from "next/server";
import {
  assignSubjectToClass,
  removeSubjectFromClass,
} from "@/app/actions/class_subjects";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: classId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const subjectId = typeof body?.subjectId === "string" ? body.subjectId.trim() : "";

    if (!classId || !subjectId) {
      return NextResponse.json(
        { error: "জামাত ও বিষয় নির্বাচন আবশ্যক।" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const result = await assignSubjectToClass(classId, subjectId);
    const status = (result as any)?.error ? 400 : 200;
    return NextResponse.json(result, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "সার্ভার এরর হয়েছে।" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: classId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const classSubjectId =
      typeof body?.classSubjectId === "string" ? body.classSubjectId.trim() : "";
    const subjectId =
      typeof body?.subjectId === "string" ? body.subjectId.trim() : undefined;

    if (!classId || (!classSubjectId && !subjectId)) {
      return NextResponse.json(
        { error: "বরাদ্দকৃত বিষয় শনাক্ত করা যায়নি।" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const result = await removeSubjectFromClass(classSubjectId, classId, subjectId);
    const status = (result as any)?.error ? 400 : 200;
    return NextResponse.json(result, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "সার্ভার এরর হয়েছে।" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
