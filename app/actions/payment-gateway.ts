"use server";

import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "./students";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";
import { revalidatePath } from "next/cache";
import {
  PaymentGatewayConfig,
  DEFAULT_GATEWAY_CONFIG,
  OnlinePaymentTransaction,
} from "@/lib/payment-gateway";
import {
  createRealGatewaySession,
  validateGatewayCredentials,
  validateSSLCommerzTransaction,
} from "@/lib/payment-gateway-engine";
import {
  getFeeMetadata,
  saveFeeMetadata,
  getStudentFeeProfile,
} from "./fee-management";
import { FeePayment, PaymentAllocation } from "@/lib/fee-management";

export async function getSafeMadrasaId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    let madrasaId = user ? await getAuthMadrasaId(supabase, user) : null;
    if (madrasaId) return madrasaId;

    const adminClient = await createAdminClient();
    const { data: firstM } = await adminClient
      .from("madrasas")
      .select("id")
      .limit(1)
      .single();
    return firstM?.id || "00000000-0000-0000-0000-000000000001";
  } catch {
    return "00000000-0000-0000-0000-000000000001";
  }
}

/**
 * 1. Fetch current Payment Gateway Configuration for the Madrasa
 */
export async function getPaymentGatewayConfig(): Promise<PaymentGatewayConfig> {
  try {
    const madrasaId = await getSafeMadrasaId();
    if (!madrasaId) {
      return DEFAULT_GATEWAY_CONFIG;
    }

    const meta = await getMadrasaMetadata(madrasaId);
    if (meta.payment_gateway_config) {
      return {
        ...DEFAULT_GATEWAY_CONFIG,
        ...meta.payment_gateway_config,
        islami_bank: {
          ...DEFAULT_GATEWAY_CONFIG.islami_bank,
          ...(meta.payment_gateway_config.islami_bank || {}),
        },
        enabled_methods: {
          ...DEFAULT_GATEWAY_CONFIG.enabled_methods,
          ...(meta.payment_gateway_config.enabled_methods || {}),
        },
      };
    }

    return DEFAULT_GATEWAY_CONFIG;
  } catch (err) {
    console.error("Error in getPaymentGatewayConfig:", err);
    return DEFAULT_GATEWAY_CONFIG;
  }
}

/**
 * 2. Save / Update Payment Gateway Configuration
 */
export async function savePaymentGatewayConfig(
  config: Partial<PaymentGatewayConfig>
) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস। অনুগ্রহ করে লগইন করুন।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদরাসা আইডি পাওয়া যায়নি।" };

    const currentMeta = await getMadrasaMetadata(madrasaId);
    const existingConfig =
      currentMeta.payment_gateway_config || DEFAULT_GATEWAY_CONFIG;

    const mergedConfig: PaymentGatewayConfig = {
      ...existingConfig,
      ...config,
      islami_bank: {
        ...existingConfig.islami_bank,
        ...(config.islami_bank || {}),
      },
      enabled_methods: {
        ...existingConfig.enabled_methods,
        ...(config.enabled_methods || {}),
      },
      updated_at: new Date().toISOString(),
    };

    const success = await saveMadrasaMetadata(madrasaId, {
      ...currentMeta,
      payment_gateway_config: mergedConfig,
    });

    if (!success) {
      return { error: "গেটওয়ে কনফিগারেশন সেভ করতে সমস্যা হয়েছে।" };
    }

    revalidatePath("/dashboard/accounting");
    revalidatePath("/dashboard/accounting/gateway");
    revalidatePath("/portal/fees");

    return {
      success: true,
      message: "অনলাইন পেমেন্ট গেটওয়ে কনফিগারেশন সফলভাবে আপডেট করা হয়েছে!",
      config: mergedConfig,
    };
  } catch (err) {
    console.error("Error in savePaymentGatewayConfig:", err);
    return { error: "গেটওয়ে কনফিগারেশন সংরক্ষণে ত্রুটি দেখা দিয়েছে।" };
  }
}

/**
 * 3. Initiate Online Payment Transaction
 */
export async function initiateOnlinePayment(params: {
  student_id: string;
  amount: number;
  payment_channel: "bKash" | "Nagad" | "Rocket" | "Islami Bank" | "Card / Other";
  payer_phone?: string;
  notes?: string;
  selected_fee_ids?: string[];
}) {
  try {
    const adminClient = await createAdminClient();

    // 1. Fetch Student Info
    const { data: student, error: stdErr } = await adminClient
      .from("students")
      .select("id, madrasa_id, first_name, last_name, roll_number, class_name, classes(name)")
      .eq("id", params.student_id)
      .single();

    if (stdErr || !student) {
      return { error: "শিক্ষার্থীর তথ্য পাওয়া যায়নি।" };
    }

    const madrasaId = student.madrasa_id;
    const meta = await getMadrasaMetadata(madrasaId);
    const config: PaymentGatewayConfig =
      meta.payment_gateway_config || DEFAULT_GATEWAY_CONFIG;

    if (!config.is_enabled) {
      return {
        error: "অনলাইন পেমেন্ট গেটওয়ে বর্তমানে সাময়িকভাবে স্থগিত রয়েছে।",
      };
    }

    const clsObj: any = Array.isArray(student.classes)
      ? student.classes[0]
      : student.classes;
    const studentName = `${student.first_name || ""} ${student.last_name || ""}`.trim();
    const className = student.class_name || clsObj?.name || "সাধারণ";
    const studentRoll = student.roll_number ? String(student.roll_number) : "";

    // Generate unique transaction reference
    const now = new Date();
    const dateStr = now.getFullYear().toString() + String(now.getMonth() + 1).padStart(2, "0");
    const randSuffix = Math.floor(100000 + Math.random() * 900000);
    const transactionId = `TXN-${dateStr}-${randSuffix}`;

    // Calculate convenience fee if applicable
    const convPercent = config.convenience_fee_percent || 0;
    const convenienceFee = Math.round((params.amount * convPercent) / 100);
    const totalPayable = params.amount + convenienceFee;

    // Get allocations based on selected_fee_ids or auto-match
    const feeProfile = await getStudentFeeProfile(params.student_id);
    const unpaidFees = feeProfile ? feeProfile.fees.filter((f) => f.due_amount > 0) : [];

    const allocations: {
      student_fee_id?: string;
      fee_type_id?: string;
      fee_type_name: string;
      billing_period?: string;
      allocated_amount: number;
    }[] = [];

    let remaining = params.amount;

    if (params.selected_fee_ids && params.selected_fee_ids.length > 0) {
      for (const feeId of params.selected_fee_ids) {
        const target = unpaidFees.find((f) => f.id === feeId);
        if (target && remaining > 0) {
          const allocAmt = Math.min(remaining, target.due_amount);
          allocations.push({
            student_fee_id: target.id,
            fee_type_id: target.fee_type_id,
            fee_type_name: target.fee_type_name,
            billing_period: target.billing_period,
            allocated_amount: allocAmt,
          });
          remaining -= allocAmt;
        }
      }
    } else {
      // Auto match
      for (const target of unpaidFees) {
        if (remaining <= 0) break;
        const allocAmt = Math.min(remaining, target.due_amount);
        allocations.push({
          student_fee_id: target.id,
          fee_type_id: target.fee_type_id,
          fee_type_name: target.fee_type_name,
          billing_period: target.billing_period,
          allocated_amount: allocAmt,
        });
        remaining -= allocAmt;
      }
    }

    if (remaining > 0 || allocations.length === 0) {
      allocations.push({
        fee_type_name: "অনলাইন বেতন ও ফি",
        billing_period: "চলতি মাস",
        allocated_amount: remaining > 0 ? remaining : params.amount,
      });
    }

    const newTxn: OnlinePaymentTransaction = {
      id: `otxn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      transaction_id: transactionId,
      madrasa_id: madrasaId,
      student_id: student.id,
      student_name: studentName,
      student_roll: studentRoll,
      class_name: className,
      amount: params.amount,
      convenience_fee: convenienceFee,
      total_payable: totalPayable,
      payment_channel: params.payment_channel,
      provider: config.active_provider,
      status: "PENDING",
      payer_phone: params.payer_phone,
      notes: params.notes,
      created_at: now.toISOString(),
      allocations: allocations,
    };

    // 2. Validate Gateway Credentials and Channel Requirements
    if (params.payment_channel === "Islami Bank") {
      const ibCheck = validateGatewayCredentials("DIRECT_ISLAMI_BANK", config);
      if (!ibCheck.isValid) {
        return { error: ibCheck.error || "ইসলামী ব্যাংক একাউন্ট নম্বর সেটিংসে কনফিগার করা নেই।" };
      }

      // Save transaction in online_transactions array in metadata
      const existingTransactions: OnlinePaymentTransaction[] =
        meta.online_transactions || [];
      existingTransactions.unshift(newTxn);

      await saveMadrasaMetadata(madrasaId, {
        ...meta,
        online_transactions: existingTransactions.slice(0, 500),
      });

      return {
        success: true,
        transaction_id: transactionId,
        total_payable: totalPayable,
        provider: "DIRECT_ISLAMI_BANK",
        is_manual_bank: true,
        islami_bank_info: config.islami_bank,
        message: "ইসলামী ব্যাংক ট্রান্সফারের জন্য প্রয়োজনীয় তথ্য প্রদান করা হয়েছে।",
      };
    }

    // Direct Automated Gateway Check (SSLCommerz, bKash Checkout, Shurjopay, AamarPay)
    const credCheck = validateGatewayCredentials(config.active_provider, config);
    if (!credCheck.isValid) {
      return {
        error: credCheck.error || "অনলাইন পেমেন্ট গেটওয়ে সেটিংসে ভুল বা অসম্পূর্ণ ক্রেডেনশিয়ালস রয়েছে।",
      };
    }

    // Call Real Gateway Provider API
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://qawmimanager.app";
    const sessionRes = await createRealGatewaySession(
      {
        tran_id: transactionId,
        amount: totalPayable,
        cus_name: studentName,
        cus_phone: params.payer_phone || (student as any)?.guardian_phone || (student as any)?.phone || "01700000000",
        cus_email: "student_fee@madrasa.internal",
        product_name: `Student Fee - ${studentName}`,
        product_category: "Education",
        success_url: `${appUrl}/api/payments/sslcommerz/success`,
        fail_url: `${appUrl}/api/payments/sslcommerz/fail`,
        cancel_url: `${appUrl}/api/payments/sslcommerz/cancel`,
        ipn_url: `${appUrl}/api/payments/sslcommerz/ipn`,
        payment_channel: params.payment_channel,
      },
      config
    );

    if (!sessionRes.success || !sessionRes.gateway_url) {
      return {
        error:
          sessionRes.error ||
          "পেমেন্ট গেটওয়ে সার্ভার থেকে কোনো ভ্যালিড পেমেন্ট লিঙ্ক তৈরি করা যায়নি। ক্রেডেনশিয়ালস বা সংযোগ যাচাই করুন।",
      };
    }

    // Save transaction in online_transactions array in metadata
    const existingTransactions: OnlinePaymentTransaction[] =
      meta.online_transactions || [];
    existingTransactions.unshift(newTxn);

    await saveMadrasaMetadata(madrasaId, {
      ...meta,
      online_transactions: existingTransactions.slice(0, 500),
    });

    return {
      success: true,
      transaction_id: transactionId,
      total_payable: totalPayable,
      provider: config.active_provider,
      redirect_url: sessionRes.gateway_url,
      gateway_url: sessionRes.gateway_url,
      is_sandbox: config.environment === "SANDBOX" || config.sandbox_test_mode,
      message: "পেমেন্ট গেটওয়ে সেশন সফলভাবে তৈরি হয়েছে। রিডাইরেক্ট করা হচ্ছে...",
    };
  } catch (err: any) {
    console.error("Error in initiateOnlinePayment:", err);
    return { error: err.message || "পেমেন্ট প্রক্রিয়া শুরু করতে ব্যর্থ হয়েছে।" };
  }
}

/**
 * 4. Verify & Settle Online Payment (completes transaction, generates receipt, updates fee records)
 */
export async function verifyAndCompleteOnlinePayment(params: {
  transaction_id: string;
  gateway_ref?: string;
  bank_tran_id?: string;
  payer_phone?: string;
  is_simulated?: boolean;
}) {
  try {
    const adminClient = await createAdminClient();

    // Look for madrasa with this transaction
    const { data: madrasas } = await adminClient
      .from("madrasas")
      .select("id, name, registration_no");

    if (!madrasas || madrasas.length === 0) {
      return { error: "মাদরাসার তথ্য পাওয়া যায়নি।" };
    }

    let targetMadrasa: any = null;
    let targetMeta: any = null;
    let targetTxn: OnlinePaymentTransaction | null = null;
    let txnIndex = -1;

    for (const m of madrasas) {
      if (m.registration_no && m.registration_no.startsWith("{")) {
        try {
          const parsed = JSON.parse(m.registration_no);
          const txns: OnlinePaymentTransaction[] = parsed.online_transactions || [];
          const idx = txns.findIndex((t) => t.transaction_id === params.transaction_id);
          if (idx >= 0) {
            targetMadrasa = m;
            targetMeta = parsed;
            targetTxn = txns[idx];
            txnIndex = idx;
            break;
          }
        } catch {}
      }
    }

    if (!targetMadrasa || !targetTxn) {
      return { error: "ট্রানজেকশন তথ্য পাওয়া যায়নি।" };
    }

    if (targetTxn.status === "SUCCESS") {
      return {
        success: true,
        already_paid: true,
        message: "এই পেমেন্টটি ইতিমধ্যে পরিশোধিত হয়েছে।",
        receipt_no: targetTxn.receipt_no,
        transaction_id: targetTxn.transaction_id,
      };
    }

    const madrasaId = targetMadrasa.id;
    const now = new Date().toISOString();

    // 1. Get Fee Metadata
    const feeMeta = await getFeeMetadata(madrasaId);
    const currentYear = new Date().getFullYear();
    const newCounter = (feeMeta.receipt_counter || 100) + 1;
    const receiptNo = `MR-${currentYear}-${String(newCounter).padStart(5, "0")}`;

    // 2. Update Student Fees
    const studentFees = [...(feeMeta.student_fees || [])];
    const finalAllocations: PaymentAllocation[] = [];

    if (targetTxn.allocations && targetTxn.allocations.length > 0) {
      for (const alloc of targetTxn.allocations) {
        finalAllocations.push({
          student_fee_id: alloc.student_fee_id,
          fee_type_id: alloc.fee_type_id,
          fee_type_name: alloc.fee_type_name,
          billing_period: alloc.billing_period,
          allocated_amount: alloc.allocated_amount,
        });

        if (alloc.student_fee_id) {
          const feeIdx = studentFees.findIndex((f) => f.id === alloc.student_fee_id);
          if (feeIdx >= 0) {
            const target = studentFees[feeIdx];
            const newPaid = (target.paid_amount || 0) + alloc.allocated_amount;
            const newDue = Math.max(0, target.payable_amount - newPaid);
            studentFees[feeIdx] = {
              ...target,
              paid_amount: newPaid,
              due_amount: newDue,
              status: newDue === 0 ? "PAID" : "PARTIAL",
              updated_at: now,
            };
          }
        }
      }
    }

    // Map payment channel to standard PaymentMethod
    let paymentMethodCode: "bKash" | "Nagad" | "Rocket" | "Bank" | "Other" = "bKash";
    if (targetTxn.payment_channel === "Nagad") paymentMethodCode = "Nagad";
    else if (targetTxn.payment_channel === "Rocket") paymentMethodCode = "Rocket";
    else if (targetTxn.payment_channel === "Islami Bank") paymentMethodCode = "Bank";
    else if (targetTxn.payment_channel === "Card / Other") paymentMethodCode = "Other";

    // 3. Create Official Payment Receipt Record
    const newPayment: FeePayment = {
      id: `pay_online_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      receipt_no: receiptNo,
      madrasa_id: madrasaId,
      session_id: "online",
      student_id: targetTxn.student_id,
      student_name: targetTxn.student_name,
      student_roll: targetTxn.student_roll,
      class_name: targetTxn.class_name,
      total_amount_received: targetTxn.amount,
      payment_date: now.split("T")[0],
      payment_method: paymentMethodCode,
      transaction_ref: params.gateway_ref || targetTxn.transaction_id,
      allocations: finalAllocations,
      discount_total: 0,
      fine_total: 0,
      advance_amount: 0,
      collector_name: `অনলাইন গেটওয়ে (${targetTxn.payment_channel})`,
      notes: `[অনলাইন ট্রানজেকশন ID: ${targetTxn.transaction_id}] ${targetTxn.notes || ""}`,
      status: "COMPLETED",
      created_at: now,
    };

    const payments = [...(feeMeta.payments || [])];
    payments.unshift(newPayment);

    // 4. Update the Online Transaction status to SUCCESS
    const updatedTxn: OnlinePaymentTransaction = {
      ...targetTxn,
      status: "SUCCESS",
      receipt_no: receiptNo,
      gateway_ref: params.gateway_ref || targetTxn.transaction_id,
      bank_tran_id: params.bank_tran_id || `BANK-${Date.now()}`,
      payer_phone: params.payer_phone || targetTxn.payer_phone,
      completed_at: now,
    };

    const txns = targetMeta.online_transactions || [];
    txns[txnIndex] = updatedTxn;

    // 5. Insert into Supabase `fees` table for backwards compatibility
    const { data: dbFee } = await adminClient.from("fees").insert({
      madrasa_id: madrasaId,
      student_id: targetTxn.student_id,
      fee_type: "Monthly",
      amount: targetTxn.amount,
      payment_date: now.split("T")[0],
      fee_month: new Date().toLocaleString("en-US", { month: "long" }),
      fee_year: currentYear,
      notes: `[অনলাইন পেমেন্ট: ${receiptNo} | Trx: ${targetTxn.transaction_id}]`,
    }).select("id").single();

    if (dbFee?.id) {
      newPayment.db_fee_id = dbFee.id;
    }

    // 6. Save fee metadata
    await saveFeeMetadata(madrasaId, {
      student_fees: studentFees,
      payments: payments.slice(0, 500),
      receipt_counter: newCounter,
    });

    // 7. Save online transactions into madrasa metadata
    await saveMadrasaMetadata(madrasaId, {
      ...targetMeta,
      online_transactions: txns.slice(0, 500),
    });

    revalidatePath("/dashboard/accounting");
    revalidatePath("/dashboard/accounting/fees");
    revalidatePath("/dashboard/accounting/payments");
    revalidatePath("/dashboard/accounting/due");
    revalidatePath("/portal/fees");

    return {
      success: true,
      message: "আলহামদুলিল্লাহ! আপনার ফি পেমেন্ট সফলভাবে সম্পন্ন হয়েছে।",
      receipt_no: receiptNo,
      transaction_id: targetTxn.transaction_id,
      amount: targetTxn.amount,
      student_name: targetTxn.student_name,
      payment_date: now.split("T")[0],
      payment_channel: targetTxn.payment_channel,
    };
  } catch (err: any) {
    console.error("Error in verifyAndCompleteOnlinePayment:", err);
    return { error: err.message || "পেমেন্ট ভেরিফিকেশনে ত্রুটি হয়েছে।" };
  }
}

/**
 * 5. Fetch Online Payment Transactions History for Admin
 */
export async function getOnlinePaymentHistory(limit: number = 50) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    let madrasaId = user ? await getAuthMadrasaId(supabase, user) : null;

    if (!madrasaId) {
      const adminClient = await createAdminClient();
      const { data: firstM } = await adminClient
        .from("madrasas")
        .select("id")
        .limit(1)
        .single();
      madrasaId = firstM?.id || null;
    }

    if (!madrasaId) return [];

    const meta = await getMadrasaMetadata(madrasaId);
    const txns: OnlinePaymentTransaction[] = meta.online_transactions || [];
    return txns.slice(0, limit);
  } catch (err) {
    console.error("Error in getOnlinePaymentHistory:", err);
    return [];
  }
}

/**
 * 6. Get Public Student Fee Info for Direct Pay link (/pay?student_id=...)
 */
export async function getStudentPublicFeeInfo(studentId: string) {
  try {
    const adminClient = await createAdminClient();
    const { data: student, error: stdErr } = await adminClient
      .from("students")
      .select("id, madrasa_id, first_name, last_name, roll_number, class_name, parent_phone, classes(name)")
      .eq("id", studentId)
      .single();

    if (stdErr || !student) {
      return null;
    }

    // Get madrasa info
    const { data: madrasa } = await adminClient
      .from("madrasas")
      .select("id, name, address, phone")
      .eq("id", student.madrasa_id)
      .single();

    // Get fee profile
    const feeProfile = await getStudentFeeProfile(student.id);
    const config = await getPaymentGatewayConfig();

    const clsObj: any = Array.isArray(student.classes)
      ? student.classes[0]
      : student.classes;

    return {
      student: {
        id: student.id,
        name: `${student.first_name || ""} ${student.last_name || ""}`.trim() || "শিক্ষার্থী",
        roll: student.roll_number || "-",
        class_name: student.class_name || clsObj?.name || "সাধারণ জামাত",
        parent_phone: student.parent_phone || "",
      },
      madrasa: {
        name: madrasa?.name || "কওমি মাদরাসা",
        address: madrasa?.address || "",
        phone: madrasa?.phone || "",
      },
      fee_summary: {
        total_due: feeProfile ? feeProfile.total_due || 0 : 0,
        unpaid_fees: feeProfile ? feeProfile.fees.filter((f) => f.due_amount > 0) : [],
      },
      gateway_config: {
        is_enabled: config.is_enabled,
        active_provider: config.active_provider,
        environment: config.environment,
        enabled_methods: config.enabled_methods,
        islami_bank: config.islami_bank,
        convenience_fee_percent: config.convenience_fee_percent || 0,
      },
    };
  } catch (err) {
    console.error("Error in getStudentPublicFeeInfo:", err);
    return null;
  }
}

/**
 * 7. Test Gateway Credentials Action
 */
export async function testGatewayCredentialsAction(config: PaymentGatewayConfig) {
  try {
    const credCheck = validateGatewayCredentials(config.active_provider, config);
    if (!credCheck.isValid) {
      return {
        success: false,
        error: credCheck.error || "গেটওয়ে ক্রেডেনশিয়ালস অসম্পূর্ণ বা ভুল।",
      };
    }

    // Attempt dummy handshake test session
    const testSession = await createRealGatewaySession(
      {
        tran_id: `TEST-${Date.now()}`,
        amount: 10,
        cus_name: "Gateway Ping Test",
        cus_phone: "01700000000",
        product_name: "Credential Verification Ping",
        product_category: "Test",
        success_url: "https://example.com/success",
        fail_url: "https://example.com/fail",
        cancel_url: "https://example.com/cancel",
      },
      config
    );

    if (!testSession.success) {
      return {
        success: false,
        error: `গেটওয়ে কানেকশন টেস্ট ব্যর্থ: ${testSession.error}`,
      };
    }

    const providerNames: Record<string, string> = {
      SSLCOMMERZ: "SSLCommerz",
      BKASH_CHECKOUT: "bKash Direct",
      SHURJOPAY: "ShurjoPay",
      AAMARPAY: "AamarPay",
      DIRECT_ISLAMI_BANK: "ইসলামী ব্যাংক (IBBL / CellFin)",
    };
    const friendlyName = providerNames[config.active_provider] || config.active_provider;

    return {
      success: true,
      message: `আলহামদুলিল্লাহ! ${friendlyName} সফলভাবে যাচাই ও সক্রিয় করা হয়েছে।`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `কানেকশন টেস্ট এরর: ${err.message || "সার্ভারে পৌঁছানো যায়নি"}`,
    };
  }
}

/**
 * 8. Admin Manual Verification of Pending Online Transaction
 */
export async function verifyOnlineTransactionAsAdmin(transactionId: string) {
  return verifyAndCompleteOnlinePayment({
    transaction_id: transactionId,
    gateway_ref: `ADMIN-VERIFIED-${Date.now()}`,
    is_simulated: false,
  });
}

/**
 * 9. Admin Rejection of Online Transaction
 */
export async function rejectOnlineTransactionAsAdmin(
  transactionId: string,
  reason?: string
) {
  try {
    const adminClient = await createAdminClient();
    const { data: madrasas } = await adminClient
      .from("madrasas")
      .select("id, registration_no");

    if (!madrasas) return { error: "মাদরাসার তথ্য পাওয়া যায়নি" };

    for (const m of madrasas) {
      if (m.registration_no && m.registration_no.startsWith("{")) {
        try {
          const parsed = JSON.parse(m.registration_no);
          const txns: OnlinePaymentTransaction[] = parsed.online_transactions || [];
          const idx = txns.findIndex((t) => t.transaction_id === transactionId);
          if (idx >= 0) {
            txns[idx].status = "FAILED";
            txns[idx].notes = `[অ্যাডমিন কর্তৃক বাতিল: ${reason || "অননুমোদিত বা ভুল ট্রানজেকশন"}] ${txns[idx].notes || ""}`;
            parsed.online_transactions = txns;
            await saveMadrasaMetadata(m.id, parsed);
            revalidatePath("/dashboard/accounting/gateway");
            return { success: true, message: "ট্রানজেকশনটি সফলভাবে বাতিল করা হয়েছে।" };
          }
        } catch {}
      }
    }

    return { error: "ট্রানজেকশন পাওয়া যায়নি।" };
  } catch (err: any) {
    return { error: err.message || "বাতিল করতে সমস্যা হয়েছে।" };
  }
}

