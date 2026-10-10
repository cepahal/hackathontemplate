export class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(`[Supabase config] ${message}`);
    this.name = "SupabaseConfigError";
  }
}

export interface SupabasePublicConfig {
  url: string;
  publishableKey: string;
}

let cachedConfig: SupabasePublicConfig | null = null;

function readJwtRole(token: string): string | undefined {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return undefined;
  }
  try {
    const payload: unknown = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload && typeof payload === "object" && "role" in payload) {
      const { role } = payload as { role: unknown };
      return typeof role === "string" ? role : undefined;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Returns null only when both public Supabase values are absent, allowing signed-out
 * public previews. Partial or unsafe configuration still throws `SupabaseConfigError`.
 */
export function getOptionalSupabaseConfig(): SupabasePublicConfig | null {
  if (cachedConfig) {
    return cachedConfig;
  }

  // Each variable must be referenced literally so Next.js can inline it into the browser bundle.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )?.trim();

  if (!url && !publishableKey) {
    return null;
  }

  const missing: string[] = [];
  if (!url) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!publishableKey) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  if (!url || !publishableKey) {
    throw new SupabaseConfigError(
      `Missing ${missing.join(" and ")}. Add ${missing.length > 1 ? "them" : "it"} to .env.local ` +
        "(see .env.example) and restart the dev server.",
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new SupabaseConfigError(
      `NEXT_PUBLIC_SUPABASE_URL is not a valid URL. Expected something like https://<project-ref>.supabase.co.`,
    );
  }
  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    throw new SupabaseConfigError("NEXT_PUBLIC_SUPABASE_URL must start with https:// (or http:// for local Supabase).");
  }

  if (publishableKey.startsWith("sb_secret_") || readJwtRole(publishableKey) === "service_role") {
    throw new SupabaseConfigError(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY contains a secret/service-role key. NEXT_PUBLIC_* values are shipped " +
        "to every browser. Use the publishable (anon) key instead and rotate the leaked secret key in Supabase.",
    );
  }

  cachedConfig = { url: parsedUrl.origin, publishableKey };
  return cachedConfig;
}

/** Returns validated public configuration; clients always require real project values. */
export function getSupabaseConfig(): SupabasePublicConfig {
  const config = getOptionalSupabaseConfig();
  if (!config) {
    throw new SupabaseConfigError(
      "Missing NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Add them to .env.local (see .env.example) and restart the dev server.",
    );
  }
  return config;
}
