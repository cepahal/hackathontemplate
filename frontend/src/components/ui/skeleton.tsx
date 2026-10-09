import type { ComponentProps } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Decorative placeholder; put an accessible loading label on its parent. */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("rounded-md bg-muted motion-safe:animate-pulse", className)}
      {...props}
    />
  );
}

export type CardSkeletonProps = Omit<ComponentProps<"div">, "children"> & {
  label?: string;
};

export function CardSkeleton({
  label = "Loading card…",
  ...props
}: CardSkeletonProps) {
  return (
    <Card role="status" {...props}>
      <span className="sr-only">{label}</span>
      <CardHeader>
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </CardContent>
      <CardFooter>
        <Skeleton className="h-11 w-28" />
      </CardFooter>
    </Card>
  );
}
