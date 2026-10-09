import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Footer({
  children,
  links,
  className,
}: {
  children?: ReactNode;
  links?: ReactNode;
  className?: string;
}) {
  return (
    <footer
      className={cn(
        "mt-12 flex min-w-0 flex-wrap items-center justify-between gap-4 border-t border-border pt-5 pr-[env(safe-area-inset-right)] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] text-xs text-muted-foreground",
        className,
      )}
    >
      <div className="min-w-0 [overflow-wrap:anywhere]">
        {children ?? "Launchpad · Make room for your next idea."}
      </div>
      {links && (
        <nav
          aria-label="Footer"
          className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 [&_a]:inline-flex [&_a]:min-h-11 [&_a]:min-w-11 [&_a]:items-center [&_button]:min-h-11"
        >
          {links}
        </nav>
      )}
    </footer>
  );
}
