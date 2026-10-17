import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "@/app/actions/students";
import { getMadrasaMetadata } from "@/lib/sessions";
import { PaymentGatewayConfig, DEFAULT_GATEWAY_CONFIG } from "@/lib/payment-gateway";

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
export async function resolveGatewayMadrasaId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const madrasaId = user ? await getAuthMadrasaId(supabase, user) : null;
    if (madrasaId) return madrasaId;

    const adminClient = await createAdminClient();
    const { data: firstM } = await adminClient.from("madrasas").select("id").limit(1).single();
    return firstM?.id || null;
  } catch {
    return null;
  }
}

/** সম্পূর্ণ gateway কনফিগ (ক্রেডেনশিয়ালসহ) — শুধু সার্ভার-সাইড ব্যবহারের জন্য। */
export async function getFullPaymentGatewayConfig(): Promise<PaymentGatewayConfig> {
  try {
    const madrasaId = await resolveGatewayMadrasaId();
    if (!madrasaId) return DEFAULT_GATEWAY_CONFIG;

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
    console.error("Error in getFullPaymentGatewayConfig:", err);
    return DEFAULT_GATEWAY_CONFIG;
  }
}
