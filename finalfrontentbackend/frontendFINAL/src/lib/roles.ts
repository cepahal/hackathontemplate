import { ROLES, type Role } from "@/types/auth";

const ROLE_RANK: Record<Role, number> = {
  user: 0,
  admin: 1,
};

function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/**
 * Reads the role from Supabase `app_metadata`, which only the service role can write.
 * `user_metadata` is user-editable and must never grant privileges.
 */
export function parseRole(appMetadata: Record<string, unknown> | null | undefined): Role {
  const role = appMetadata?.role;
  return isRole(role) ? role : "user";
}

/** `admin` satisfies any `user` requirement. */
export function hasRole(role: Role | null | undefined, required: Role): boolean {
  if (!role) {
    return false;
  }
  return ROLE_RANK[role] >= ROLE_RANK[required];
}
