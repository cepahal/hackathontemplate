import { Spinner, type SpinnerSize } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";

export interface LoadingStateProps {
  label?: string;
  description?: string;
  size?: SpinnerSize;
  variant?: "panel" | "inline";
  className?: string;
}

export function LoadingState({
  label = "Loading",
  description,
  size = "md",
  variant = "panel",
  className,
}: LoadingStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex min-w-0 items-center justify-center gap-3 [overflow-wrap:anywhere]",
        variant === "panel"
          ? "flex-col rounded-xl border border-border bg-card px-6 py-10 text-center"
          : "py-3",
        className,
      )}
    >
      <Spinner size={size} label={null} className="text-primary" />
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}
