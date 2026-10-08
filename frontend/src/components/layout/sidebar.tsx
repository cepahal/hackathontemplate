"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { Menu, X, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type NavigationItem = {
  id: string;
  label: string;
  icon?: LucideIcon;
  href?: string;
};

export function SidebarTrigger() {
  return (
    <Dialog.Trigger asChild>
      <Button
        variant="ghost"
        className="size-11 p-0 lg:hidden"
        aria-label="Open navigation"
      >
        <Menu aria-hidden="true" />
      </Button>
    </Dialog.Trigger>
  );
}

export function Sidebar({
  brand,
  items,
  activeId,
  onSelect,
  onNavigate,
  footer,
  label = "Workspace navigation",
}: {
  brand: ReactNode;
  items: readonly NavigationItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  onNavigate: () => void;
  footer?: ReactNode;
  label?: string;
}) {
  function content() {
    return (
      <>
        <div className="px-6 py-7">{brand}</div>
        <nav
          aria-label={label}
          className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 pb-4"
        >
          {items.map(({ id, label: itemLabel, icon: Icon, href }) => {
            const className = cn(
              "flex min-h-11 w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
              activeId === id
                ? "bg-secondary text-primary"
                : "text-muted-foreground hover:bg-background",
            );
            const contents = (
              <>
                {Icon && (
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                )}
                <span>{itemLabel}</span>
              </>
            );
            const select = () => {
              onSelect?.(id);
              onNavigate();
            };
            return href ? (
              <Link
                key={id}
                href={href}
                className={className}
                aria-current={activeId === id ? "page" : undefined}
                onClick={select}
              >
                {contents}
              </Link>
            ) : (
              <button
                key={id}
                type="button"
                className={className}
                aria-current={activeId === id ? "page" : undefined}
                onClick={select}
              >
                {contents}
              </button>
            );
          })}
        </nav>
        {footer && (
          <div className="mt-auto px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </>
    );
  }
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-card lg:flex">
        {content()}
      </aside>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-[min(20rem,90vw)] flex-col bg-card pt-[env(safe-area-inset-top)] shadow-2xl">
          <Dialog.Title className="sr-only">{label}</Dialog.Title>
          <Dialog.Description className="sr-only">
            Choose a section. Escape closes navigation.
          </Dialog.Description>
          <Dialog.Close asChild>
            <Button
              variant="ghost"
              className="absolute top-4 right-3 size-11 p-0"
              aria-label="Close navigation"
            >
              <X aria-hidden="true" />
            </Button>
          </Dialog.Close>
          {content()}
        </Dialog.Content>
      </Dialog.Portal>
    </>
  );
}
