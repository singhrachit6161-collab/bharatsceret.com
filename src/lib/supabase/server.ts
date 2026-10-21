import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/server-env";

/**
 * Request-scoped client acting as the signed-in user (or anonymous). All
 * queries are subject to Row Level Security.
 */
export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component: the proxy refreshes sessions instead.
        }
      },
    },
  });
}

/**
 * Privileged client that BYPASSES Row Level Security. Use only in trusted
 * server code for operations that cannot be expressed as the user:
 *   - placing orders / confirming payments (database functions granted only to service_role)
 *   - processing verified gateway webhooks
 *   - recording anonymous product views and newsletter sign-ups
 * Callers must perform their own authorisation checks first.
 */
export function createServiceClient(): SupabaseClient {
  if (!serverEnv.supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  return createSupabaseClient(publicEnv.supabaseUrl, serverEnv.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
