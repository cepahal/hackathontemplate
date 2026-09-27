import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const authConfigured = Boolean(url && key);
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!authConfigured) return null;
  if (!client) {
    client = createClient(url!, key!, {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}
