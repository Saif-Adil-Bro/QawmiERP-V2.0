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
import { revalidatePath } from "next/cache";

async function safeSeedTable(
  admin: any,
  table: string,
  records: any[],
  madrasaId: string,
  onConflict = "id"
) {
  if (!records || records.length === 0) return;
  try {
    const { error: upErr } = await admin.from(table).upsert(records, { onConflict });
    if (upErr) {
      console.warn(`Upsert into ${table} failed (${upErr.message}). Falling back to delete + insert...`);
      // Delete existing records for this demo madrasa and insert cleanly
      await admin.from(table).delete().eq("madrasa_id", madrasaId);
      const { error: inErr } = await admin.from(table).insert(records);
      if (inErr) {
        console.error(`Fallback insert into ${table} also failed: ${inErr.message}`);
      } else {
        console.log(`Successfully inserted ${records.length} records into ${table}.`);
      }
    } else {
      console.log(`Successfully upserted ${records.length} records into ${table}.`);
    }
  } catch (err: any) {
    console.error(`Exception while seeding ${table}:`, err?.message || err);
  }
}

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
    } else {
      // Ensure name is updated to "মাদ্রাসাতুল মুসলিমিন"
      try {
        await admin
          .from("madrasas")
          .update({
            name: DEMO_MADRASA_NAME,
            contact_email: DEMO_ADMIN_EMAIL,
          })
          .eq("id", madrasaId);
      } catch (upErr) {
        console.warn("Madrasa name update warning:", upErr);
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

    // 3. Ensure public.users entry exists with correct madrasa_id
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

    // Seed master tables first
    await safeSeedTable(admin, "classes", dataset.classes, madrasaId);
    await safeSeedTable(admin, "subjects", dataset.subjects, madrasaId);
    await safeSeedTable(admin, "teachers", dataset.teachers, madrasaId);
    await safeSeedTable(admin, "donors", dataset.donors, madrasaId);
    await safeSeedTable(admin, "exams", dataset.exams, madrasaId);
    await safeSeedTable(admin, "academic_sessions", dataset.academic_sessions, madrasaId);

    // Seed dependent tables
    await safeSeedTable(admin, "students", dataset.students, madrasaId);
    await safeSeedTable(admin, "attendance", dataset.attendance, madrasaId, "id");
    await safeSeedTable(admin, "hifz_logs", dataset.hifz_logs, madrasaId, "id");
    await safeSeedTable(admin, "expenses", dataset.expenses, madrasaId);
    await safeSeedTable(admin, "donations", dataset.donations, madrasaId);
    await safeSeedTable(admin, "fees", dataset.fees, madrasaId);
    await safeSeedTable(admin, "bazar_expenses", dataset.bazar_expenses, madrasaId);
    await safeSeedTable(admin, "meal_entries", dataset.meal_entries, madrasaId, "id");
    await safeSeedTable(admin, "exam_results", dataset.exam_results, madrasaId, "id");

    // 5. Save all metadata (financials, donations, fee structures, bazar, boarding, sessions)
    await saveMadrasaMetadata(madrasaId, dataset.metadata);

    // 6. Revalidate key dashboard paths
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/students");
    revalidatePath("/dashboard/staff");
    revalidatePath("/dashboard/attendance");
    revalidatePath("/dashboard/accounting/expenses");
    revalidatePath("/dashboard/accounting/income");

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
