import type { ReactNode } from "react";
import type { Viewport } from "next";

// The shared chrome and UI templates account for safe-area insets.
export const viewport: Viewport = { viewportFit: "cover" };

export default function UILayout({ children }: { children: ReactNode }) {
  return children;
}
