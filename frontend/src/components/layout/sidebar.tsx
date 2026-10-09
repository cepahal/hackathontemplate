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
        className="size-11 shrink-0 p-0 lg:hidden"
        aria-label="Open navigation"
      >
        <Menu aria-hidden="true" />
      </Button>
    </Dialog.Trigger>
  );
}

export function NavigationLinks({
  items,
  activeId,
  onSelect,
  onNavigate,
  label = "Workspace navigation",
  orientation = "vertical",
  className,
}: {
  items: readonly NavigationItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  onNavigate?: () => void;
  label?: string;
  orientation?: "vertical" | "horizontal";
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "min-w-0",
        orientation === "horizontal" ? "flex flex-wrap gap-1" : "space-y-1",
        className,
      )}
    >
      {items.map(({ id, label: itemLabel, icon: Icon, href }) => {
        const itemClassName = cn(
          "flex min-h-11 min-w-0 items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          orientation === "vertical" && "w-full",
          activeId === id
            ? "bg-secondary text-primary"
            : "text-muted-foreground hover:bg-background",
        );
        const contents = (
          <>
            {Icon && <Icon aria-hidden="true" className="size-4 shrink-0" />}
            <span className="min-w-0 [overflow-wrap:anywhere]">{itemLabel}</span>
          </>
        );
        const select = () => {
          onSelect?.(id);
          onNavigate?.();
        };
        return href ? (
          <Link
            key={id}
            href={href}
            className={itemClassName}
            aria-current={activeId === id ? "page" : undefined}
            onClick={select}
          >
            {contents}
          </Link>
        ) : (
          <button
            key={id}
            type="button"
            className={itemClassName}
            aria-current={activeId === id ? "page" : undefined}
            disabled={!onSelect}
            onClick={select}
          >
            {contents}
          </button>
        );
      })}
    </nav>
  );
}

type SidebarProps = {
  brand: ReactNode;
  items: readonly NavigationItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  onNavigate: () => void;
  footer?: ReactNode;
  label?: string;
  desktopFocusId?: string;
};

/** Render inside a Radix Dialog.Root alongside SidebarTrigger. */
export function NavigationDrawer({
  brand,
  items,
  activeId,
  onSelect,
  onNavigate,
  footer,
  label = "Workspace navigation",
  desktopFocusId = "main-content",
}: SidebarProps) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm" />
      <Dialog.Content
        className="fixed top-0 left-0 z-50 flex h-dvh w-[min(20rem,calc(100vw-2rem))] max-w-full flex-col bg-card pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] shadow-2xl"
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest("a[href]")) {
            onNavigate();
          }
        }}
        onCloseAutoFocus={(event) => {
          if (window.matchMedia("(min-width: 1024px)").matches) {
            const target = document.getElementById(desktopFocusId);
            if (target) {
              event.preventDefault();
              target.focus({ preventScroll: true });
            }
          }
        }}
      >
        <Dialog.Title className="sr-only">{label}</Dialog.Title>
        <Dialog.Description className="sr-only">
          Choose a section. Escape closes navigation.
        </Dialog.Description>
        <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-4">
          <div className="min-w-0 [overflow-wrap:anywhere] [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center">
            {brand}
          </div>
          <Dialog.Close asChild>
            <Button
              variant="ghost"
              className="size-11 shrink-0 p-0"
              aria-label="Close navigation"
            >
              <X aria-hidden="true" />
            </Button>
          </Dialog.Close>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pb-4">
          <NavigationLinks
            items={items}
            activeId={activeId}
            onSelect={onSelect}
            onNavigate={onNavigate}
            label={label}
          />
          {footer && <div className="mt-auto pt-6">{footer}</div>}
        </div>
      </Dialog.Content>
    </Dialog.Portal>
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
  desktopFocusId,
}: SidebarProps) {
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-card pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] lg:flex">
        <div className="min-w-0 shrink-0 px-6 py-7 [overflow-wrap:anywhere] [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center">
          {brand}
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pb-5">
          <NavigationLinks
            items={items}
            activeId={activeId}
            onSelect={onSelect}
            onNavigate={onNavigate}
            label={label}
          />
          {footer && <div className="mt-auto pt-6">{footer}</div>}
        </div>
      </aside>
      <NavigationDrawer
        brand={brand}
        items={items}
        activeId={activeId}
        onSelect={onSelect}
        onNavigate={onNavigate}
        footer={footer}
        label={label}
        desktopFocusId={desktopFocusId}
      />
    </>
  );
}
