"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { hasRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/types";
import type { Role } from "@/types/auth";

export interface NavigationLinksProps {
  items: readonly NavItem[];
  userRole?: Role;
  orientation?: "horizontal" | "vertical";
  onNavigate?: () => void;
}

/** A shared link list; its parent supplies the named navigation landmark. */
export function NavigationLinks({
  items,
  userRole,
  orientation = "vertical",
  onNavigate,
}: NavigationLinksProps) {
  const pathname = usePathname();
  const links = items.filter((item) => !item.requiredRole || hasRole(userRole, item.requiredRole));

  return (
    <ul className={cn("min-w-0 gap-1", orientation === "horizontal" ? "flex flex-wrap" : "flex flex-col")}>
      {links.map((item) => {
        const active = !item.href.includes("#") &&
          (pathname === item.href || pathname.startsWith(`${item.href}/`));
        const Icon = item.icon;
        return (
          <li key={item.href} className="min-w-0">
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                active ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {Icon && <Icon aria-hidden="true" className="size-4 shrink-0" />}
              <span className="min-w-0 [overflow-wrap:anywhere]">{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
