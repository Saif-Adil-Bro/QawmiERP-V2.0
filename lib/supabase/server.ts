import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase credentials are not configured in environment variables.");
  }
  
  if (!supabaseUrl.startsWith("http")) {
    throw new Error(`Invalid Supabase URL: ${supabaseUrl}. It must start with https://`);
  }

  return createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, {
                ...options,
                sameSite: "none",
                secure: true,
                partitioned: true,
              });
            });
          } catch (error) {
            console.error("Cookie setting error:", error);
          }
        },
      },
    }
  );
}

// For Admin tasks like creating users
export async function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Supabase service role credentials are not configured in environment variables.");
  }

  if (!supabaseUrl.startsWith("http")) {
    throw new Error(`Invalid Supabase URL: ${supabaseUrl}. It must start with https://`);
  }

  return createServerClient(
    supabaseUrl,
    serviceKey,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
    }
  );
}
