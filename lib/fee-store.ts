import { mergeWaivers, receiptAllocations } from "./portal/ledger";
// Server-only persistence; not a callable Next.js Server Action. Payment callbacks already validate their transaction/tenant.
import { createAdminClient } from "./supabase/admin";
import { getMadrasaMetadata, saveMadrasaMetadata } from "./sessions";
import { getDhakaYear, toDhakaDateString } from "./date-utils";
import {
  DEFAULT_FEE_TYPES,
  type FeeStructure,
  type FeePayment,
  type FeeType,
  type FeeAuditLog,
  type StudentFee,
  type MadrasaFeeData,
} from "./fee-management";
import { rows } from "./portal/queries";
export async function generateNextReceiptNumber(
  adminClient: any,
  madrasaId: string,
  year: number = getDhakaYear(),
): Promise<string> {
  const prefix = `MR-${year}-`;

  const parseCounter = (receiptNo: unknown): number | null => {
    const rec = String(receiptNo ?? "").trim();
    // স্বাভাবিক: "MR-2026-00151"; ব্যতিক্রমী (পুরোনো random suffix): "MR-2026-00166-42"
    const m = rec.match(/^MR-(\d{4})-(\d+)(?:-\d+)?$/);
    if (!m) return null;
    const n = parseInt(m[2], 10);
    return isNaN(n) ? null : n;
  };

  try {
    // ⛔ MD-9 ফিক্স: আগে `.order("receipt_no", { ascending: false }).limit(1)` দিয়ে
    // "সর্বোচ্চ" রসিদ নম্বর বের করা হতো — কিন্তু receipt_no একটি TEXT কলাম, তাই এটি
    // **লেক্সিকোগ্রাফিক** সাজানো: "MR-2026-99999" < "MR-2026-00151-B"? বরং কখনো
    // "9..." বড় অঙ্ক ডানে-বামে মিলিয়ে ভুল সারি প্রথমে আসে এবং সংখ্যাটি সঠিকভাবে
    // পড়া যায় না। ফল: রসিদের ক্রম লাফাচ্ছিল বা পুরোনো নম্বর পুনরাবৃত্তি হচ্ছিল।
    // এখন প্রকৃত সংখ্যা বিশ্লেষণ করে সর্বোচ্চ ক্রম বের করা হয় (suffix-যুক্ত ব্যতিক্রমী
    // মানগুলোও চেনা হয়), তারপর একটি ফাঁকা স্লট খোঁজা হয়।
    const { data } = await adminClient
      .from("fee_payments")
      .select("receipt_no")
      .eq("madrasa_id", madrasaId)
      .like("receipt_no", `${prefix}%`)
      .order("created_at", { ascending: false })
      .limit(2000);

    let maxCounter = 100;
    for (const row of data || []) {
      const n = parseCounter(row?.receipt_no);
      if (n !== null && n > maxCounter) maxCounter = n;
    }

    let nextCounter = maxCounter + 1;

    // Ensure we don't regress below metadata receipt counter
    try {
      const meta = await getMadrasaMetadata(madrasaId);
      if (meta?.receipt_counter && meta.receipt_counter >= nextCounter) {
        nextCounter = meta.receipt_counter + 1;
      }
    } catch {}

    // Auto-retry collision check — এখন ২০০ পর্যন্ত, কারণ ফাঁকা স্লট খুঁজে পাওয়া পর্যন্ত
    // random suffix ব্যবহার করা হয় না (সেটিই পরে max-logic-কে বিভ্রান্ত করত)।
    for (let retry = 0; retry < 200; retry++) {
      const candidate = `${prefix}${String(nextCounter + retry).padStart(5, "0")}`;
      const { data: existing } = await adminClient
        .from("fee_payments")
        .select("id")
        .eq("madrasa_id", madrasaId)
        .eq("receipt_no", candidate)
        .maybeSingle();

      if (!existing) {
        return candidate;
      }
    }

    // চরম সংঘর্ষে (২০০টি ক্রম ধারাবাহিকভাবে দখল) শুধু তখনই suffix — এবং স্পষ্টভাবে লগ করা হয়
    const randSuffix = Math.floor(10 + Math.random() * 90);
    const fallbackNo = `${prefix}${String(nextCounter + 200).padStart(5, "0")}-${randSuffix}`;
    console.warn(
      "[receipt-no] ২০০টি ক্রমই দখল — ব্যতিক্রমী রসিদ নং তৈরি:",
      fallbackNo,
    );
    return fallbackNo;
  } catch (e) {
    console.error("Error generating receipt number:", e);
    const fallbackRand = Math.floor(10000 + Math.random() * 90000);
    console.warn(
      "[receipt-no] DB কুয়েরি ব্যর্থ — সাময়িক রসিদ নং:",
      `${prefix}${fallbackRand}`,
    );
    return `${prefix}${fallbackRand}`;
  }
}

/**
 * Fetch fee data directly from relational PostgreSQL tables
 * with fallback to JSON metadata for unmigrated data.
 */
export async function getFeeMetadata(
  madrasaId: string,
): Promise<MadrasaFeeData> {
  try {
    const adminClient = await createAdminClient();

    // 1. Fetch from relational tables
    const [ftRes, fsRes, sfRes, fpRes, alRes] = await Promise.all([
      adminClient
        .from("fee_types")
        .select("*")
        .eq("madrasa_id", madrasaId)
        .order("created_at", { ascending: true }),
      adminClient
        .from("fee_structures")
        .select("*, fee_structure_items(*)")
        .eq("madrasa_id", madrasaId),
      rows(
        () =>
          adminClient
            .from("student_fees")
            .select("*")
            .eq("madrasa_id", madrasaId)
            .order("created_at", { ascending: false }),
        true,
      ).then((data) => ({ data })),
      rows(
        () =>
          adminClient
            .from("fee_payments")
            .select("*, fee_payment_allocations(*)")
            .eq("madrasa_id", madrasaId)
            .order("created_at", { ascending: false }),
        true,
      ).then((data) => ({ data })),
      adminClient
        .from("fee_audit_logs")
        .select("*")
        .eq("madrasa_id", madrasaId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    const feeStructures: FeeStructure[] = (fsRes.data || []).map((fs: any) => ({
      id: fs.id,
      madrasa_id: fs.madrasa_id,
      session_id: fs.session_id,
      class_id: fs.class_id,
      class_name: fs.class_name,
      student_category: fs.student_category,
      name: fs.name,
      items: (fs.fee_structure_items || []).map((item: any) => ({
        fee_type_id: item.fee_type_id,
        fee_type_name: item.fee_type_name,
        amount: Number(item.amount) || 0,
        frequency: item.frequency,
      })),
      total_monthly_amount: Number(fs.total_monthly_amount) || 0,
      total_onetime_amount: Number(fs.total_onetime_amount) || 0,
      created_at: fs.created_at,
      updated_at: fs.updated_at,
    }));

    const payments: FeePayment[] = (fpRes.data || []).map((p: any) => ({
      id: p.id,
      receipt_no: p.receipt_no,
      db_fee_id: p.db_fee_id,
      madrasa_id: p.madrasa_id,
      session_id: p.session_id,
      student_id: p.student_id,
      student_name: p.student_name,
      student_roll: p.student_roll,
      class_name: p.class_name,
      fund_id: p.fund_id || undefined,
      fund_name: p.fund_name || undefined,
      total_amount_received: Number(p.total_amount_received) || 0,
      payment_date: p.payment_date,
      payment_method: p.payment_method,
      transaction_ref: p.transaction_ref,
      // CR-8 ফিক্স: ফান্ড ম্যাপিং (fund_id/fund_name) এখন পড়া হয় — আগে এই দুটি ফিল্ড
      // বাদ পড়ত, ফলে রিপোর্টে `alloc.fund_id || p.fund_id` সর্বদা undefined হয়ে
      // ফি-প্রকারের নাম দেখে অনুমান করে ফান্ড ঠিক করা হতো (সব ফি General/Lillah-এ যেত)।
      allocations: receiptAllocations(p),
      discount_total: Number(p.discount_total) || 0,
      fine_total: Number(p.fine_total) || 0,
      advance_amount: Number(p.advance_amount) || 0,
      collector_name: p.collector_name,
      notes: p.notes,
      status: p.status,
      // void/reverse মেটাডেটা আগে পড়া হতো না — ফলে বাতিল রসিদের কারণ ও সময় UI-তে ও
      // রিপোর্টে হারিয়ে যেত (getFeeWithReceiptNo-তে যেগুলো দেখানোর কথা)।
      cancellation_reason:
        p.cancellation_reason || p.reversal_reason || undefined,
      reversal_reason: p.reversal_reason || undefined,
      reversed_at: p.reversed_at ? String(p.reversed_at) : undefined,
      reversed_by: p.reversed_by || undefined,
      voided_at: p.voided_at ? String(p.voided_at) : undefined,
      voided_by: p.voided_by || undefined,
      idempotency_key: p.idempotency_key || undefined,
      created_at: p.created_at,
    }));

    const studentFees: StudentFee[] = (sfRes.data || []).map((sf: any) => ({
      ...sf,
      base_amount: Number(sf.base_amount) || 0,
      discount_amount: Number(sf.discount_amount) || 0,
      fine_amount: Number(sf.fine_amount) || 0,
      payable_amount: Number(sf.payable_amount) || 0,
      paid_amount: Number(sf.paid_amount) || 0,
      due_amount: Number(sf.due_amount) || 0,
    }));

    let receiptCounter = 100;
    if (payments.length > 0) {
      for (const p of payments) {
        if (p.receipt_no) {
          const parts = p.receipt_no.split("-");
          const n = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(n) && n > receiptCounter) {
            receiptCounter = n;
          }
        }
      }
    }

    const feeTypes: FeeType[] =
      ftRes.data && ftRes.data.length > 0
        ? ftRes.data.map((ft: any) => ({
            ...ft,
            default_amount: Number(ft.default_amount) || 0,
          }))
        : DEFAULT_FEE_TYPES;

    const auditLogs: FeeAuditLog[] = (alRes.data || []).map((al: any) => ({
      ...al,
    }));

    const meta = await getMadrasaMetadata(madrasaId, true);
    const discounts = mergeWaivers(
      meta.discounts,
      await rows(
        () =>
          adminClient
            .from("fee_discount_waivers")
            .select("*")
            .eq("madrasa_id", madrasaId),
        true,
      ),
    );

    // If relational data exists, prefer it as the single source of truth
    if (
      studentFees.length > 0 ||
      payments.length > 0 ||
      feeStructures.length > 0
    ) {
      return {
        fee_types: feeTypes,
        fee_structures: feeStructures,
        student_fees: studentFees,
        payments,
        discounts,
        audit_logs: auditLogs,
        receipt_counter: receiptCounter,
        student_profiles: meta.student_profiles || {},
      };
    }

    // Fallback if relational has no rows yet
    return {
      fee_types:
        meta.fee_types && meta.fee_types.length > 0 ? meta.fee_types : feeTypes,
      fee_structures:
        meta.fee_structures && meta.fee_structures.length > 0
          ? meta.fee_structures
          : feeStructures,
      student_fees: meta.student_fees || [],
      payments: meta.payments || [],
      discounts,
      audit_logs:
        meta.audit_logs && meta.audit_logs.length > 0
          ? meta.audit_logs
          : auditLogs,
      receipt_counter: meta.receipt_counter || receiptCounter,
      student_profiles: meta.student_profiles || {},
    };
  } catch (err) {
    throw err;
  }
}

/**
 * Helper to save fee metadata into relational tables
 */
export async function saveFeeMetadata(
  madrasaId: string,
  feeData: Partial<MadrasaFeeData>,
): Promise<boolean> {
  try {
    const adminClient = await createAdminClient();

    // ─────────────────────────────────────────────────────────────────────────
    // CR-7 / CR-8 / HI-13 ফিক্স — এই ফাংশনের তিনটি গুরুতর সমস্যা ছিল:
    //
    //  ১. `fee_payment_allocations.upsert()`-এ `id` বা `onConflict` কিছুই দেওয়া হতো না।
    //     টেবিলে `id` হলো DEFAULT gen_random_uuid() — তাই প্রতিবার নতুন row INSERT হয়ে
    //     DUPLICATE তৈরি হতো। `saveFeeMetadata` প্রতি ফি-আদায়ে সর্বশেষ ১০০ পেমেন্ট আবার
    //     লিখে দিত, ফলে রিপোর্টে আয় ক্রমাগত ফুলে উঠত।
    //  ২. `fund_id` / `fund_name` (এবং void-মেটাডেটা) সংরক্ষণ করা হতো না — তাই
    //     "ফি কাঠামো ও ফান্ড ম্যাপিং" ফিচারটি রিপোর্টে সম্পূর্ণ নিষ্ক্রিয় ছিল।
    //  ৩. `slice(0, 500)` / `slice(0, 100)` সীমার কারণে ৫০০-এর বেশি শিক্ষার্থী বা
    //     ১০০-এর বেশি পেমেন্ট থাকলে পুরোনো রেকর্ডগুলো ডেটাবেজে আর আপডেটই হতো না।
    //
    // এখন: সব row bulk upsert হয়, allocation-গুলো "replace" সেমান্টিক্সে (প্রতি পেমেন্টের
    // পুরোনো allocation মুছে নতুন করে লেখা) সেভ হয় এবং কোনো slice সীমা নেই।
    // ─────────────────────────────────────────────────────────────────────────

    const CHUNK = 200;

    async function batchUpsert(table: string, rows: any[], onConflict: string) {
      for (let i = 0; i < rows.length; i += CHUNK) {
        const { error } = await adminClient
          .from(table)
          .upsert(rows.slice(i, i + CHUNK), { onConflict });
        if (error) {
          console.error(
            `Error upserting ${table} (batch ${i / CHUNK}):`,
            error,
          );
          throw new Error(`${table}: ${error.message}`);
        }
      }
    }

    // 1. student_fees
    if (
      Array.isArray(feeData.student_fees) &&
      feeData.student_fees.length > 0
    ) {
      const rows = feeData.student_fees
        .filter((sf) => !!sf?.id)
        .map((sf) => ({
          id: sf.id,
          madrasa_id: sf.madrasa_id || madrasaId,
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
          year: String(sf.year || getDhakaYear()),
          due_date: sf.due_date || toDhakaDateString(),
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
          // CR-8: ফান্ড ম্যাপিং সংরক্ষণ (কলাম না থাকলে upsert পুরো batch ফেল করবে না,
          // কারণ সেটি নিচের retry-তে কলাম-বিহীন payload দিয়ে আবার চেষ্টা করবে)
          fund_id: (sf as any).fund_id || null,
          fund_name: (sf as any).fund_name || null,
        }));

      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const { error } = await adminClient
          .from("student_fees")
          .upsert(chunk, { onConflict: "id" });

        if (error) {
          // fund_id/fund_name কলাম না থাকলে (পুরোনো স্কিমা) — কলাম ছাড়াই retry
          const stripped = chunk.map(({ fund_id, fund_name, ...rest }) => rest);
          const retry = await adminClient
            .from("student_fees")
            .upsert(stripped, { onConflict: "id" });
          if (retry.error) {
            console.error("Error upserting student_fees:", retry.error);
            throw new Error(`student_fees: ${retry.error.message}`);
          }
        }
      }
    }

    // 2. fee_payments + fee_payment_allocations
    if (Array.isArray(feeData.payments) && feeData.payments.length > 0) {
      const payments = feeData.payments.filter((p) => !!p?.id);

      const paymentRows = payments.map((p) => ({
        id: p.id,
        receipt_no: p.receipt_no,
        madrasa_id: p.madrasa_id || madrasaId,
        session_id: p.session_id || "default_session",
        student_id: p.student_id,
        student_name: p.student_name || "শিক্ষার্থী",
        student_roll: p.student_roll || "",
        class_name: p.class_name || "",
        fund_id: p.fund_id || null,
        fund_name: p.fund_name || null,
        total_amount_received: Number(p.total_amount_received) || 0,
        payment_date: p.payment_date || toDhakaDateString(),
        payment_method: p.payment_method || "Cash",
        db_fee_id: p.db_fee_id || null,
        transaction_ref: p.transaction_ref || null,
        discount_total: Number(p.discount_total) || 0,
        fine_total: Number(p.fine_total) || 0,
        // HI-12 ফিক্স: আগে advance_amount সবসময় 0 পাঠানো হতো
        advance_amount: Number(p.advance_amount) || 0,
        collector_name: p.collector_name || "Admin",
        notes: p.notes || "",
        status: p.status || "COMPLETED",
        reversal_reason: p.reversal_reason || null,
        reversed_at: p.reversed_at || null,
        reversed_by: p.reversed_by || null,
        idempotency_key: p.idempotency_key || null,
        created_at: p.created_at || new Date().toISOString(),
      }));

      for (let i = 0; i < paymentRows.length; i += CHUNK) {
        const chunk = paymentRows.slice(i, i + CHUNK);
        const { error } = await adminClient
          .from("fee_payments")
          .upsert(chunk, { onConflict: "id" });

        if (error) {
          // পুরোনো স্কিমায় fund_id/fund_name/idempotency_key না থাকলে সেগুলো বাদ দিয়ে retry
          const stripped = chunk.map(
            ({ fund_id, fund_name, idempotency_key, db_fee_id, ...rest }) =>
              rest,
          );
          const retry = await adminClient
            .from("fee_payments")
            .upsert(stripped, { onConflict: "id" });
          if (retry.error) {
            console.error("Error upserting fee_payments:", retry.error);
            throw new Error(`fee_payments: ${retry.error.message}`);
          }
        }
      }

      // ── allocations: replace semantics (ডুপ্লিকেট প্রতিরোধের মূল সমাধান) ──
      // MD-2: delete-ও chunk-এ ভাগ করা হয়, নাহলে ১০০০+ payment id নিয়ে `.in(...)` ব্যবহার
      // করলে PostgREST-এর URL সীমা ছাড়িয়ে যেতে পারে এবং ডিলিট নীরবে ব্যর্থ হয়ে আবার
      // ডুপ্লিকেট অ্যালোকেশন তৈরি হতে পারে।
      const paymentIds = payments.map((p) => p.id);
      const DELETE_CHUNK = 200;
      for (let i = 0; i < paymentIds.length; i += DELETE_CHUNK) {
        const idChunk = paymentIds.slice(i, i + DELETE_CHUNK);
        const { error: delErr } = await adminClient
          .from("fee_payment_allocations")
          .delete()
          .in("payment_id", idChunk);
        if (delErr) {
          // ডিলিট ব্যর্থ হলে insert করা হলে সবচেয়ে খারাপ অবস্থা: পুরোনো + নতুন ডুপ্লিকেট।
          // তাই স্পষ্টভাবে থামানো হয় — কলার error দেখে ব্যবহারকারী আবার চেষ্টা করবেন।
          console.error(
            "Error clearing previous fee_payment_allocations:",
            delErr,
          );
          throw new Error(`fee_payment_allocations delete: ${delErr.message}`);
        }
      }

      const allocRows: any[] = [];
      for (const p of payments) {
        if (!Array.isArray(p.allocations)) continue;
        const seenAlloc = new Set<string>();
        for (const a of p.allocations) {
          const key = `${a.student_fee_id || ""}|${a.fee_type_id || ""}|${a.billing_period || ""}|${Number(a.allocated_amount) || 0}`;
          if (seenAlloc.has(key)) continue;
          seenAlloc.add(key);
          allocRows.push({
            payment_id: p.id,
            student_fee_id: a.student_fee_id || null,
            fee_type_id: a.fee_type_id || null,
            fee_type_name: a.fee_type_name || "",
            billing_period: a.billing_period || "",
            allocated_amount: Number(a.allocated_amount) || 0,
            discount_applied: Number(a.discount_applied) || 0,
            fine_applied: Number(a.fine_applied) || 0,
            fund_id: a.fund_id || null, // CR-8: ফান্ড ম্যাপিং সংরক্ষণ
            fund_name: a.fund_name || null,
          });
        }
      }

      for (let i = 0; i < allocRows.length; i += CHUNK) {
        const chunk = allocRows.slice(i, i + CHUNK);
        const { error } = await adminClient
          .from("fee_payment_allocations")
          .insert(chunk);
        if (error) {
          const stripped = chunk.map(({ fund_id, fund_name, ...rest }) => rest);
          const retry = await adminClient
            .from("fee_payment_allocations")
            .insert(stripped);
          if (retry.error) {
            console.error(
              "Error inserting fee_payment_allocations:",
              retry.error,
            );
            throw new Error(`fee_payment_allocations: ${retry.error.message}`);
          }
        }
      }
    }

    // 3. ফি-সংক্রান্ত হালকা মেটাডেটা (student_profiles, discounts, receipt_counter)
    const currentMeta = await getMadrasaMetadata(madrasaId);
    const updatedMeta = {
      ...currentMeta,
      student_profiles:
        feeData.student_profiles || currentMeta.student_profiles,
      discounts: feeData.discounts || currentMeta.discounts,
      receipt_counter: feeData.receipt_counter || currentMeta.receipt_counter,
      audit_logs: feeData.audit_logs || currentMeta.audit_logs,
    };
    return await saveMadrasaMetadata(madrasaId, updatedMeta);
  } catch (e: any) {
    console.error("Error saving relational fee data:", e);
    return false;
  }
}

/**
 * Targeted reader for single-student fee collection (`collectFeePayment`).
 * Loads only `fee_types`, the target student's `student_fees`, and lightweight madrasa metadata,
 * avoiding a full-tenant scan of thousands of `student_fees` and `fee_payments`.
 */
export async function readStudentFeeCollectionContext(
  madrasaId: string,
  studentId: string,
): Promise<{
  fee_types: FeeType[];
  student_fees: StudentFee[];
  audit_logs: FeeAuditLog[];
  idempotent_payment: FeePayment | null;
}> {
  const adminClient = await createAdminClient();
  const [ftRes, sfData, meta] = await Promise.all([
    adminClient
      .from("fee_types")
      .select("*")
      .eq("madrasa_id", madrasaId)
      .order("created_at", { ascending: true }),
    rows(
      () =>
        adminClient
          .from("student_fees")
          .select("*")
          .eq("madrasa_id", madrasaId)
          .eq("student_id", studentId)
          .order("created_at", { ascending: false }),
      true,
    ),
    getMadrasaMetadata(madrasaId),
  ]);

  const feeTypes: FeeType[] =
    ftRes.data && ftRes.data.length > 0
      ? ftRes.data.map((ft: any) => ({
          ...ft,
          default_amount: Number(ft.default_amount) || 0,
        }))
      : Array.isArray(meta.fee_types) && meta.fee_types.length > 0
        ? meta.fee_types
        : DEFAULT_FEE_TYPES;

  let studentFees: StudentFee[] = (sfData || []).map((sf: any) => ({
    ...sf,
    base_amount: Number(sf.base_amount) || 0,
    discount_amount: Number(sf.discount_amount) || 0,
    fine_amount: Number(sf.fine_amount) || 0,
    payable_amount: Number(sf.payable_amount) || 0,
    paid_amount: Number(sf.paid_amount) || 0,
    due_amount: Number(sf.due_amount) || 0,
  }));

  if (studentFees.length === 0 && Array.isArray(meta.student_fees)) {
    studentFees = meta.student_fees.filter(
      (sf: any) => sf?.student_id === studentId,
    );
  }

  return {
    fee_types: feeTypes,
    student_fees: studentFees,
    audit_logs: Array.isArray(meta.audit_logs) ? meta.audit_logs : [],
    idempotent_payment: null,
  };
}

/**
 * Targeted writer for a single fee collection (`collectFeePayment`).
 * Upserts only the modified `student_fees` rows, the new `fee_payment`, and its
 * `fee_payment_allocations`, plus lightweight audit log metadata.
 */
export async function saveSingleFeeCollection(
  madrasaId: string,
  params: {
    modifiedStudentFees: StudentFee[];
    newPayment: FeePayment;
    auditLogEntry?: FeeAuditLog;
  },
): Promise<boolean> {
  return saveFeeMetadata(madrasaId, {
    student_fees: params.modifiedStudentFees,
    payments: [params.newPayment],
    ...(params.auditLogEntry
      ? {
          audit_logs: [
            params.auditLogEntry,
            ...((await getMadrasaMetadata(madrasaId)).audit_logs || []),
          ].slice(0, 100),
        }
      : {}),
  });
}
