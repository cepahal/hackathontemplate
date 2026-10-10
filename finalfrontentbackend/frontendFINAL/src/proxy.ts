import { NextResponse, type NextRequest } from "next/server";
import { ROUTES } from "@/lib/constants";
import { getSafeRedirectPath, isAuthPath, isProtectedPath } from "@/lib/routes";
import { getOptionalSupabaseConfig } from "@/lib/supabase/config";
import { redirectWithSession, updateSession } from "@/lib/supabase/middleware";

// Next.js 16 renamed `middleware.ts` to `proxy.ts`; this is the request-time auth gate.
export async function proxy(request: NextRequest) {
  const { response, claims } = getOptionalSupabaseConfig()
    ? await updateSession(request)
    : { response: NextResponse.next({ request }), claims: null };
  const { pathname, search } = request.nextUrl;

  if (!claims && isProtectedPath(pathname)) {
    const loginUrl = new URL(ROUTES.login, request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return redirectWithSession(loginUrl, response);
  }

  if (claims && isAuthPath(pathname)) {
    const next = getSafeRedirectPath(request.nextUrl.searchParams.get("next"));
    return redirectWithSession(new URL(next, request.url), response);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|api/health|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
