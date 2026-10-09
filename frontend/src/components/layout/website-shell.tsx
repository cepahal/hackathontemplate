"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import {
  NavigationDrawer,
  NavigationLinks,
  SidebarTrigger,
  type NavigationItem,
} from "@/components/layout/sidebar";
import { useNavigationDrawer } from "@/components/layout/use-navigation-drawer";

export function WebsiteShell({
  brand,
  items,
  activeId,
  onSelect,
  actions,
  footerLinks,
  children,
  mainId = "main-content",
}: {
  brand: ReactNode;
  items: readonly NavigationItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  actions?: ReactNode;
  footerLinks?: ReactNode;
  children: ReactNode;
  mainId?: string;
}) {
  const [open, setOpen] = useNavigationDrawer();

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <div className="flex min-h-dvh min-w-0 flex-col">
        <a
          href={`#${mainId}`}
          className="fixed top-[max(0.75rem,env(safe-area-inset-top))] left-[max(0.75rem,env(safe-area-inset-left))] z-[60] -translate-y-[200%] rounded-lg bg-primary px-4 py-3 text-primary-foreground focus:translate-y-0"
        >
          Skip to content
        </a>
        <Navbar
          brand={brand}
          menu={items.length > 0 ? <SidebarTrigger /> : undefined}
          actions={actions}
        >
          <NavigationLinks
            items={items}
            activeId={activeId}
            onSelect={onSelect}
            label="Website navigation"
            orientation="horizontal"
            className="hidden lg:flex"
          />
        </Navbar>
        <NavigationDrawer
          brand={brand}
          items={items}
          activeId={activeId}
          onSelect={onSelect}
          onNavigate={() => setOpen(false)}
          label="Website navigation"
          desktopFocusId={mainId}
        />
        <main
          id={mainId}
          tabIndex={-1}
          className="mx-auto w-full min-w-0 max-w-6xl flex-1 py-8 pr-[max(1.25rem,env(safe-area-inset-right))] pl-[max(1.25rem,env(safe-area-inset-left))] sm:py-12 sm:pr-[max(2.25rem,env(safe-area-inset-right))] sm:pl-[max(2.25rem,env(safe-area-inset-left))]"
        >
          {children}
        </main>
        <div className="mx-auto w-full min-w-0 max-w-6xl px-5 sm:px-9">
          <Footer links={footerLinks} />
        </div>
      </div>
    </Dialog.Root>
  );
}
