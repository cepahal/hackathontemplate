"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SIDEBAR_LINKS } from "@/lib/constants";
import { hasRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/types";
import type { Role } from "@/types/auth";

function isActive(pathname: string, item: NavItem): boolean {
  if (item.href.includes("#")) {
    return false;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function Sidebar({ userRole }: { userRole?: Role }) {
  const pathname = usePathname();
  const links = SIDEBAR_LINKS.filter(
    (item) => !item.requiredRole || hasRole(userRole, item.requiredRole),
  );

  return (
    <>
      <aside className="hidden w-56 shrink-0 lg:block">
        <nav aria-label="Sidebar" className="sticky top-24 flex flex-col gap-1">
          {links.map((item) => {
            const active = isActive(pathname, item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  active
                    ? "bg-primary-soft text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {Icon && <Icon aria-hidden="true" className="size-4" />}
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <nav
        aria-label="Section"
        className="-mx-4 mb-6 flex gap-2 overflow-x-auto border-b border-border px-4 pb-3 sm:-mx-6 sm:px-6 lg:hidden"
      >
        {links.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-primary/20 bg-primary-soft text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {Icon && <Icon aria-hidden="true" className="size-4" />}
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
