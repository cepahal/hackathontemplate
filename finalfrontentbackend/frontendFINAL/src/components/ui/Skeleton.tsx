import type { ComponentProps } from "react";
import { Card, type CardVariant } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("max-w-full rounded-md bg-muted motion-safe:animate-pulse", className)}
      {...props}
    />
  );
}

export interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={cn("h-4", index === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

export interface CardSkeletonProps {
  /** Pass null when a parent already announces that the collection is loading. */
  label?: string | null;
  lines?: number;
  variant?: CardVariant;
  className?: string;
}

export function CardSkeleton({
  label = "Loading card",
  lines = 3,
  variant,
  className,
}: CardSkeletonProps) {
  return (
    <Card role={label === null ? undefined : "status"} variant={variant} className={className}>
      {label !== null && <span className="sr-only">{label}</span>}
      <div className="space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <SkeletonText lines={lines} />
        <Skeleton className="h-11 w-28" />
      </div>
    </Card>
  );
}
