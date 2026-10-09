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
        "flex min-h-20 min-w-0 flex-wrap items-center justify-between gap-4 border-b border-border bg-card pt-[calc(1rem+env(safe-area-inset-top))] pr-[max(1.25rem,env(safe-area-inset-right))] pb-4 pl-[max(1.25rem,env(safe-area-inset-left))] sm:pr-[max(2.25rem,env(safe-area-inset-right))] sm:pl-[max(2.25rem,env(safe-area-inset-left))]",
        className,
      )}
    >
      <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3">
        {menu}
        <div className="min-w-0 [overflow-wrap:anywhere] [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center">
          {brand}
        </div>
        {children}
      </div>
      {actions && (
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 [&_a]:min-h-11 [&_button]:min-h-11">
          {actions}
        </div>
      )}
    </header>
  );
}
