import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface FooterProps {
  children?: ReactNode;
  links?: ReactNode;
  className?: string;
}

export function Footer({ children, links, className }: FooterProps) {
  return (
    <footer className={cn("border-t border-border bg-card text-sm text-muted-foreground", className)}>
      <div className="mx-auto flex max-w-7xl flex-col gap-3 pt-6 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] sm:flex-row sm:items-center sm:justify-between sm:pr-[max(1.5rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] lg:pr-[max(2rem,env(safe-area-inset-right))] lg:pl-[max(2rem,env(safe-area-inset-left))]">
        <div className="min-w-0 [overflow-wrap:anywhere]">{children}</div>
        {links && (
          <nav aria-label="Footer" className="flex min-w-0 flex-wrap gap-x-5 gap-y-1 [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:rounded-md [&_a]:focus-visible:outline-2 [&_a]:focus-visible:outline-offset-2 [&_a]:focus-visible:outline-ring">
            {links}
          </nav>
        )}
      </div>
    </footer>
  );
}
