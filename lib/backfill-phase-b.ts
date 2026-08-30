import { createAdminClient } from "@/lib/supabase/server";
import { DEFAULT_FEE_TYPES } from "@/lib/fee-management";
import { DEFAULT_FUNDS } from "@/lib/fund-utils";
import { getDefaultSessions } from "@/lib/sessions";

/**
 * Backfill & Data Migration Script:
 * Migrates existing data from madrasas.registration_no JSON blob into dedicated relational tables.
 * Safe to run multiple times (idempotent with ON CONFLICT / duplicate checks).
 */
export async function runPhaseBBackfill(options: { dryRun?: boolean; targetMadrasaId?: string } = {}) {
  const { dryRun = false, targetMadrasaId } = options;
  const adminClient = await createAdminClient();

  const report: {
    madrasasProcessed: number;
    sessionsMigrated: number;
    enrollmentsMigrated: number;
    feeTypesMigrated: number;
    feeStructuresMigrated: number;
    studentFeesMigrated: number;
    feePaymentsMigrated: number;
    zakatFundsMigrated: number;
    madrasaColumnsUpdated: number;
    errors: string[];
  } = {
    madrasasProcessed: 0,
    sessionsMigrated: 0,
    enrollmentsMigrated: 0,
    feeTypesMigrated: 0,
    feeStructuresMigrated: 0,
    studentFeesMigrated: 0,
    feePaymentsMigrated: 0,
    zakatFundsMigrated: 0,
    madrasaColumnsUpdated: 0,
    errors: [],
  };

  try {
    let query = adminClient.from("madrasas").select("*");
    if (targetMadrasaId) {
      query = query.eq("id", targetMadrasaId);
    }
    const { data: madrasas, error: madrasaErr } = await query;

    if (madrasaErr) {
      report.errors.push(`Failed to fetch madrasas: ${madrasaErr.message}`);
      return report;
    }

    if (!madrasas || madrasas.length === 0) {
      return report;
    }

    for (const madrasa of madrasas) {
      report.madrasasProcessed++;
      const madrasaId = madrasa.id;

      let meta: any = {};
      if (madrasa.registration_no && typeof madrasa.registration_no === "string") {
        if (madrasa.registration_no.startsWith("{")) {
          try {
            meta = JSON.parse(madrasa.registration_no);
          } catch {
            meta = { reg_no: madrasa.registration_no };
          }
        } else {
          meta = { reg_no: madrasa.registration_no };
        }
      }

      // -------------------------------------------------------------
      // 1. Madrasa Columns Migration (Direct columns on madrasas table)
      // -------------------------------------------------------------
      const madrasaUpdates: Record<string, any> = {};
      if (meta.reg_no && !madrasa.reg_no) madrasaUpdates.reg_no = meta.reg_no;
      if (meta.established_year && !madrasa.established_year) madrasaUpdates.established_year = meta.established_year;
      if (meta.principal_name && !madrasa.principal_name) madrasaUpdates.principal_name = meta.principal_name;
      if (meta.signature_url && !madrasa.signature_url) madrasaUpdates.signature_url = meta.signature_url;
      if (meta.eiin_code && !madrasa.eiin_code) madrasaUpdates.eiin_code = meta.eiin_code;
      if (meta.slogan && !madrasa.slogan) madrasaUpdates.slogan = meta.slogan;
      if (meta.website && !madrasa.website) madrasaUpdates.website = meta.website;
      if (meta.logo_url && !madrasa.logo_url) madrasaUpdates.logo_url = meta.logo_url;

      if (Object.keys(madrasaUpdates).length > 0) {
        if (!dryRun) {
          const { error } = await adminClient
            .from("madrasas")
            .update(madrasaUpdates)
            .eq("id", madrasaId);
          if (error) {
            report.errors.push(`Madrasa ${madrasaId} column update failed: ${error.message}`);
          } else {
            report.madrasaColumnsUpdated++;
          }
        } else {
          report.madrasaColumnsUpdated++;
        }
      }

      // -------------------------------------------------------------
      // 2. Academic Sessions Migration
      // -------------------------------------------------------------
      const sessionsList = (meta.sessions && Array.isArray(meta.sessions) && meta.sessions.length > 0)
        ? meta.sessions
        : getDefaultSessions(madrasaId);

      for (const s of sessionsList) {
        const sessionPayload = {
          id: s.id,
          madrasa_id: madrasaId,
          name: s.name || "১৪৪৭-৪৮ হিজরি",
          code: s.academic_year || "2026-27",
          hijri_year: s.hijri_year || "1447-48",
          start_date: s.start_date || "2026-04-15",
          end_date: s.end_date || "2027-04-05",
          is_active: Boolean(s.is_current),
          status: s.status || (s.is_current ? "ACTIVE" : "ARCHIVED"),
          created_at: s.created_at || new Date().toISOString(),
          updated_at: s.updated_at || new Date().toISOString(),
        };

        if (!dryRun) {
          const { error } = await adminClient
            .from("academic_sessions")
            .upsert(sessionPayload, { onConflict: "id" });
          if (error) {
            // Note: table may not exist yet if SQL migration hasn't been executed on Supabase, catch gracefully
            report.errors.push(`Session ${s.id} upsert: ${error.message}`);
          } else {
            report.sessionsMigrated++;
          }
        } else {
          report.sessionsMigrated++;
        }
      }

      // -------------------------------------------------------------
      // 3. Student Enrollments Migration
      // -------------------------------------------------------------
      if (meta.enrollments && Array.isArray(meta.enrollments)) {
        for (const enr of meta.enrollments) {
          if (!enr.student_id || !enr.session_id) continue;
          const enrPayload = {
            id: enr.id || `enr_${enr.session_id}_${enr.student_id}`,
            madrasa_id: madrasaId,
            session_id: enr.session_id,
            student_id: enr.student_id,
            class_id: enr.class_id || "general",
            roll_number: enr.roll_number || "",
            status: enr.status || "ACTIVE",
            remarks: enr.remarks || "",
            created_at: enr.created_at || new Date().toISOString(),
          };

          if (!dryRun) {
            const { error } = await adminClient
              .from("student_enrollments")
              .upsert(enrPayload, { onConflict: "session_id,student_id" });
            if (error) {
              report.errors.push(`Enrollment ${enr.id} upsert: ${error.message}`);
            } else {
              report.enrollmentsMigrated++;
            }
          } else {
            report.enrollmentsMigrated++;
          }
        }
      }

      // -------------------------------------------------------------
      // 4. Fee Types Migration
      // -------------------------------------------------------------
      const feeTypesList = (meta.fee_types && Array.isArray(meta.fee_types) && meta.fee_types.length > 0)
        ? meta.fee_types
        : DEFAULT_FEE_TYPES;

      for (const ft of feeTypesList) {
        const ftPayload = {
          id: ft.id,
          madrasa_id: madrasaId,
          name: ft.name,
          code: ft.code || ft.name,
          category: ft.category || "ACADEMIC",
          frequency: ft.frequency || "MONTHLY",
          default_amount: Number(ft.default_amount || 0),
          is_active: ft.is_active !== false,
          is_system: Boolean(ft.is_system),
        };

        if (!dryRun) {
          const { error } = await adminClient
            .from("fee_types")
            .upsert(ftPayload, { onConflict: "id" });
          if (error) {
            report.errors.push(`FeeType ${ft.id} upsert: ${error.message}`);
          } else {
            report.feeTypesMigrated++;
          }
        } else {
          report.feeTypesMigrated++;
        }
      }

      // -------------------------------------------------------------
      // 5. Fee Structures & Items Migration
      // -------------------------------------------------------------
      if (meta.fee_structures && Array.isArray(meta.fee_structures)) {
        for (const fs of meta.fee_structures) {
          const structPayload = {
            id: fs.id,
            madrasa_id: madrasaId,
            session_id: fs.session_id || "default",
            class_id: fs.class_id || "ALL",
            class_name: fs.class_name || "সকল জামাত",
            student_category: fs.student_category || "ALL",
            name: fs.name || "ফি কাঠামো",
            total_monthly_amount: Number(fs.total_monthly_amount || 0),
            total_onetime_amount: Number(fs.total_onetime_amount || 0),
            created_at: fs.created_at || new Date().toISOString(),
            updated_at: fs.updated_at || new Date().toISOString(),
          };

          if (!dryRun) {
            const { error: fsErr } = await adminClient
              .from("fee_structures")
              .upsert(structPayload, { onConflict: "id" });
            if (fsErr) {
              report.errors.push(`FeeStructure ${fs.id} upsert: ${fsErr.message}`);
            } else {
              report.feeStructuresMigrated++;

              // Items
              if (fs.items && Array.isArray(fs.items)) {
                for (const item of fs.items) {
                  const itemPayload = {
                    structure_id: fs.id,
                    fee_type_id: item.fee_type_id || null,
                    fee_type_name: item.fee_type_name || "ফি",
                    amount: Number(item.amount || 0),
                    frequency: item.frequency || "MONTHLY",
                  };
                  await adminClient.from("fee_structure_items").insert(itemPayload);
                }
              }
            }
          } else {
            report.feeStructuresMigrated++;
          }
        }
      }

      // -------------------------------------------------------------
      // 6. Student Fees Migration (Invoices)
      // -------------------------------------------------------------
      if (meta.student_fees && Array.isArray(meta.student_fees)) {
        for (const sf of meta.student_fees) {
          if (!sf.student_id) continue;
          const feePayload = {
            id: sf.id,
            madrasa_id: madrasaId,
            session_id: sf.session_id || "default",
            student_id: sf.student_id,
            student_name: sf.student_name || "",
            student_roll: sf.student_roll || "",
            class_id: sf.class_id || "",
            class_name: sf.class_name || "",
            fee_type_id: sf.fee_type_id,
            fee_type_name: sf.fee_type_name || "ফি",
            billing_period: sf.billing_period || "General",
            month_name: sf.month_name || "",
            year: sf.year || "",
            due_date: sf.due_date ? sf.due_date.substring(0, 10) : null,
            base_amount: Number(sf.base_amount || 0),
            discount_amount: Number(sf.discount_amount || 0),
            discount_reason: sf.discount_reason || null,
            fine_amount: Number(sf.fine_amount || 0),
            fine_reason: sf.fine_reason || null,
            payable_amount: Number(sf.payable_amount || 0),
            paid_amount: Number(sf.paid_amount || 0),
            due_amount: Number(sf.due_amount || 0),
            status: sf.status || "UNPAID",
            created_at: sf.created_at || new Date().toISOString(),
            updated_at: sf.updated_at || new Date().toISOString(),
          };

          if (!dryRun) {
            const { error: sfErr } = await adminClient
              .from("student_fees")
              .upsert(feePayload, { onConflict: "madrasa_id,session_id,student_id,fee_type_id,billing_period" });
            if (sfErr) {
              report.errors.push(`StudentFee ${sf.id} upsert: ${sfErr.message}`);
            } else {
              report.studentFeesMigrated++;
            }
          } else {
            report.studentFeesMigrated++;
          }
        }
      }

      // -------------------------------------------------------------
      // 7. Fee Payments Migration
      // -------------------------------------------------------------
      if (meta.payments && Array.isArray(meta.payments)) {
        for (const p of meta.payments) {
          if (!p.student_id || !p.receipt_no) continue;
          const payPayload = {
            id: p.id,
            receipt_no: p.receipt_no,
            madrasa_id: madrasaId,
            session_id: p.session_id || "default",
            student_id: p.student_id,
            student_name: p.student_name || "শিক্ষার্থী",
            student_roll: p.student_roll || "",
            class_name: p.class_name || "",
            total_amount_received: Number(p.total_amount_received || 0),
            payment_date: p.payment_date ? p.payment_date.substring(0, 10) : new Date().toISOString().substring(0, 10),
            payment_method: p.payment_method || "Cash",
            transaction_ref: p.transaction_ref || null,
            discount_total: Number(p.discount_total || 0),
            fine_total: Number(p.fine_total || 0),
            advance_amount: Number(p.advance_amount || 0),
            collector_name: p.collector_name || "Admin",
            notes: p.notes || null,
            status: p.status || "COMPLETED",
            created_at: p.created_at || new Date().toISOString(),
          };

          if (!dryRun) {
            const { error: pErr } = await adminClient
              .from("fee_payments")
              .upsert(payPayload, { onConflict: "madrasa_id,receipt_no" });
            if (pErr) {
              report.errors.push(`Payment ${p.id} upsert: ${pErr.message}`);
            } else {
              report.feePaymentsMigrated++;

              // Allocations
              if (p.allocations && Array.isArray(p.allocations)) {
                for (const alloc of p.allocations) {
                  const allocPayload = {
                    payment_id: p.id,
                    student_fee_id: alloc.student_fee_id || null,
                    fee_type_id: alloc.fee_type_id || null,
                    fee_type_name: alloc.fee_type_name || "ফি",
                    billing_period: alloc.billing_period || null,
                    allocated_amount: Number(alloc.allocated_amount || 0),
                    discount_applied: Number(alloc.discount_applied || 0),
                    fine_applied: Number(alloc.fine_applied || 0),
                  };
                  await adminClient.from("fee_payment_allocations").insert(allocPayload);
                }
              }
            }
          } else {
            report.feePaymentsMigrated++;
          }
        }
      }

      // -------------------------------------------------------------
      // 8. Zakat & Custom Funds Migration
      // -------------------------------------------------------------
      const zakatFundsList = (meta.custom_funds && Array.isArray(meta.custom_funds))
        ? meta.custom_funds
        : DEFAULT_FUNDS;

      for (const f of zakatFundsList) {
        const fundPayload = {
          id: f.id,
          madrasa_id: madrasaId,
          name: f.name,
          code: f.code || "FND",
          category: f.category || "General",
          description: f.description || "",
          target_amount: Number(f.target_amount || 0),
          current_balance: Number(f.current_balance || 0),
          is_active: f.is_active !== false,
        };

        if (!dryRun) {
          const { error: fErr } = await adminClient
            .from("zakat_funds")
            .upsert(fundPayload, { onConflict: "id" });
          if (fErr) {
            report.errors.push(`ZakatFund ${f.id} upsert: ${fErr.message}`);
          } else {
            report.zakatFundsMigrated++;
          }
        } else {
          report.zakatFundsMigrated++;
        }
      }
    }
  } catch (err: any) {
    report.errors.push(`Unhandled migration exception: ${err.message}`);
  }

  return report;
}
