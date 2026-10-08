import { AUTH_ROUTES, PROTECTED_ROUTES, ROUTES } from "@/lib/constants";

function matchesRoute(pathname: string, routes: readonly string[]): boolean {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function isProtectedPath(pathname: string): boolean {
  return matchesRoute(pathname, PROTECTED_ROUTES);
}

export function isAuthPath(pathname: string): boolean {
  return matchesRoute(pathname, AUTH_ROUTES);
}

/**
 * Validates a user-supplied `next` value so it can only point at a same-origin path.
 * Rejects absolute URLs, protocol-relative `//host` URLs and auth pages (which would loop).
 */
export function getSafeRedirectPath(
  value: string | null | undefined,
  fallback: string = ROUTES.dashboard,
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  try {
    const base = "http://internal.invalid";
    const url = new URL(value, base);
    if (url.origin !== base || isAuthPath(url.pathname)) {
      return fallback;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
