import { isAuthError, isAuthRetryableFetchError } from "@supabase/supabase-js";

const FALLBACK_MESSAGE = "Something went wrong. Please try again.";

const MESSAGES_BY_CODE: Record<string, string> = {
  invalid_credentials: "Incorrect email or password.",
  email_not_confirmed:
    "Please confirm your email address first. Check your inbox for the confirmation link.",
  user_already_exists: "An account with this email already exists. Try logging in instead.",
  email_exists: "An account with this email already exists. Try logging in instead.",
  weak_password: "That password is too weak. Use a longer password with a mix of characters.",
  over_email_send_rate_limit:
    "Too many emails have been sent recently. Please wait a few minutes and try again.",
  over_request_rate_limit: "Too many attempts. Please wait a moment and try again.",
  email_address_invalid: "That email address isn't accepted. Please use a different one.",
  email_address_not_authorized:
    "This project can't send emails to that address yet. Configure custom SMTP in Supabase, or sign up with a project team member's email.",
  signup_disabled: "New sign-ups are currently disabled.",
  email_provider_disabled: "Email and password sign-in is disabled for this project.",
};

/** Messages for `?error=` codes set by our own redirects. Unknown codes get a generic message. */
const MESSAGES_BY_REDIRECT_CODE: Record<string, string> = {
  link_invalid:
    "That sign-in link is invalid or has expired. It may also have been opened in a different browser. Please log in or sign up again.",
  callback_failed: "We couldn't complete sign-in. Please try again.",
};

/** Converts any error from Supabase Auth (or the network) into a user-facing message. */
export function getAuthErrorMessage(error: unknown): string {
  if (isAuthRetryableFetchError(error)) {
    return "Couldn't reach the authentication server. Check your connection and try again.";
  }
  if (isAuthError(error)) {
    if (error.code && MESSAGES_BY_CODE[error.code]) {
      return MESSAGES_BY_CODE[error.code];
    }
    if (error.status === 429) {
      return MESSAGES_BY_CODE.over_request_rate_limit;
    }
    return error.message || FALLBACK_MESSAGE;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return FALLBACK_MESSAGE;
}

export function getRedirectErrorMessage(code: string | undefined): string | undefined {
  if (!code) {
    return undefined;
  }
  return MESSAGES_BY_REDIRECT_CODE[code] ?? MESSAGES_BY_REDIRECT_CODE.callback_failed;
}
