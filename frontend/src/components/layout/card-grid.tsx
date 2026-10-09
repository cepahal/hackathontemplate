import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const columnClasses = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
} as const;

export function CardGrid({
  className,
  columns = 3,
  ...props
}: ComponentProps<"div"> & { columns?: 1 | 2 | 3 | 4 }) {
  return (
    <div
      className={cn(
        "grid min-w-0 gap-5 [&>*]:min-w-0",
        columnClasses[columns],
        className,
      )}
      {...props}
    />
  );
}
