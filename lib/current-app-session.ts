import type { SupabaseClient } from "@supabase/supabase-js";

export class SessionUnavailableError extends Error {
  constructor() {
    super("Session verification unavailable");
  }
}

export function authUnavailable(error: { status?: number } | null) {
  return (
    !!error && (!error.status || error.status === 429 || error.status >= 500)
  );
}

export interface AppSession {
  id: string;
  user_id: string;
  madrasa_id: string;
}

// Call with the user's SSR or Bearer client, NEVER with a service-role client.
// PostgREST authenticates the JWT. The no-argument RPC reads the verified subject
// and provider session_id and compares the live registry row to the user's tenant.
export async function currentAppSession(
  client: SupabaseClient,
): Promise<AppSession | null> {
  const { data, error, status } = await client.rpc("current_app_session");
  if (status === 401) return null;
  if (error) throw new SessionUnavailableError();
  if (data === null) return null;
  if (
    ![data?.id, data?.user_id, data?.madrasa_id].every(
      (v) => typeof v === "string" && v.length > 0,
    )
  )
    throw new SessionUnavailableError();
  return { id: data.id, user_id: data.user_id, madrasa_id: data.madrasa_id };
}
