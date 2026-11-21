import { sslCommerzAccount } from "./payment-gateway-engine";
import { hasRole, webIdentity } from "./portal/identity";
import { studentRoles, teacherRoles } from "./portal/rules";
import { getMadrasaMetadata } from "./sessions";
import { PaymentGatewayConfig, DEFAULT_GATEWAY_CONFIG } from "./payment-gateway";
/**
 * ⛔ কেন এই ফাইলটি `app/actions/payment-gateway.ts`-এর বাইরে?
 *
 * `"use server"` ফাইলের প্রতিটি export আসলে একটি RPC endpoint — ব্রাউজার থেকে
 * সরাসরি কল করা যায়। আগে `getPaymentGatewayConfig()` ওখানেই export ছিল, ফলে
 * লগইন ছাড়াও কেউ সেটি invoke করে `sslcommerz.store_passwd`, `bkash.app_secret`,
 * `shurjopay.merchant_password` — সব পেয়ে যেত।
 *
 * এখন পূর্ণ (secret সহ) কনফিগ কেবল এই সার্ভার-ওনলি মডিউল থেকে পড়া হয়।
 * পাবলিক/ক্লায়েন্ট কোডে সবসময় `toPublicPaymentGatewayConfig()` ব্যবহার করুন।
 */
/** সম্পূর্ণ gateway কনফিগ (ক্রেডেনশিয়ালসহ) — শুধু সার্ভার-সাইড ব্যবহারের জন্য। */
export async function getFullPaymentGatewayConfig(madrasaId: string): Promise<PaymentGatewayConfig> {
  try {
    if (!madrasaId) return DEFAULT_GATEWAY_CONFIG;

    const meta = await getMadrasaMetadata(madrasaId);
    const stored = meta.payment_gateway_config;
    if (stored) {
      return {
        ...DEFAULT_GATEWAY_CONFIG,
        ...stored,
        // Display defaults are not a provisioned merchant. In particular, don't
        // open a sandbox session a later callback can't verify from the raw config.
        is_enabled:
          stored.is_enabled === true &&
          ((stored.active_provider ?? DEFAULT_GATEWAY_CONFIG.active_provider) !== "SSLCOMMERZ" ||
            !!sslCommerzAccount(stored)),
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
    console.error("Error in getFullPaymentGatewayConfig:", err);
    return DEFAULT_GATEWAY_CONFIG;
  }
}

// Reading or replacing merchant credentials requires gateway-management access,
// not merely permission to collect a fee. Used by the page AND its server actions.
export async function gatewayManagerIdentity() {
  const i = await webIdentity();
  return i &&
    !hasRole(i, [...studentRoles, ...teacherRoles]) &&
    (hasRole(i, ["super_admin", "admin", "muhtamim"]) ||
      i.perms.summary.effectivePermissions.includes("finance.manage"))
    ? i
    : null;
}
