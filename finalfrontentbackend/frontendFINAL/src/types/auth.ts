export const ROLES = ["user", "admin"] as const;

export type Role = (typeof ROLES)[number];

/** App-level view of a Supabase user. Safe to pass from Server to Client Components. */
export interface AuthUser {
  id: string;
  email: string | null;
  role: Role;
  fullName: string | null;
  emailConfirmed: boolean;
  createdAt: string;
  lastSignInAt: string | null;
}
