import {
  authUnavailable,
  currentAppSession,
  SessionUnavailableError,
} from "../current-app-session";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { createAdminClient } from "./admin";

export { createAdminClient };

export const createClient = cache(async () => {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Supabase credentials are not configured in environment variables.",
    );
  }

  if (!supabaseUrl.startsWith("http")) {
    throw new Error(
      `Invalid Supabase URL: ${supabaseUrl}. It must start with https://`,
    );
  }

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          const rememberCookie = cookieStore.get("qawmi_remember_me")?.value;
          // If explicitly "0", set session/short (1 day); otherwise default to 365 days
          const persistentMaxAge =
            rememberCookie === "0" ? 60 * 60 * 24 * 1 : 60 * 60 * 24 * 365;

          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, {
              ...options,
              path: options?.path ?? "/",
              sameSite: options?.sameSite ?? "lax",
              secure: process.env.NODE_ENV === "production",
              maxAge: options?.maxAge ?? persistentMaxAge,
            });
          });
        } catch (error) {
          // In Server Components cookie modification is ignored by Next.js
        }
      },
    },
  });
});

// For Admin tasks like creating classes, subjects, users, bypassing RLS
// Re-exported above from ./admin

/** Request-local only. Neither a provider-only login nor a legacy app cookie is a grant. */
export const getWebAppSession = cache(
  async (supabaseClient?: Awaited<ReturnType<typeof createClient>>) => {
    const db = supabaseClient || (await createClient());
    const {
      data: { user },
      error,
    } = await db.auth.getUser();
    if (authUnavailable(error)) throw new SessionUnavailableError();
    if (error || !user) return null;
    const session = await currentAppSession(db);
    return session?.user_id === user.id ? { user, session } : null;
  },
);

export const getAuthUser = cache(
  async (client?: Awaited<ReturnType<typeof createClient>>) => {
    try {
      return (await getWebAppSession(client))?.user ?? null;
    } catch {
      return null;
    }
  },
);
