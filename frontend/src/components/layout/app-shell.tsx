"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState, type ReactNode } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import {
  Sidebar,
  SidebarTrigger,
  type NavigationItem,
} from "@/components/layout/sidebar";

export function AppShell({
  brand,
  items,
  activeId,
  onSelect,
  title,
  actions,
  sidebarFooter,
  footerLinks,
  children,
  mainId = "main-content",
}: {
  brand: ReactNode;
  items: readonly NavigationItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  title: ReactNode;
  actions?: ReactNode;
  sidebarFooter?: ReactNode;
  footerLinks?: ReactNode;
  children: ReactNode;
  mainId?: string;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <div className="min-h-dvh">
        <a
          href={`#${mainId}`}
          className="fixed top-3 left-3 z-[60] -translate-y-24 rounded-lg bg-primary px-4 py-3 text-primary-foreground focus:translate-y-0"
        >
          Skip to content
        </a>
        <Sidebar
          brand={brand}
          items={items}
          activeId={activeId}
          onSelect={onSelect}
          onNavigate={() => setOpen(false)}
          footer={sidebarFooter}
        />
        <div className="min-w-0 lg:pl-60">
          <Navbar
            brand={<div className="lg:hidden">{brand}</div>}
            menu={<SidebarTrigger />}
            actions={actions}
          >
            <span className="hidden text-sm font-medium sm:inline">
              {title}
            </span>
          </Navbar>
          <main
            id={mainId}
            tabIndex={-1}
            className="mx-auto min-w-0 max-w-6xl px-5 py-8 sm:px-9 lg:py-10"
          >
            {children}
            <Footer links={footerLinks} />
          </main>
        </div>
      </div>
    </Dialog.Root>
  );
}
