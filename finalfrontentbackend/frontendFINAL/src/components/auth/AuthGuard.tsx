import type { ReactNode } from "react";
import { requireRole, requireUser } from "@/lib/auth";
import type { AuthUser, Role } from "@/types/auth";

export interface AuthGuardProps {
  /** Minimum role required. Omit to only require a signed-in user. */
  role?: Role;
  /** Path to return to after login, e.g. the current page. */
  redirectTo?: string;
  children: ReactNode | ((user: AuthUser) => ReactNode);
}

/**
 * Server Component that renders `children` only for an authorised user; everyone else is
 * redirected on the server before any protected markup is sent.
 */
export async function AuthGuard({ role, redirectTo, children }: AuthGuardProps) {
  const user = role ? await requireRole(role, redirectTo) : await requireUser(redirectTo);
  return <>{typeof children === "function" ? children(user) : children}</>;
}
