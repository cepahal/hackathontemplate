"use client";

import { Menu } from "lucide-react";
import { useId, type ReactNode } from "react";
import { NavigationDrawer } from "@/components/layout/NavigationDrawer";
import { NavigationLinks } from "@/components/layout/NavigationLinks";
import { useNavigationDrawer } from "@/components/layout/useNavigationDrawer";
import { Button } from "@/components/ui/Button";
import type { NavItem } from "@/types";
import type { Role } from "@/types/auth";

export interface NavigationBarProps {
  brand: ReactNode;
  items: readonly NavItem[];
  actions?: ReactNode;
  mobileActions?: ReactNode;
  userRole?: Role;
  label?: string;
}

/** Presentation-only navigation; Navbar supplies the application authentication state. */
export function NavigationBar({
  brand,
  items,
  actions,
  mobileActions = actions,
  userRole,
  label = "Main",
}: NavigationBarProps) {
  const drawerId = useId();
  const { open, openDrawer, closeDrawer } = useNavigationDrawer();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-card/85">
      <div className="mx-auto flex min-h-18 min-w-0 max-w-7xl items-center justify-between gap-3 py-3 pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] lg:gap-5 lg:pr-[max(2rem,env(safe-area-inset-right))] lg:pl-[max(2rem,env(safe-area-inset-left))]">
        <div className="min-w-0 flex-1 [overflow-wrap:anywhere] lg:flex-none [&_a]:min-h-11">
          {brand}
        </div>
        <nav aria-label={label} className="hidden min-w-0 lg:block">
          <NavigationLinks items={items} userRole={userRole} orientation="horizontal" />
        </nav>
        {actions && <div className="hidden min-w-0 flex-wrap items-center justify-end gap-2 lg:flex">{actions}</div>}
        <Button
          variant="ghost"
          size="icon"
          onClick={openDrawer}
          aria-expanded={open}
          aria-controls={drawerId}
          aria-haspopup="dialog"
          aria-label="Open menu"
          className="shrink-0 lg:hidden"
        >
          <Menu aria-hidden="true" className="size-5" />
        </Button>
      </div>
      <NavigationDrawer
        id={drawerId}
        open={open}
        onClose={closeDrawer}
        title={`${label} navigation`}
        footer={mobileActions && (
          <div
            className="flex w-full min-w-0 flex-col gap-3"
            onClick={(event) => {
              if (event.target instanceof Element && event.target.closest("a[href]")) closeDrawer();
            }}
          >
            {mobileActions}
          </div>
        )}
      >
        <nav aria-label={`${label} mobile`}>
          <NavigationLinks items={items} userRole={userRole} onNavigate={closeDrawer} />
        </nav>
      </NavigationDrawer>
    </header>
  );
}
