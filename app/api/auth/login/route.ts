import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getPortalRedirectUrl } from "@/lib/role-redirect";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "ইমেইল ও পাসওয়ার্ড প্রদান করুন" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    // Resolve user role
    let userRole = data.user?.user_metadata?.role || "staff";
    let roles: string[] = [];

    try {
      const adminClient = await createAdminClient();
      const { data: userRow } = await adminClient
        .from("users")
        .select("role, madrasa_id")
        .eq("id", data.user.id)
        .maybeSingle();

      if (userRow?.role) {
        userRole = userRow.role;
      }

      // If role still not determined or default, check if user exists in teachers table
      if (userRole === "staff" || !userRole) {
        const { data: teacherRow } = await adminClient
          .from("teachers")
          .select("id")
          .eq("email", email)
          .maybeSingle();
        if (teacherRow) {
          userRole = "teacher";
        }
      }

      // Check madrasa security store for custom user profiles
      if (userRow?.madrasa_id) {
        const { data: madrasaRow } = await adminClient
          .from("madrasas")
          .select("registration_no")
          .eq("id", userRow.madrasa_id)
          .maybeSingle();
        if (madrasaRow?.registration_no?.startsWith("{")) {
          const parsed = JSON.parse(madrasaRow.registration_no);
          const profileOverride = parsed.user_security_profiles?.[data.user.id];
          if (profileOverride?.primaryRole) {
            userRole = profileOverride.primaryRole;
          }
          if (profileOverride?.roles) {
            roles = profileOverride.roles;
          }
        }
      }
    } catch (dbErr) {
      console.warn("Role lookup in login API fallback:", dbErr);
    }

    const redirectUrl = getPortalRedirectUrl(userRole, roles);

    return NextResponse.json({
      success: true,
      user: data.user,
      session: data.session,
      role: userRole,
      redirectUrl,
    });
  } catch (err: any) {
    console.error("Login API error:", err);
    return NextResponse.json(
      { error: err?.message || "সার্ভার এরর হয়েছে" },
      { status: 500 }
    );
  }
}

