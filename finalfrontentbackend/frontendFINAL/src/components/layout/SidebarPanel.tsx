"use client";

import { PanelLeft } from "lucide-react";
import { useId, type ReactNode } from "react";
import { NavigationDrawer } from "@/components/layout/NavigationDrawer";
import { useNavigationDrawer } from "@/components/layout/useNavigationDrawer";
import { Button } from "@/components/ui/Button";

export interface SidebarPanelProps {
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  mainId?: string;
}

/** Use navigation links or local selection buttons as children; activation closes the phone drawer. */
export function SidebarPanel({
  title = "Section navigation",
  children,
  footer,
  mainId,
}: SidebarPanelProps) {
  const drawerId = useId();
  const { open, openDrawer, closeDrawer } = useNavigationDrawer();

  return (
    <>
      <aside className="hidden w-56 min-w-0 shrink-0 lg:block">
        <div className="sticky top-[calc(6.5rem+env(safe-area-inset-top))] flex max-h-[calc(100dvh-8rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] min-h-0 flex-col overflow-y-auto overscroll-contain">
          <nav aria-label={title} className="min-w-0">{children}</nav>
          {footer && <div className="mt-6 border-t border-border pt-5 text-sm text-muted-foreground">{footer}</div>}
        </div>
      </aside>
      <div className="mb-6 lg:hidden">
        <Button
          variant="outline"
          onClick={openDrawer}
          aria-controls={drawerId}
          aria-expanded={open}
          aria-haspopup="dialog"
          className="max-w-full"
        >
          <PanelLeft aria-hidden="true" className="size-4 shrink-0" />
          <span className="truncate">{title}</span>
        </Button>
      </div>
      <NavigationDrawer id={drawerId} open={open} onClose={closeDrawer} title={title} footer={footer} mainId={mainId}>
        <nav
          aria-label={`${title} mobile`}
          onClick={(event) => {
            if (event.target instanceof Element && event.target.closest("a[href], button")) closeDrawer();
          }}
        >
          {children}
        </nav>
      </NavigationDrawer>
    </>
  );
}
