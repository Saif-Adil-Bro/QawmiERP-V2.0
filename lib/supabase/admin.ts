import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { cache } from "react";

// For Admin tasks like creating classes, subjects, users, bypassing RLS
export const createAdminClient = cache(async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  // ⛔ CR-5 ফিক্স।
  // ⚠️ আগে anon key-তে fallback করা হতো — তখন "admin" ক্লায়েন্ট চুপচাপ RLS-এর অধীনে চলে যেত
  // এবং admin-only write (fee_payments, student_fees, users, donations) হয় ব্যর্থ হতো,
  // নয়তো সাইলেন্টলি ভিন্ন আচরণ করত। এখন service role key না থাকলে স্পষ্টভাবে থেমে যাই।
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)?.trim();

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "Supabase admin credentials are not configured. SUPABASE_SERVICE_ROLE_KEY is required — " +
        "refusing to fall back to the anon key because privileged writes would silently fail or be blocked by RLS."
    );
  }

  if (!supabaseUrl.startsWith("http")) {
    throw new Error(`Invalid Supabase URL: ${supabaseUrl}. It must start with https://`);
  }

  return createSupabaseJsClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
});
