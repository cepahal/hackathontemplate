import { createServerClient } from "@supabase/ssr";
import type { JwtPayload } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export interface SessionResult {
  /** Pass-through response carrying any refreshed auth cookies. */
  response: NextResponse;
  /** Verified JWT claims, or `null` when there is no valid session. */
  claims: JwtPayload | null;
}

/**
 * Refreshes the Supabase session cookies for this request and returns the verified claims.
 * Must run on every matched request so expired access tokens are rotated before rendering.
 */
export async function updateSession(request: NextRequest): Promise<SessionResult> {
  const { url, publishableKey } = getSupabaseConfig();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Nothing may run between client creation and this call, or sessions can be dropped at random.
  const { data, error } = await supabase.auth.getClaims();
  const claims = error || !data ? null : data.claims;

  return { response, claims };
}

/** Builds a redirect that keeps any auth cookies/headers written during `updateSession`. */
export function redirectWithSession(url: URL, sessionResponse: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(url);
  for (const cookie of sessionResponse.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = sessionResponse.headers.get(header);
    if (value) {
      redirect.headers.set(header, value);
    }
  }
  return redirect;
}
