import type { Viewport } from "next";
import type { ReactNode } from "react";

// The gallery shells handle safe-area insets; older routes retain browser insets.
export const viewport: Viewport = { viewportFit: "cover" };

export default function UILayout({ children }: { children: ReactNode }) {
  return children;
}
