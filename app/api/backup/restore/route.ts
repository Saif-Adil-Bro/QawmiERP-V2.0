import { NextRequest, NextResponse } from "next/server";
import { executeDataRestore } from "@/app/actions/backup";
import { createClient, getAuthUser } from "@/lib/supabase/server";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) {
      return NextResponse.json(
        { success: false, message: "অননুমোদিত অ্যাক্সেস। অনুগ্রহ করে লগইন করুন।" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { backupPayload, restoreMode, selectedModules, createAutoSnapshot } = body || {};

    if (!backupPayload || !backupPayload.data) {
      return NextResponse.json(
        { success: false, message: "কোনো বৈধ ব্যাকআপ পে-লোড পাওয়া যায়নি।" },
        { status: 400 }
      );
    }

    const result = await executeDataRestore({
      backupPayload,
      restoreMode: restoreMode || "merge",
      selectedModules,
      createAutoSnapshot: createAutoSnapshot !== false,
    });

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err: any) {
    console.error("API /api/backup/restore error:", err);
    return NextResponse.json(
      {
        success: false,
        message: "ব্যাকআপ রিস্টোরে অপ্রত্যাশিত ত্রুটি ঘটেছে।",
        error: err?.message || String(err),
      },
      { status: 500 }
    );
  }
}
