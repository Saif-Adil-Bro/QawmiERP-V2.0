const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

// Load .env.local
const envContent = fs.readFileSync(".env.local", "utf8");
const env = {};
envContent.split("\n").forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = match[2] || "";
    if (val.startsWith("\"") && val.endsWith("\"")) val = val.slice(1, -1);
    env[match[1]] = val;
  }
});

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("Missing Supabase credentials!");
  process.exit(1);
}

const sb = createClient(url, key);

const DEFAULT_FEE_TYPES = [
  { id: "ft_admission", name: "ভর্তি ফি (Admission Fee)", code: "ADMISSION", category: "ACADEMIC", frequency: "ONETIME", default_amount: 2000 },
  { id: "ft_monthly", name: "মাসিক বেতন (Monthly Tuition)", code: "MONTHLY", category: "ACADEMIC", frequency: "MONTHLY", default_amount: 1500 },
  { id: "ft_exam", name: "পরীক্ষার ফি (Exam Fee)", code: "EXAM", category: "ACADEMIC", frequency: "TERM", default_amount: 300 },
  { id: "ft_hostel", name: "বোর্ডিং ও খাবার ফি (Hostel/Food)", code: "HOSTEL", category: "BOARDING", frequency: "MONTHLY", default_amount: 2000 },
  { id: "ft_books", name: "কিতাব ও পাঠ্যপুস্তক ফি (Books)", code: "BOOKS", category: "ACADEMIC", frequency: "ONETIME", default_amount: 1000 },
  { id: "ft_library", name: "কুতুবখানা / লাইব্রেরি ফি", code: "LIBRARY", category: "ACADEMIC", frequency: "YEARLY", default_amount: 200 },
  { id: "ft_idcard", name: "আইডি কার্ড ও ব্যাজ ফি", code: "IDCARD", category: "ADMINISTRATIVE", frequency: "ONETIME", default_amount: 150 },
  { id: "ft_transport", name: "যাতায়াত / পরিবহন ফি", code: "TRANSPORT", category: "OTHER", frequency: "MONTHLY", default_amount: 800 },
  { id: "ft_uniform", name: "পোশাক / ইউনিফর্ম ফি", code: "UNIFORM", category: "ADMINISTRATIVE", frequency: "ONETIME", default_amount: 600 },
  { id: "ft_certificate", name: "সনদ ও প্রশংসাপত্র ফি", code: "CERTIFICATE", category: "ADMINISTRATIVE", frequency: "ONETIME", default_amount: 300 },
  { id: "ft_other", name: "বিবিধ / অন্যান্য ফি", code: "OTHER", category: "OTHER", frequency: "ONETIME", default_amount: 100 },
];

async function runMigration() {
  console.log("=== Starting Safe Fee Data Migration to Relational Tables ===");
  const { data: madrasas, error: mErr } = await sb.from("madrasas").select("id, name, registration_no");
  if (mErr || !madrasas) {
    console.error("Failed to fetch madrasas:", mErr);
    process.exit(1);
  }

  for (const m of madrasas) {
    console.log(`\nProcessing Madrasa: ${m.name} (${m.id})`);
    if (!m.registration_no || !m.registration_no.startsWith("{")) {
      console.log("  No JSON blob found. Skipping.");
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(m.registration_no);
    } catch (e) {
      console.error("  JSON parse error. Skipping.", e.message);
      continue;
    }

    const regNoClean = parsed.reg_no || m.registration_no.slice(0, 50);

    // 1. Fee Types
    const feeTypes = parsed.fee_types && parsed.fee_types.length > 0 ? parsed.fee_types : DEFAULT_FEE_TYPES;
    console.log(`  Migrating ${feeTypes.length} fee types...`);
    for (const ft of feeTypes) {
      await sb.from("fee_types").upsert({
        id: ft.id,
        madrasa_id: m.id,
        name: ft.name,
        code: ft.code || ft.name.slice(0, 10),
        category: ft.category || "ACADEMIC",
        frequency: ft.frequency || "MONTHLY",
        default_amount: Number(ft.default_amount) || 0,
        is_active: ft.is_active !== false,
        is_system: Boolean(ft.is_system),
      }, { onConflict: "id" });
    }

    // 2. Fee Structures
    const feeStructures = parsed.fee_structures || [];
    console.log(`  Migrating ${feeStructures.length} fee structures...`);
    for (const fs of feeStructures) {
      const { error: fsErr } = await sb.from("fee_structures").upsert({
        id: fs.id,
        madrasa_id: m.id,
        session_id: fs.session_id || "default_session",
        class_id: fs.class_id || "ALL",
        class_name: fs.class_name || "সকল জামাত",
        student_category: fs.student_category || "ALL",
        name: fs.name || "ফি কাঠামো",
        total_monthly_amount: Number(fs.total_monthly_amount) || 0,
        total_onetime_amount: Number(fs.total_onetime_amount) || 0,
        created_at: fs.created_at || new Date().toISOString(),
        updated_at: fs.updated_at || new Date().toISOString(),
      }, { onConflict: "id" });

      if (fsErr) {
        console.warn(`  Warning on fee_structure ${fs.id}:`, fsErr.message);
      }

      if (fs.items && Array.isArray(fs.items)) {
        for (const item of fs.items) {
          await sb.from("fee_structure_items").upsert({
            structure_id: fs.id,
            fee_type_id: item.fee_type_id,
            fee_type_name: item.fee_type_name || "",
            amount: Number(item.amount) || 0,
            frequency: item.frequency || "MONTHLY",
          });
        }
      }
    }

    // 3. Student Fees (Invoices/Bills)
    const studentFees = parsed.student_fees || [];
    console.log(`  Migrating ${studentFees.length} student fees...`);
    let sfSuccess = 0;
    for (const sf of studentFees) {
      const { error: sfErr } = await sb.from("student_fees").upsert({
        id: sf.id,
        madrasa_id: sf.madrasa_id || m.id,
        session_id: sf.session_id || "default_session",
        student_id: sf.student_id,
        student_name: sf.student_name || "",
        student_roll: sf.student_roll || "",
        class_id: sf.class_id || null,
        class_name: sf.class_name || "",
        fee_type_id: sf.fee_type_id,
        fee_type_name: sf.fee_type_name || "",
        billing_period: sf.billing_period || "",
        month_name: sf.month_name || "",
        year: String(sf.year || new Date().getFullYear()),
        due_date: sf.due_date || new Date().toISOString().split("T")[0],
        base_amount: Number(sf.base_amount) || 0,
        discount_amount: Number(sf.discount_amount) || 0,
        discount_reason: sf.discount_reason || null,
        fine_amount: Number(sf.fine_amount) || 0,
        fine_reason: sf.fine_reason || null,
        payable_amount: Number(sf.payable_amount) || 0,
        paid_amount: Number(sf.paid_amount) || 0,
        due_amount: Number(sf.due_amount) || 0,
        status: sf.status || "UNPAID",
        created_at: sf.created_at || new Date().toISOString(),
        updated_at: sf.updated_at || new Date().toISOString(),
      }, { onConflict: "id" });

      if (sfErr) {
        console.warn(`  Warning on student_fee ${sf.id}:`, sfErr.message);
      } else {
        sfSuccess++;
      }
    }
    console.log(`  -> Successfully upserted ${sfSuccess}/${studentFees.length} student_fees`);

    // 4. Fee Payments & Allocations
    const payments = parsed.payments || [];
    console.log(`  Migrating ${payments.length} fee payments...`);
    let pSuccess = 0;
    for (const p of payments) {
      const { error: pErr } = await sb.from("fee_payments").upsert({
        id: p.id,
        receipt_no: p.receipt_no,
        madrasa_id: p.madrasa_id || m.id,
        session_id: p.session_id || "default_session",
        student_id: p.student_id,
        student_name: p.student_name || "শিক্ষার্থী",
        student_roll: p.student_roll || "",
        class_name: p.class_name || "",
        total_amount_received: Number(p.total_amount_received) || 0,
        payment_date: p.payment_date || new Date().toISOString().split("T")[0],
        payment_method: p.payment_method || "Cash",
        transaction_ref: p.transaction_ref || null,
        discount_total: Number(p.discount_total) || 0,
        fine_total: Number(p.fine_total) || 0,
        advance_amount: Number(p.advance_amount) || 0,
        collector_name: p.collector_name || "Admin",
        notes: p.notes || "",
        status: p.status || "COMPLETED",
        reversal_reason: p.reversal_reason || null,
        reversed_at: p.reversed_at || null,
        reversed_by: p.reversed_by || null,
        idempotency_key: p.idempotency_key || null,
        created_at: p.created_at || new Date().toISOString(),
      }, { onConflict: "id" });

      if (pErr) {
        console.warn(`  Warning on fee_payment ${p.receipt_no}:`, pErr.message);
      } else {
        pSuccess++;
        if (p.allocations && Array.isArray(p.allocations)) {
          for (const a of p.allocations) {
            await sb.from("fee_payment_allocations").upsert({
              payment_id: p.id,
              student_fee_id: a.student_fee_id || null,
              fee_type_id: a.fee_type_id || null,
              fee_type_name: a.fee_type_name || "",
              billing_period: a.billing_period || "",
              allocated_amount: Number(a.allocated_amount) || 0,
              discount_applied: Number(a.discount_applied) || 0,
              fine_applied: Number(a.fine_applied) || 0,
            });
          }
        }
      }
    }
    console.log(`  -> Successfully upserted ${pSuccess}/${payments.length} fee_payments`);

    // 5. Fee Discounts
    const discounts = parsed.discounts || [];
    console.log(`  Migrating ${discounts.length} discount waivers...`);
    for (const d of discounts) {
      await sb.from("fee_discount_waivers").upsert({
        id: d.id,
        madrasa_id: d.madrasa_id || m.id,
        session_id: d.session_id || "default_session",
        student_id: d.student_id,
        discount_type: d.discount_type || "FIXED",
        value: Number(d.value) || 0,
        fee_type_id: d.fee_type_id || null,
        reason: d.reason || "",
        status: d.status || "APPROVED",
        approved_by: d.approved_by || "Admin",
        created_at: d.created_at || new Date().toISOString(),
      }, { onConflict: "id" });
    }

    // 6. Fee Audit Logs
    const auditLogs = parsed.audit_logs || [];
    console.log(`  Migrating ${auditLogs.length} fee audit logs...`);
    for (const al of auditLogs) {
      await sb.from("fee_audit_logs").upsert({
        id: al.id,
        madrasa_id: al.madrasa_id || m.id,
        action: al.action || "FEE_ACTION",
        user_name: al.user_name || "Admin",
        user_role: al.user_role || "admin",
        record_id: al.record_id || null,
        details: al.details || "",
        created_at: al.created_at || new Date().toISOString(),
      }, { onConflict: "id" });
    }

    // 7. Remove fee arrays from metadata blob to prevent duplicate state and save clean metadata
    delete parsed.student_fees;
    delete parsed.payments;
    delete parsed.discounts;
    delete parsed.fee_structures;
    delete parsed.audit_logs;
    parsed.fee_migrated_to_relational = true;
    parsed.fee_migration_date = new Date().toISOString();

    // Check if other non-fee keys exist (like academic_sessions, biometric_devices, etc.)
    const nonFeeKeys = Object.keys(parsed).filter(k => !["reg_no", "fee_migrated_to_relational", "fee_migration_date", "receipt_counter"].includes(k));
    
    // Save updated metadata back to madrasa
    const updatedPayload = {
      reg_no: regNoClean,
    };
    if (nonFeeKeys.length > 0) {
      updatedPayload.registration_no = JSON.stringify(parsed);
    } else {
      updatedPayload.registration_no = regNoClean;
    }

    const { error: updErr } = await sb.from("madrasas").update(updatedPayload).eq("id", m.id);
    if (updErr) {
      console.error("  Error updating madrasa registration_no:", updErr.message);
    } else {
      console.log(`  Cleaned fee blob from madrasa metadata and set registration_no to: ${regNoClean}`);
    }
  }

  console.log("\n=== Migration Completed Successfully! ===");
}

runMigration().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
