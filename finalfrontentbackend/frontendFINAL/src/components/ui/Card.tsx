import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends Omit<ComponentProps<"section">, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  /** Rendered on the right side of the header, e.g. a button or badge. */
  actions?: ReactNode;
  footer?: ReactNode;
}

export function Card({
  title,
  description,
  actions,
  footer,
  className,
  children,
  ...props
}: CardProps) {
  const hasHeader = Boolean(title || description || actions);

  return (
    <section
      className={cn(
        "flex flex-col rounded-xl border border-border bg-card text-card-foreground shadow-sm",
        className,
      )}
      {...props}
    >
      {hasHeader && (
        <header className="flex items-start justify-between gap-4 px-5 pt-5">
          <div className="min-w-0 space-y-1">
            {title && <h2 className="text-base font-semibold tracking-tight">{title}</h2>}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      {children !== undefined && children !== null && (
        <div className={cn("flex-1 px-5 pb-5", hasHeader ? "pt-4" : "pt-5")}>{children}</div>
      )}
      {footer && (
        <footer className="flex items-center justify-end gap-2 rounded-b-xl border-t border-border bg-muted/40 px-5 py-3">
          {footer}
        </footer>
      )}
    </section>
  );
}
