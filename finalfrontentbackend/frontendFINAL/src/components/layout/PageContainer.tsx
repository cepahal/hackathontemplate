import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/auth";

export interface PageContainerProps {
  title?: string;
  description?: ReactNode;
  /** Rendered next to the title, e.g. primary page actions. */
  actions?: ReactNode;
  withSidebar?: boolean;
  /** Replaces the role-aware sidebar, for example with SidebarPanel and local navigation. */
  sidebar?: ReactNode;
  /** Used to show role-restricted sidebar links. */
  userRole?: Role;
  className?: string;
  footer?: ReactNode;
  mainId?: string;
  /** Let sections own their inner width and padding, useful for landing-page backgrounds. */
  fullWidth?: boolean;
  children: ReactNode;
}

export function PageContainer({
  title,
  description,
  actions,
  withSidebar = false,
  sidebar,
  userRole,
  className,
  footer,
  mainId = "main-content",
  fullWidth = false,
  children,
}: PageContainerProps) {
  const content = (
    <div className={cn("min-w-0 flex-1", className)}>
      {(title || description || actions) && (
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-2">
            {title && (
              <h1 className="text-2xl font-semibold tracking-tight text-foreground [overflow-wrap:anywhere] sm:text-3xl">
                {title}
              </h1>
            )}
            {description && <div className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</div>}
          </div>
          {actions && <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
      {footer && <div className="mt-10 border-t border-border pt-5 text-sm text-muted-foreground">{footer}</div>}
    </div>
  );

  return (
    <main
      id={mainId}
      tabIndex={-1}
      className={cn(
        "mx-auto w-full min-w-0 flex-1",
        fullWidth
          ? "pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]"
          : "max-w-7xl py-8 pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] lg:py-10 lg:pr-[max(2rem,env(safe-area-inset-right))] lg:pl-[max(2rem,env(safe-area-inset-left))]",
      )}
    >
      {withSidebar || sidebar ? (
        <div className="min-w-0 lg:flex lg:gap-10">
          {sidebar ?? <Sidebar userRole={userRole} />}
          {content}
        </div>
      ) : (
        content
      )}
    </main>
  );
}
