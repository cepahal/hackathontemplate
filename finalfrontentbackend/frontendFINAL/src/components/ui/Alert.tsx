import type { LucideIcon } from "lucide-react";
import { CircleAlert, CircleCheck, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type AlertVariant = "error" | "success" | "info";

const variants: Record<AlertVariant, { className: string; icon: LucideIcon }> = {
  error: { className: "border-danger/20 bg-danger-soft text-danger", icon: CircleAlert },
  success: { className: "border-success/20 bg-success-soft text-success", icon: CircleCheck },
  info: { className: "border-info/20 bg-info-soft text-info", icon: Info },
};

export interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Alert({ variant = "info", title, children, className }: AlertProps) {
  const { className: variantClassName, icon: Icon } = variants[variant];

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-lg border px-3 py-2.5 text-sm", variantClassName, className)}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 space-y-0.5">
        {title && <p className="font-medium">{title}</p>}
        <div className={cn(title && "text-foreground/80")}>{children}</div>
      </div>
    </div>
  );
}
