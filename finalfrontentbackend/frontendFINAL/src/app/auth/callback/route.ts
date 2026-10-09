import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { ROUTES } from "@/lib/constants";
import { getSafeRedirectPath } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

const EMAIL_OTP_TYPES: readonly EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return value !== null && (EMAIL_OTP_TYPES as readonly string[]).includes(value);
}

function redirectToLogin(request: NextRequest, errorCode: string): NextResponse {
  const url = new URL(ROUTES.login, request.url);
  url.searchParams.set("error", errorCode);
  return NextResponse.redirect(url);
}

/**
 * Landing point for Supabase email links (signup confirmation, magic links, recovery).
 * Supports both the PKCE `?code=` flow and the `?token_hash=&type=` email template flow.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = getSafeRedirectPath(searchParams.get("next"));

  if (searchParams.get("error") || searchParams.get("error_code")) {
    return redirectToLogin(request, "link_invalid");
  }

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error(`[auth/callback] exchangeCodeForSession failed: ${error.code ?? error.name}`);
      return redirectToLogin(request, "link_invalid");
    }
    return NextResponse.redirect(new URL(next, request.url));
  }

  if (tokenHash && isEmailOtpType(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) {
      console.error(`[auth/callback] verifyOtp failed: ${error.code ?? error.name}`);
      return redirectToLogin(request, "link_invalid");
    }
    return NextResponse.redirect(new URL(next, request.url));
  }

  return redirectToLogin(request, "link_invalid");
}
