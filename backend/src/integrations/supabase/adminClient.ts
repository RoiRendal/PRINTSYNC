import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../../config/env.js';

let client: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient | null {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  client ??= createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return client;
}

/**
 * Creates a short-lived Supabase client for auth operations that save a
 * session internally (e.g. `signInWithPassword`, `refreshSession`).
 *
 * The singleton admin client must never have a user session cached in its
 * in-memory storage, because PostgREST requests on that same client would
 * then send the user's JWT (instead of the service-role key) as the
 * `Authorization` header. This would cause `permission denied` errors on
 * security-definer RPCs that only grant `EXECUTE` to `service_role`.
 *
 * Each call returns a fresh client whose session dies with the request.
 */
export function createSupabaseAuthClient(): SupabaseClient | null {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
