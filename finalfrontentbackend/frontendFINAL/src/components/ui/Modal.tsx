"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ModalSize = "sm" | "md" | "lg";
export type ModalVariant = "modal" | "drawer";

const sizeClasses: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
  variant?: ModalVariant;
  side?: "left" | "right";
  id?: string;
  closeLabel?: string;
  /** Runs after closing and restoring focus, e.g. for a responsive layout handoff. */
  onAfterClose?: () => void;
  className?: string;
}

function trapTab(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== "Tab") return;

  const dialog = event.currentTarget;
  const controls = Array.from(
    dialog.querySelectorAll<HTMLElement>(
      "a[href], area[href], button, input:not([type='hidden']), select, textarea, [tabindex], [contenteditable='true']",
    ),
  ).filter(
    (element) =>
      (element.tabIndex >= 0 || element.isContentEditable) &&
      !element.matches(":disabled") &&
      !element.closest("[inert]") &&
      element.getClientRects().length > 0,
  );

  const first = controls[0];
  const last = controls[controls.length - 1];
  const active = document.activeElement;
  if (!first || !last) {
    event.preventDefault();
    dialog.focus();
  } else if (event.shiftKey && (active === first || active === dialog || !dialog.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || active === dialog || !dialog.contains(active))) {
    event.preventDefault();
    first.focus();
  }
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  variant = "modal",
  side = "left",
  id,
  closeLabel = "Close dialog",
  onAfterClose,
  className,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      dialog
        .querySelector<HTMLElement>(
          "[data-autofocus], input:not([disabled]):not([type='hidden']), textarea:not([disabled]), select:not([disabled])",
        )
        ?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      id={id}
      ref={dialogRef}
      tabIndex={-1}
      data-slot={variant === "drawer" ? "drawer" : "modal"}
      onKeyDown={trapTab}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect();
        if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) {
          onClose();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={() => {
        // A queued close event must not move focus out of a dialog that has reopened.
        if (dialogRef.current?.open) return;
        const opener = openerRef.current;
        if (opener?.isConnected && opener.getClientRects().length > 0) {
          opener.focus({ preventScroll: true });
        }
        onAfterClose?.();
        if (open) {
          onClose();
        }
      }}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={cn(
        "overflow-hidden border border-border bg-card p-0 text-card-foreground shadow-xl",
        "backdrop:bg-slate-900/40 backdrop:backdrop-blur-[2px]",
        variant === "drawer"
          ? "fixed inset-y-0 m-0 h-dvh max-h-dvh w-[min(22rem,calc(100vw-2.5rem))] max-w-none rounded-none border-y-0"
          : "m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] rounded-xl",
        variant === "drawer"
          ? side === "left" ? "right-auto left-0 border-l-0" : "right-0 left-auto border-r-0"
          : sizeClasses[size],
        className,
      )}
    >
      {open && (
        <div
          className={cn(
            "flex min-h-0 flex-col",
            variant === "drawer"
              ? "h-full pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]"
              : "max-h-[calc(100dvh-2rem)]",
          )}
        >
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0 space-y-1">
              <h2 id={titleId} className="text-base font-semibold tracking-tight [overflow-wrap:anywhere]">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="-mr-1 inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </header>
          {children !== undefined && children !== null && (
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 [overflow-wrap:anywhere]">{children}</div>
          )}
          {footer && (
            <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-border px-5 py-3 sm:flex-row sm:flex-wrap sm:justify-end">
              {footer}
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}
