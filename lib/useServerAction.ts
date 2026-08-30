"use client";

import { useState, useCallback } from "react";

export const ACTION_DEPLOY_ERROR_MSG =
  "একটি অপ্রত্যাশিত সমস্যা হয়েছে। সম্ভবত নতুন আপডেট ডিপ্লয় হয়েছে — অনুগ্রহ করে পেজ রিফ্রেশ করে আবার চেষ্টা করুন।";

interface UseServerActionOptions {
  errorMessage?: string;
  onError?: (error: any) => void;
  onSuccess?: (result: any) => void;
}

/**
 * Custom hook to safely run Server Actions on the client side with:
 * 1. try/catch protection against stale server action IDs after deployments
 * 2. Guaranteed loading state reset inside a finally block
 * 3. Double-submit guard support
 * 4. User-friendly localized Bengali error messages
 */
export function useServerAction<T extends (...args: any[]) => Promise<any>>(
  action: T,
  options?: UseServerActionOptions
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>> | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = await action(...args);
        if (result && typeof result === "object" && "error" in result && result.error) {
          const errText = typeof result.error === "string" ? result.error : "অপারেশন ব্যর্থ হয়েছে।";
          setError(errText);
          options?.onError?.(result.error);
          return result;
        }
        options?.onSuccess?.(result);
        return result;
      } catch (err: any) {
        console.error(`[useServerAction] Action failed:`, err);
        const friendlyMsg = options?.errorMessage || ACTION_DEPLOY_ERROR_MSG;
        setError(friendlyMsg);
        options?.onError?.(err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [action, options]
  );

  return { execute, loading, error, setError };
}
