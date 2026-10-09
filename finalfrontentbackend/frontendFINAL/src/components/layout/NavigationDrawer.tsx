"use client";

import type { ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";

export interface NavigationDrawerProps {
  id: string;
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  mainId?: string;
}

export function NavigationDrawer({
  id,
  open,
  onClose,
  title,
  children,
  footer,
  mainId = "main-content",
}: NavigationDrawerProps) {
  return (
    <Modal
      id={id}
      variant="drawer"
      open={open}
      onClose={onClose}
      title={title}
      closeLabel="Close navigation"
      footer={footer}
      onAfterClose={() => {
        // Clear the stored route after automatic closure so browser Back cannot reopen it.
        onClose();
        if (window.matchMedia("(min-width: 1024px)").matches) {
          document.getElementById(mainId)?.focus({ preventScroll: true });
        }
      }}
    >
      {children}
    </Modal>
  );
}
