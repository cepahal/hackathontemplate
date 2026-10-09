import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type CardVariant = "default" | "muted" | "elevated";

const variantClasses: Record<CardVariant, string> = {
  default: "border-border bg-card shadow-sm",
  muted: "border-border bg-muted/50",
  elevated: "border-border bg-card shadow-lg shadow-foreground/5",
};

export interface CardProps extends Omit<ComponentProps<"section">, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  /** Rendered on the right side of the header, e.g. a button or badge. */
  actions?: ReactNode;
  footer?: ReactNode;
  variant?: CardVariant;
}

export function Card({
  title,
  description,
  actions,
  footer,
  variant = "default",
  className,
  children,
  ...props
}: CardProps) {
  const hasHeader = Boolean(title || description || actions);

  return (
    <section
      data-slot="card"
      className={cn(
        "flex min-w-0 flex-col rounded-xl border text-card-foreground [overflow-wrap:anywhere]",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {hasHeader && (
        <header className="flex flex-wrap items-start justify-between gap-4 px-5 pt-5">
          <div className="min-w-0 flex-[1_1_12rem] space-y-1">
            {title && <h2 className="text-base font-semibold tracking-tight">{title}</h2>}
            {description && <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children !== undefined && children !== null && (
        <div className={cn("min-w-0 flex-1 px-5 pb-5", hasHeader ? "pt-4" : "pt-5")}>{children}</div>
      )}
      {footer && (
        <footer className="flex flex-wrap items-center justify-end gap-2 rounded-b-xl border-t border-border bg-muted/40 px-5 py-3">
          {footer}
        </footer>
      )}
    </section>
  );
}
