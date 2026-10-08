import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Navbar({
  brand,
  menu,
  children,
  actions,
  className,
}: {
  brand: ReactNode;
  menu?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex min-h-20 flex-wrap items-center justify-between gap-4 border-b border-border bg-card px-5 py-4 sm:px-9",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {menu}
        {brand}
        {children}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
