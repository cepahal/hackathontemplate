"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { NavigationBar } from "@/components/layout/NavigationBar";
import { Badge } from "@/components/ui/Badge";
import { buttonVariants } from "@/components/ui/Button";
import { APP_NAME, AUTH_LINKS, NAVBAR_LINKS, ROUTES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/browser";
import type { AuthUser } from "@/types/auth";

/** Re-renders server data when the session changes in this tab or another one. */
function useAuthStateSync(serverUserId: string | null) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      if ((session?.user.id ?? null) !== serverUserId) router.refresh();
    });
    return () => subscription.unsubscribe();
  }, [router, serverUserId]);
}

const navigation = NAVBAR_LINKS.some((item) => item.href === "/ui")
  ? NAVBAR_LINKS
  : [...NAVBAR_LINKS, { label: "UI library", href: "/ui" }];

export function Navbar({ user }: { user: AuthUser | null }) {
  useAuthStateSync(user?.id ?? null);

  const authActions = user ? (
    <>
      <span className="min-w-0 max-w-48 truncate text-sm text-muted-foreground" title={user.email ?? undefined}>
        {user.email}
      </span>
      {user.role === "admin" && <Badge variant="info">Admin</Badge>}
      <LogoutButton />
    </>
  ) : (
    <>
      <Link href={AUTH_LINKS.login.href} className={buttonVariants({ variant: "ghost" })}>
        {AUTH_LINKS.login.label}
      </Link>
      <Link href={AUTH_LINKS.signup.href} className={buttonVariants({ variant: "primary" })}>
        {AUTH_LINKS.signup.label}
      </Link>
    </>
  );

  return (
    <NavigationBar
      brand={
        <Link
          href={ROUTES.home}
          className="flex min-w-0 items-center gap-2 rounded-md font-semibold tracking-tight text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Image src="/logo.svg" alt="" width={28} height={28} priority className="shrink-0" />
          <span className="min-w-0 text-sm [overflow-wrap:anywhere] sm:text-base">{APP_NAME}</span>
        </Link>
      }
      items={navigation}
      userRole={user?.role}
      actions={authActions}
      mobileActions={user ? (
        <>
          <div className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground" title={user.email ?? undefined}>{user.email}</span>
            {user.role === "admin" && <Badge variant="info">Admin</Badge>}
          </div>
          <LogoutButton variant="outline" className="items-stretch" />
        </>
      ) : (
        <div className="grid grid-cols-2 gap-2">{authActions}</div>
      )}
    />
  );
}
