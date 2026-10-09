import { RefreshCw, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  retrying?: boolean;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message = "An unexpected error occurred. Please try again.",
  onRetry,
  retryLabel = "Try again",
  retrying = false,
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex min-w-0 flex-col items-center justify-center rounded-xl border border-danger/20 bg-danger-soft px-6 py-10 text-center [overflow-wrap:anywhere]",
        className,
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-card text-danger shadow-sm">
        <TriangleAlert aria-hidden="true" className="size-6" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">{message}</p>
      {(onRetry || action) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {onRetry && (
            <Button variant="outline" onClick={onRetry} loading={retrying}>
              {!retrying && <RefreshCw aria-hidden="true" className="size-4" />}
              {retryLabel}
            </Button>
          )}
          {action}
        </div>
      )}
    </div>
  );
}
