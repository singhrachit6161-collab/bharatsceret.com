import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "owner" | "admin" | "operations";
export const STAFF_ROLES: AppRole[] = ["owner", "admin", "operations"];
export const ADMIN_ROLES: AppRole[] = ["owner", "admin"];

export interface SessionUser {
  id: string;
  email: string | null;
}

/** Verified identity of the current request (JWT signature checked by Supabase). */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { id: data.claims.sub, email: (data.claims.email as string | undefined) ?? null };
});

/** Roles are read from the protected user_roles table, never from user metadata. */
export const getRoles = cache(async (): Promise<AppRole[]> => {
  const user = await getSessionUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  return (data ?? []).map((r) => r.role as AppRole);
});

export async function requireUser(next = "/account"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export class AuthorizationError extends Error {
  constructor(message = "You are not allowed to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** For server actions / route handlers: throws unless the user holds one of the roles. */
export async function assertRole(allowed: AppRole[] = STAFF_ROLES): Promise<{ user: SessionUser; roles: AppRole[] }> {
  const user = await getSessionUser();
  if (!user) throw new AuthorizationError("Please sign in.");
  const roles = await getRoles();
  if (!roles.some((r) => allowed.includes(r))) throw new AuthorizationError();
  return { user, roles };
}

/** For admin pages: redirects non-staff away. */
export async function requireStaffPage(allowed: AppRole[] = STAFF_ROLES) {
  const user = await requireUser("/admin");
  const roles = await getRoles();
  if (!roles.some((r) => allowed.includes(r))) redirect("/account?denied=1");
  return { user, roles };
}

export function hasAnyRole(roles: AppRole[], allowed: AppRole[]) {
  return roles.some((r) => allowed.includes(r));
}
