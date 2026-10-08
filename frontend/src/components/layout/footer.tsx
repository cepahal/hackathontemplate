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
        "mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5 pb-[max(1rem,env(safe-area-inset-bottom))] text-xs text-muted-foreground",
        className,
      )}
    >
      <span>{children ?? "Launchpad · Make room for your next idea."}</span>
      {links && (
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-4">
          {links}
        </nav>
      )}
    </footer>
  );
}
