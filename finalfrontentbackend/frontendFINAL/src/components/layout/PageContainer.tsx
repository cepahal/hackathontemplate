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
  /** Used to show role-restricted sidebar links. */
  userRole?: Role;
  className?: string;
  children: ReactNode;
}

export function PageContainer({
  title,
  description,
  actions,
  withSidebar = false,
  userRole,
  className,
  children,
}: PageContainerProps) {
  const content = (
    <div className={cn("min-w-0 flex-1", className)}>
      {(title || description || actions) && (
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            {title && (
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {title}
              </h1>
            )}
            {description && <p className="text-sm text-muted-foreground sm:text-base">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );

  return (
    <main id="main-content" className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      {withSidebar ? (
        <div className="lg:flex lg:gap-10">
          <Sidebar userRole={userRole} />
          {content}
        </div>
      ) : (
        content
      )}
    </main>
  );
}
