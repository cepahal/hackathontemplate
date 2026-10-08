"use client";

import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Badge } from "@/components/ui/Badge";
import { buttonVariants } from "@/components/ui/Button";
import { APP_NAME, AUTH_LINKS, NAVBAR_LINKS, ROUTES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import type { AuthUser } from "@/types/auth";

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Re-renders server data when the session changes in this tab or another one. */
function useAuthStateSync(serverUserId: string | null) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") {
        return;
      }
      if ((session?.user.id ?? null) !== serverUserId) {
        router.refresh();
      }
    });
    return () => subscription.unsubscribe();
  }, [router, serverUserId]);
}

export function Navbar({ user }: { user: AuthUser | null }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  useAuthStateSync(user?.id ?? null);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"
      >
        <Link
          href={ROUTES.home}
          onClick={closeMenu}
          className="flex items-center gap-2 rounded-md font-semibold tracking-tight text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Image src="/logo.svg" alt="" width={28} height={28} priority />
          <span>{APP_NAME}</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {NAVBAR_LINKS.map((link) => {
            const active = isActivePath(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  active
                    ? "bg-primary-soft text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              <span className="max-w-48 truncate text-sm text-muted-foreground" title={user.email ?? undefined}>
                {user.email}
              </span>
              {user.role === "admin" && <Badge variant="info">Admin</Badge>}
              <LogoutButton />
            </>
          ) : (
            <>
              <Link
                href={AUTH_LINKS.login.href}
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                {AUTH_LINKS.login.label}
              </Link>
              <Link
                href={AUTH_LINKS.signup.href}
                className={buttonVariants({ variant: "primary", size: "sm" })}
              >
                {AUTH_LINKS.signup.label}
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          className={buttonVariants({ variant: "ghost", size: "icon", className: "md:hidden" })}
        >
          {menuOpen ? (
            <X aria-hidden="true" className="size-5" />
          ) : (
            <Menu aria-hidden="true" className="size-5" />
          )}
        </button>
      </nav>

      {menuOpen && (
        <div id="mobile-menu" className="border-t border-border bg-card md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 sm:px-6">
            {NAVBAR_LINKS.map((link) => {
              const active = isActivePath(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMenu}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium",
                    active
                      ? "bg-primary-soft text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="mt-2 border-t border-border pt-3">
              {user ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm text-muted-foreground">{user.email}</span>
                  <LogoutButton variant="outline" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href={AUTH_LINKS.login.href}
                    onClick={closeMenu}
                    className={buttonVariants({ variant: "outline", size: "md" })}
                  >
                    {AUTH_LINKS.login.label}
                  </Link>
                  <Link
                    href={AUTH_LINKS.signup.href}
                    onClick={closeMenu}
                    className={buttonVariants({ variant: "primary", size: "md" })}
                  >
                    {AUTH_LINKS.signup.label}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
