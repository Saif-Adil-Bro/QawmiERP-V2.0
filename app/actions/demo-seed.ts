"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEMO_MADRASA_NAME,
  DEMO_MADRASA_PREFIX,
  DEMO_ADMIN_EMAIL,
  DEMO_ADMIN_PASSWORD,
  DEMO_ADMIN_NAME,
  getFullDemoDataset,
} from "@/lib/demo-data";
import { saveMadrasaMetadata } from "@/lib/sessions";

export async function ensureDemoMadrasaExists(): Promise<{
  success: boolean;
  madrasaId: string;
  email: string;
  password: string;
  message?: string;
  error?: string;
}> {
  try {
    const admin = await createAdminClient();

    // 1. Check if demo madrasa already exists
    let { data: existingMadrasa } = await admin
      .from("madrasas")
      .select("id, name, registration_no")
      .or(`name.eq.${DEMO_MADRASA_NAME},contact_email.eq.${DEMO_ADMIN_EMAIL}`)
      .maybeSingle();

    let madrasaId = existingMadrasa?.id;

    if (!madrasaId) {
      // Create new demo madrasa using registration_no for broad schema compatibility
      const initialMeta = { prefix: DEMO_MADRASA_PREFIX, short_code: DEMO_MADRASA_PREFIX };
      const { data: created, error: mErr } = await admin
        .from("madrasas")
        .insert({
          name: DEMO_MADRASA_NAME,
          contact_email: DEMO_ADMIN_EMAIL,
          contact_phone: "01711-987654",
          address: "ঢাকা, বাংলাদেশ",
          subscription_plan: "pro",
          registration_no: JSON.stringify(initialMeta),
        })
        .select("id")
        .single();

      if (mErr || !created) {
        // Fallback without subscription_plan or optional columns
        const { data: fbCreated, error: fbErr } = await admin
          .from("madrasas")
          .insert({
            name: DEMO_MADRASA_NAME,
            contact_email: DEMO_ADMIN_EMAIL,
            subscription_plan: "free",
            registration_no: JSON.stringify(initialMeta),
          })
          .select("id")
          .single();

        if (fbErr || !fbCreated) {
          throw new Error(fbErr?.message || mErr?.message || "ডেমো মাদরাসা তৈরিতে ব্যর্থ হয়েছে।");
        }
        madrasaId = fbCreated.id;
      } else {
        madrasaId = created.id;
      }
    }

    // 2. Ensure Demo Auth user exists
    let authUserId: string | null = null;
    const { data: userList } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const existingUser = userList?.users?.find(
      (u) => u.email?.toLowerCase() === DEMO_ADMIN_EMAIL.toLowerCase()
    );

    if (existingUser) {
      authUserId = existingUser.id;
      // Guarantee password is always demo password for easy login
      await admin.auth.admin.updateUserById(authUserId, {
        password: DEMO_ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: DEMO_ADMIN_NAME,
          role: "super_admin",
          madrasa_id: madrasaId,
        },
      });
    } else {
      const { data: newUser, error: uErr } = await admin.auth.admin.createUser({
        email: DEMO_ADMIN_EMAIL,
        password: DEMO_ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: DEMO_ADMIN_NAME,
          role: "super_admin",
          madrasa_id: madrasaId,
        },
      });
      if (uErr || !newUser?.user) {
        throw new Error(uErr?.message || "ডেমো ইউজার তৈরিতে ব্যর্থ হয়েছে।");
      }
      authUserId = newUser.user.id;
    }

    // 3. Ensure public.users entry exists
    await admin.from("users").upsert(
      {
        id: authUserId,
        madrasa_id: madrasaId,
        role: "super_admin",
        full_name: DEMO_ADMIN_NAME,
        email: DEMO_ADMIN_EMAIL,
      },
      { onConflict: "id" }
    );

    // 4. Generate & Seed complete demo tables and metadata
    const dataset = getFullDemoDataset(madrasaId, authUserId);

    // Upsert Classes
    try {
      await admin.from("classes").upsert(dataset.classes, { onConflict: "id" });
    } catch (e) {
      console.warn("Classes seed warning:", e);
    }

    // Upsert Subjects
    try {
      await admin.from("subjects").upsert(dataset.subjects, { onConflict: "id" });
    } catch (e) {
      console.warn("Subjects seed warning:", e);
    }

    // Upsert Teachers
    try {
      await admin.from("teachers").upsert(dataset.teachers, { onConflict: "id" });
    } catch (e) {
      console.warn("Teachers seed warning:", e);
    }

    // Upsert Students
    try {
      await admin.from("students").upsert(dataset.students, { onConflict: "id" });
    } catch (e) {
      console.warn("Students seed warning:", e);
    }

    // Upsert Hifz Logs
    try {
      await admin.from("hifz_logs").upsert(dataset.hifz_logs, { onConflict: "id" });
    } catch (e) {
      console.warn("Hifz logs seed warning:", e);
    }

    // Upsert Attendance
    try {
      await admin.from("attendance").upsert(dataset.attendance, { onConflict: "id" });
    } catch (e) {
      console.warn("Attendance seed warning:", e);
    }

    // Upsert Expenses
    try {
      await admin.from("expenses").upsert(dataset.expenses, { onConflict: "id" });
    } catch (expErr) {
      console.warn("Expenses upsert warning (handled gracefully):", expErr);
    }

    // Upsert Exams & Results
    try {
      await admin.from("exams").upsert(dataset.exams, { onConflict: "id" });
      await admin.from("exam_results").upsert(dataset.exam_results, { onConflict: "id" });
    } catch (examErr) {
      console.warn("Exam upsert warning (handled gracefully):", examErr);
    }

    // 5. Save all metadata (financials, donations, fee structures, bazar, boarding, sessions)
    await saveMadrasaMetadata(madrasaId, dataset.metadata);

    return {
      success: true,
      madrasaId,
      email: DEMO_ADMIN_EMAIL,
      password: DEMO_ADMIN_PASSWORD,
      message: "ডেমো মাদরাসা প্রোফাইল ও পূর্ণাঙ্গ ডাটা সফলভাবে সক্রিয় হয়েছে!",
    };
  } catch (err: any) {
    console.error("ensureDemoMadrasaExists error:", err);
    return {
      success: false,
      madrasaId: "",
      email: DEMO_ADMIN_EMAIL,
      password: DEMO_ADMIN_PASSWORD,
      error: err?.message || "ডেমো ডাটাবেজ সক্রিয় করতে সমস্যা হয়েছে।",
    };
  }
}
