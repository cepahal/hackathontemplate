import { isAuthSessionMissingError, type User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cache } from "react";
import { ROUTES } from "@/lib/constants";
import { hasRole, parseRole } from "@/lib/roles";
import { getOptionalSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { AuthUser, Role } from "@/types/auth";

// Server-only helpers: they read request cookies via next/headers.

function toAuthUser(user: User): AuthUser {
  const fullName = user.user_metadata?.full_name;
  return {
    id: user.id,
    email: user.email ?? null,
    role: parseRole(user.app_metadata),
    fullName: typeof fullName === "string" && fullName.trim() ? fullName.trim() : null,
    emailConfirmed: Boolean(user.email_confirmed_at),
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at ?? null,
  };
}

/**
 * Returns the signed-in user verified against Supabase Auth, or `null`.
 * Memoised per request, so layouts and pages can both call it cheaply.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  if (!getOptionalSupabaseConfig()) {
    return null;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    if (!isAuthSessionMissingError(error)) {
      console.error(`[auth] getUser failed: ${error.name}: ${error.message}`);
    }
    return null;
  }

  return data.user ? toAuthUser(data.user) : null;
});

function loginPath(nextPath?: string): string {
  return nextPath ? `${ROUTES.login}?next=${encodeURIComponent(nextPath)}` : ROUTES.login;
}

/** Returns the signed-in user or redirects to /login (preserving `nextPath`). */
export async function requireUser(nextPath?: string): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(loginPath(nextPath));
  }
  return user;
}

/**
 * Access token to forward to the FastAPI backend from Server Components, Server Functions and
 * Route Handlers (`api.get(path, { token })`). The backend verifies it, so reading it from the
 * cookie session (refreshed by the proxy on every request) is fine here.
 */
export async function getAccessToken(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error(`[auth] getSession failed: ${error.name}: ${error.message}`);
    return null;
  }
  return data.session?.access_token ?? null;
}

/**
 * Returns the signed-in user if they have at least `role`; otherwise redirects to /forbidden.
 * This guards rendering only. Every backend endpoint and RLS policy must enforce the same rule.
 */
export async function requireRole(role: Role, nextPath?: string): Promise<AuthUser> {
  const user = await requireUser(nextPath);
  if (!hasRole(user.role, role)) {
    redirect(ROUTES.forbidden);
  }
  return user;
}
