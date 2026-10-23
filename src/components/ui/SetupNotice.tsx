import { isSupabaseConfigured } from "@/lib/env";

/** Visible only when the database is not configured, so a missing setup is never mistaken for an empty store. */
export function SetupNotice() {
  if (isSupabaseConfigured()) return null;
  return (
    <div role="status" className="bg-danger px-4 py-2 text-center text-sm text-white">
      Store database is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY — see README.
    </div>
  );
}
