import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureDemoMadrasaExists } from "@/app/actions/demo-seed";
import { DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    // 1. Ensure demo madrasa, admin user, and complete demo records exist in database
    const seedResult = await ensureDemoMadrasaExists();
    if (!seedResult.success) {
      return NextResponse.json(
        { error: seedResult.error || "ডেমো প্রোফাইল প্রস্তুতিতে সমস্যা হয়েছে।" },
        { status: 500 }
      );
    }

    // 2. Perform authentic Supabase signInWithPassword for session creation
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: DEMO_ADMIN_EMAIL,
      password: DEMO_ADMIN_PASSWORD,
    });

    if (error || !data.session) {
      return NextResponse.json(
        { error: error?.message || "ডেমো অ্যাকাউন্টে সাইন-ইন করতে ব্যর্থ হয়েছে।" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "ডেমো অ্যাকাউন্টে সফলভাবে লগইন হয়েছে!",
      redirectUrl: "/dashboard",
      session: data.session,
      user: data.user,
    });
  } catch (err: any) {
    console.error("Demo login error:", err);
    return NextResponse.json(
      { error: err?.message || "ডেমো লগইন প্রক্রিয়ায় সমস্যা হয়েছে।" },
      { status: 500 }
    );
  }
}
