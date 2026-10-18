import { PaymentMethod } from "./fee-management";

export type PaymentGatewayProvider =
  | "SSLCOMMERZ"
  | "SHURJOPAY"
  | "BKASH_CHECKOUT"
  | "AAMARPAY"
  | "DIRECT_ISLAMI_BANK";

export type GatewayEnvironment = "SANDBOX" | "LIVE";

export interface IslamiBankConfig {
  account_name: string; // e.g. "জামেয়া আরাবিয়া ইসলামিয়া"
  account_number: string; // e.g. "20501450200123456"
  branch_name: string; // e.g. "মিরপুর শাখা, ঢাকা"
  routing_number?: string; // e.g. "125262728"
  cellfin_number?: string; // e.g. "01812345678"
  instructions?: string; // "সরাসরি সেলফিন বা ইন্টারনেট ব্যাংকিংয়ের মাধ্যমে ফি পাঠিয়ে ট্রানজেকশন রেফারেন্স দিন"
}

export interface PaymentGatewayConfig {
  is_enabled: boolean;
  active_provider: PaymentGatewayProvider;
  environment: GatewayEnvironment;
  
  // Provider Credentials
  sslcommerz: {
    store_id: string;
    store_passwd: string;
    is_live: boolean;
  };
  shurjopay: {
    merchant_username: string;
    merchant_password: string;
    merchant_prefix: string;
    is_live: boolean;
  };
  bkash: {
    app_key: string;
    app_secret: string;
    username: string;
    password: string;
    is_live: boolean;
  };
  aamarpay: {
    store_id: string;
    signature_key: string;
    is_live: boolean;
  };

  // Islami Bank (IBBL) Direct Banking
  islami_bank: IslamiBankConfig;

  // Enabled Channel Methods
  enabled_methods: {
    bkash: boolean;
    nagad: boolean;
    rocket: boolean;
    islami_bank: boolean;
    cards: boolean;
  };

  convenience_fee_percent?: number; // e.g. 0% or 1.5%
  sandbox_test_mode?: boolean; // allow instant sandbox simulation
  updated_at?: string;
}

export interface OnlinePaymentTransaction {
  id: string;
  transaction_id: string; // e.g. "TXN-2026-981245"
  madrasa_id: string;
  student_id: string;
  student_name: string;
  student_roll?: string;
  class_name?: string;
  amount: number;
  convenience_fee?: number;
  total_payable: number;
  payment_channel: "bKash" | "Nagad" | "Rocket" | "Islami Bank" | "Card / Other";
  provider: PaymentGatewayProvider;
  status: "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED";
  gateway_ref?: string;
  receipt_no?: string;
  bank_tran_id?: string;
  payer_phone?: string;
  notes?: string;
  created_at: string;
  completed_at?: string;
  allocations?: {
    student_fee_id?: string;
    fee_type_id?: string;
    fee_type_name: string;
    billing_period?: string;
    allocated_amount: number;
  }[];
}

/**
 * পাবলিক/ক্লায়েন্ট-এ পাঠানোর জন্য নিরাপদ gateway কনফিগ।
 *
 * ⛔ সিকিউরিটি: পূর্ণ `PaymentGatewayConfig`-এ `sslcommerz.store_passwd`,
 * `shurjopay.merchant_password`, `bkash.app_secret` ইত্যাদি থাকে। এগুলো কোনো
 * client component-এ prop হিসেবে পাঠালে RSC payload/HTML সোর্স থেকেই পড়া যায়।
 * তাই পাবলিক পেজে সবসময় নিচের whitelisted টাইপ ব্যবহার করুন।
 */
export interface PublicPaymentGatewayConfig {
  is_enabled: boolean;
  active_provider: PaymentGatewayProvider;
  environment: GatewayEnvironment;
  enabled_methods: PaymentGatewayConfig["enabled_methods"];
  /** ব্যাংক ট্রান্সফারের তথ্য — পেমেন্টকারীকে দেখানোর জন্যই তৈরি, গোপন নয় */
  islami_bank: PaymentGatewayConfig["islami_bank"];
  convenience_fee_percent?: number;
  sandbox_test_mode?: boolean;
  updated_at?: string;
}

/** শুধু পেমেন্ট UI-তে প্রয়োজনীয় ফিল্ড রেখে ক্রেডেনশিয়াল বাদ দেয়। */
export function toPublicPaymentGatewayConfig(
  config: PaymentGatewayConfig
): PublicPaymentGatewayConfig {
  return {
    is_enabled: Boolean(config.is_enabled),
    active_provider: config.active_provider,
    environment: config.environment,
    enabled_methods: { ...config.enabled_methods },
    islami_bank: { ...config.islami_bank },
    convenience_fee_percent: config.convenience_fee_percent,
    sandbox_test_mode: config.sandbox_test_mode,
    updated_at: config.updated_at,
  };
}

export const DEFAULT_GATEWAY_CONFIG: PaymentGatewayConfig = {
  is_enabled: true,
  active_provider: "SSLCOMMERZ",
  environment: "SANDBOX",
  sslcommerz: {
    store_id: "testbox_madrasa",
    store_passwd: "testbox_secret",
    is_live: false,
  },
  shurjopay: {
    merchant_username: "sp_madrasa",
    merchant_password: "sp_password",
    merchant_prefix: "MDR",
    is_live: false,
  },
  bkash: {
    app_key: "bkash_sandbox_app_key",
    app_secret: "bkash_sandbox_secret",
    username: "bkash_merchant_user",
    password: "bkash_merchant_password",
    is_live: false,
  },
  aamarpay: {
    store_id: "aamarpay_test",
    signature_key: "aamarpay_key",
    is_live: false,
  },
  islami_bank: {
    account_name: "কওমি মাদরাসা সাধারণ তহবিল",
    account_number: "20501234567890123",
    branch_name: "মিরপুর শাখা, ঢাকা",
    routing_number: "125270123",
    cellfin_number: "01700000000",
    instructions: "ইসলামী ব্যাংক ইন্টারনেট ব্যাংকিং (iBanking) অথবা সেলফিন (CellFin) অ্যাপ থেকে ট্রান্সফার করতে পারেন।",
  },
  enabled_methods: {
    bkash: true,
    nagad: true,
    rocket: true,
    islami_bank: true,
    cards: true,
  },
  convenience_fee_percent: 0,
  sandbox_test_mode: true,
  updated_at: new Date().toISOString(),
};
