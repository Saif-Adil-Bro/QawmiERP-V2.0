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
      .select("id, name, metadata")
      .or(`contact_email.eq.${DEMO_ADMIN_EMAIL},name.eq.${DEMO_MADRASA_NAME}`)
      .maybeSingle();

    let madrasaId = existingMadrasa?.id;

    if (!madrasaId) {
      // Create new demo madrasa
      const { data: created, error: mErr } = await admin
        .from("madrasas")
        .insert({
          name: DEMO_MADRASA_NAME,
          contact_email: DEMO_ADMIN_EMAIL,
          subscription_plan: "pro",
          metadata: { prefix: DEMO_MADRASA_PREFIX, short_code: DEMO_MADRASA_PREFIX },
        })
        .select("id")
        .single();

      if (mErr || !created) {
        throw new Error(mErr?.message || "ডেমো মাদরাসা তৈরিতে ব্যর্থ হয়েছে।");
      }
      madrasaId = created.id;
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
    await admin.from("classes").upsert(dataset.classes, { onConflict: "id" });

    // Upsert Subjects
    await admin.from("subjects").upsert(dataset.subjects, { onConflict: "id" });

    // Upsert Teachers
    await admin.from("teachers").upsert(dataset.teachers, { onConflict: "id" });

    // Upsert Students
    await admin.from("students").upsert(dataset.students, { onConflict: "id" });

    // Upsert Hifz Logs
    await admin.from("hifz_logs").upsert(dataset.hifz_logs, { onConflict: "id" });

    // Upsert Attendance
    await admin.from("attendance").upsert(dataset.attendance, { onConflict: "id" });

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
