"use server";
import {postingFund} from "@/lib/finance/funds";
import { webIdentity, hasRole, linkedStudents } from "@/lib/portal/identity";
import { studentRoles, teacherRoles } from "@/lib/portal/rules";
import { randomBytes } from "node:crypto";

import { verifyInteractiveFee, type FeeVerificationInput } from "@/lib/fee-settlement";
import { writeGuard } from "@/lib/action-authorization";
import { createAdminClient } from "@/lib/supabase/server";
import { getMadrasaMetadata } from "@/lib/sessions";
import { getFullPaymentGatewayConfig, gatewayManagerIdentity } from "@/lib/payment-gateway-config";
import { revalidatePath } from "next/cache";
import {
  PaymentGatewayConfig,
  DEFAULT_GATEWAY_CONFIG,
  OnlinePaymentTransaction,
} from "@/lib/payment-gateway";
import {
  createRealGatewaySession,
  validateGatewayCredentials,
  bdtPoisha,
  paymentCallbackOrigin,
  sslCommerzAccount,
} from "@/lib/payment-gateway-engine";
import { getStudentFeeProfile } from "./fee-management";

/**
 * 1. পেমেন্ট গেটওয়ে কনফিগ সংক্রান্ত নোট
 *
 * ⛔ পূর্ণ কনফিগ (ক্রেডেনশিয়ালসহ) এখন `lib/payment-gateway-config.ts`-এ —
 * `"use server"` ফাইলে export করলে সেটি লগইন ছাড়াই RPC-তে কলযোগ্য হয়ে যায়।
 * UI/পাবলিক কোডে `toPublicPaymentGatewayConfig()` ব্যবহার করুন।
 */

/**
 * 2. Save / Update Payment Gateway Configuration
 */
export async function savePaymentGatewayConfig(config: Partial<PaymentGatewayConfig>) {
  try {
    const manager = await gatewayManagerIdentity();
    if (!manager) return { error: "গেটওয়ে কনফিগারেশন পরিবর্তনের অনুমতি নেই।" };
    const madrasaId = manager.tenant;
    const currentMeta = await getMadrasaMetadata(madrasaId, true);
    const existingConfig = currentMeta.payment_gateway_config || DEFAULT_GATEWAY_CONFIG;

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

    if (
      mergedConfig.is_enabled &&
      mergedConfig.active_provider === "SSLCOMMERZ" &&
      !sslCommerzAccount(mergedConfig)
    ) {
      return { error: "SSLCommerz চালুর আগে Store ID, password ও Sandbox/Live মোড মিলিয়ে দিন।" };
    }
    const { error } = await manager.db.rpc("replace_portal_gateway_key", {
      p_tenant: madrasaId,
      p_key: "payment_gateway_config",
      p_before: currentMeta.payment_gateway_config ?? null,
      p_after: mergedConfig,
    });

    if (error) {
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
async function paymentOwner(id: string) {
  const i = await webIdentity();
  if (!i || hasRole(i, teacherRoles)) return null;
  if (hasRole(i, studentRoles)) return (await linkedStudents(i, id)).child ? i : null;
  return (await writeGuard("finance")).allowed ? i : null;
}
export async function initiateOnlinePayment(params: {
  student_id: string;
  amount: number;
  payment_channel: "bKash" | "Nagad" | "Rocket" | "Islami Bank" | "Card / Other";
  payer_phone?: string;
  notes?: string;
  selected_fee_ids?: string[];
}) {
  try {
    const principal = bdtPoisha(params.amount);
    const owner = await paymentOwner(params.student_id);
    if (
      !owner ||
      typeof params.amount !== "number" ||
      principal === null ||
      principal <= 0 ||
      principal > 9999999999
    )
      return { error: "শিক্ষার্থী, অনুমতি বা অঙ্ক সঠিক নয়।" };
    const adminClient = await createAdminClient();

    // 1. Fetch Student Info
    const { data: student, error: stdErr } = await adminClient
      .from("students")
      .select("id, madrasa_id, first_name, last_name, roll_number, class_name, parent_phone, classes(name)")
      .eq("madrasa_id", owner.tenant)
      .eq("id", params.student_id)
      .single();

    if (stdErr || !student) {
      return { error: "শিক্ষার্থীর তথ্য পাওয়া যায়নি।" };
    }

    const madrasaId = student.madrasa_id;
    const config = await getFullPaymentGatewayConfig(madrasaId);
    const channelKey = (
      {
        bKash: "bkash",
        Nagad: "nagad",
        Rocket: "rocket",
        "Islami Bank": "islami_bank",
        "Card / Other": "cards",
      } as const
    )[params.payment_channel];
    if (!channelKey || !config.enabled_methods[channelKey]) return { error: "পেমেন্ট মাধ্যম বা অঙ্ক সঠিক নয়।" };
    if (!config.is_enabled) {
      return {
        error: "অনলাইন পেমেন্ট গেটওয়ে বর্তমানে সাময়িকভাবে স্থগিত রয়েছে।",
      };
    }

    const clsObj: any = Array.isArray(student.classes) ? student.classes[0] : student.classes;
    const studentName = `${student.first_name || ""} ${student.last_name || ""}`.trim();
    const className = student.class_name || clsObj?.name || "সাধারণ";
    const studentRoll = student.roll_number ? String(student.roll_number) : "";

    // Generate unique transaction reference
    const now = new Date();
    const transactionId = `TXN-${randomBytes(12).toString("hex")}`;

    // Calculate convenience fee if applicable
    const convPercent = config.convenience_fee_percent ?? 0;
    if (!Number.isFinite(convPercent) || convPercent < 0 || convPercent > 100)
      return { error: "গেটওয়ে চার্জের হার সঠিক নয়।" };
    const convenienceFee = Math.round((params.amount * convPercent) / 100);
    const totalPayable = (principal + convenienceFee * 100) / 100;

    // Get allocations based on selected_fee_ids or auto-match
    const feeProfile = await getStudentFeeProfile(params.student_id);
    if (!feeProfile) return { error: "বিলের তথ্য যাচাই করা যায়নি।" };
    const unpaidFees = feeProfile.fees.filter((f) => Number(f.due_amount) > 0);
    if (params.selected_fee_ids?.some((id) => !unpaidFees.some((f) => f.id === id)))
      return { error: "নির্বাচিত বিল আর বকেয়া নেই।" };

    const allocations: {
      student_fee_id?: string;
      fee_type_id?: string;
      fee_type_name: string;
      billing_period?: string;
      allocated_amount: number;
      fund_id: string;
      fund_name: string;
    }[] = [];

    if (params.selected_fee_ids && new Set(params.selected_fee_ids).size !== params.selected_fee_ids.length)
      return { error: "একই বিল একাধিকবার নির্বাচন করা হয়েছে।" };
    const selected = params.selected_fee_ids?.length
      ? params.selected_fee_ids.map((id) => unpaidFees.find((f) => f.id === id)!)
      : unpaidFees;
    // Work in poisha; no silent overpayment or unallocated dummy fee.
    let poisha = principal;
    for (const fee of selected) {
      const cents = Math.min(poisha, Math.round(100 * Number(fee.due_amount)));
      if (cents <= 0) continue;
      const account=await postingFund(madrasaId,fee.fund_id,'deposit','','',fee.fund_name);
      allocations.push({fund_id:account.id,fund_name:account.name,
        student_fee_id: fee.id,
        fee_type_id: fee.fee_type_id,
        fee_type_name: fee.fee_type_name,
        billing_period: fee.billing_period,
        allocated_amount: cents / 100,
      });
      poisha -= cents;
      if (!poisha) break;
    }
    if (poisha || !allocations.length) return { error: "অঙ্কটি নির্বাচিত বিলের বকেয়ার চেয়ে বেশি।" };

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
      provider: params.payment_channel === "Islami Bank" ? "DIRECT_ISLAMI_BANK" : config.active_provider,
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

      const { error } = await adminClient.rpc("write_portal_fee_intent", {
        p_tenant: madrasaId,
        p_txn: newTxn,
      });
      if (error) return { error: "বিল যাচাই বা ট্রানজেকশন সংরক্ষণ হয়নি।" };

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

    // ⛔ P2-Fix: cus_phone-এ dummy "01700000000" আর যাবে না।
    // আগে `guardian_phone`/`phone` কলাম-এর নাম ভুল ছিল (students-এ আসল কলাম
    // `parent_phone`) — ফলে সব অটোমেটেড পেমেন্ট dummy নম্বরে চলে যেত।
    const cusPhone =
      String(params.payer_phone || "").replace(/[\s-]/g, "") ||
      String((student as any)?.parent_phone || "").replace(/[\s-]/g, "");
    if (!/^01[3-9]\d{8}$/.test(cusPhone)) {
      return {
        error:
          "পেমেন্ট শুরু করা যায়নি — শিক্ষার্থীর প্রোফাইলে বৈধ মোবাইল নম্বর (01XXXXXXXXX) নেই। প্রথমে ফোন নম্বর আপডেট করুন।",
      };
    }

    const appUrl = paymentCallbackOrigin();
    if (!appUrl)
      return { error: "পেমেন্ট callback-এর জন্য এই পরিবেশের NEXT_PUBLIC_APP_URL (HTTPS origin) সেট করুন।" };
    if (newTxn.provider === "SSLCOMMERZ") newTxn.sslcommerz_scope = sslCommerzAccount(config)!.scope;
    const { error: saveError } = await adminClient.rpc("write_portal_fee_intent", {
      p_tenant: madrasaId,
      p_txn: newTxn,
    });
    if (saveError) return { error: "বিল যাচাই বা ট্রানজেকশন সংরক্ষণ হয়নি।" };
    // Call Real Gateway Provider API
    const sessionRes = await createRealGatewaySession(
      {
        tran_id: transactionId,
        amount: totalPayable,
        cus_name: studentName,
        cus_phone: cusPhone,
        cus_email: "student_fee@madrasa.internal",
        product_name: `Student Fee - ${studentName}`,
        product_category: "Education",
        success_url: `${appUrl}/api/payments/sslcommerz/success?tenant=${madrasaId}`,
        fail_url: `${appUrl}/api/payments/sslcommerz/fail`,
        cancel_url: `${appUrl}/api/payments/sslcommerz/cancel`,
        ipn_url: `${appUrl}/api/payments/sslcommerz/ipn?tenant=${madrasaId}`,
        payment_channel: params.payment_channel,
      },
      config,
    );

    if (!sessionRes.success || !sessionRes.gateway_url) {
      return {
        error:
          sessionRes.error ||
          "পেমেন্ট গেটওয়ে সার্ভার থেকে কোনো ভ্যালিড পেমেন্ট লিঙ্ক তৈরি করা যায়নি। ক্রেডেনশিয়ালস বা সংযোগ যাচাই করুন।",
      };
    }

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
export async function verifyAndCompleteOnlinePayment(params: FeeVerificationInput) {
  return verifyInteractiveFee(params);
}

/**
 * 5. Fetch Online Payment Transactions History for Admin
 */
export async function getOnlinePaymentHistory(limit: number = 50) {
  try {
    const i = await webIdentity();
    if (!i || hasRole(i, [...studentRoles, ...teacherRoles]) || !(await writeGuard("finance")).allowed)
      return [];
    const madrasaId = i.tenant;
    const meta = await getMadrasaMetadata(madrasaId);
    const txns: OnlinePaymentTransaction[] = meta.online_transactions || [];
    return txns.slice(0, Math.max(0, Math.min(limit, 500)));
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
    const owner = await paymentOwner(studentId);
    if (!owner) return null;
    const adminClient = await createAdminClient();
    const { data: student, error: stdErr } = await adminClient
      .from("students")
      .select("id, madrasa_id, first_name, last_name, roll_number, class_name, parent_phone, classes(name)")
      .eq("madrasa_id", owner.tenant)
      .eq("id", studentId)
      .single();

    if (stdErr || !student) {
      return null;
    }

    // Get madrasa info
    const { data: madrasa } = await adminClient
      .from("madrasas")
      .select("*")
      .eq("id", student.madrasa_id)
      .single();

    // Get fee profile
    const feeProfile = await getStudentFeeProfile(student.id);
    if (!feeProfile) return null;
    const config = await getFullPaymentGatewayConfig(owner.tenant);

    const clsObj: any = Array.isArray(student.classes) ? student.classes[0] : student.classes;

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
    if (!(await gatewayManagerIdentity()))
      return { success: false, error: "গেটওয়ে কনফিগারেশন যাচাইয়ের অনুমতি নেই।" };
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
      config,
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
export async function verifyOnlineTransactionAsAdmin(transactionId: string, validationId?: string) {
  // ⛔ CR-2: admin-finance guard — আগে এই action-টি guard-হীন ছিল, ফলে লগইন করা
  // যেকোনো ব্যবহারকারী pending ট্রানজেকশন "সফল" হিসেবে চিহ্নিত করতে পারত।
  {
    const __authz = await writeGuard("finance");
    if (!__authz.allowed) return __authz.fallback;
  }

  return verifyAndCompleteOnlinePayment({
    transaction_id: transactionId,
    gateway_ref: validationId, // SSL requires the real val_id; manual transfers use their own transaction reference.
    is_simulated: false,
  });
}

/**
 * 9. Admin Rejection of Online Transaction
 */
export async function rejectOnlineTransactionAsAdmin(transactionId: string, reason?: string) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("finance");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const i = await webIdentity();
    if (!i || hasRole(i, [...studentRoles, ...teacherRoles])) return { error: "অনুমতি নেই।" };
    const { error } = await i.db.rpc("write_portal_fee_intent", {
      p_tenant: i.tenant,
      p_txn: { madrasa_id: i.tenant, transaction_id: transactionId, notes: reason || "প্রশাসন কর্তৃক বাতিল" },
      p_cancel: true,
    });
    if (error) return { error: "অপেক্ষমাণ ট্রানজেকশন পাওয়া যায়নি।" };
    revalidatePath("/dashboard/accounting/gateway");
    return { success: true, message: "ট্রানজেকশন বাতিল হয়েছে।" };
  } catch (err: any) {
    return { error: err.message || "বাতিল করতে সমস্যা হয়েছে।" };
  }
}
