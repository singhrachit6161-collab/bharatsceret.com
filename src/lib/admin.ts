import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { assertRole, AuthorizationError, type AppRole, type SessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type AdminFormState = { ok: boolean; message?: string; errors?: Record<string, string>; id?: string } | null;

/**
 * Every admin server action starts here: verifies the session and role on the
 * server, then returns a user-scoped client so RLS applies as a second layer.
 */
export async function adminContext(roles?: AppRole[]): Promise<{ user: SessionUser; roles: AppRole[]; db: SupabaseClient }> {
  const { user, roles: held } = await assertRole(roles);
  return { user, roles: held, db: await createClient() };
}

export async function audit(
  db: SupabaseClient,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  details: Record<string, unknown> = {},
) {
  await db.from("audit_logs").insert({ actor_id: actorId, action, entity_type: entityType, entity_id: entityId, details });
}

export function denied(e: unknown): AdminFormState {
  if (e instanceof AuthorizationError) return { ok: false, message: e.message };
  throw e;
}

export function refreshStorefront() {
  revalidatePath("/", "layout");
}

export function formString(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function formBool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}
