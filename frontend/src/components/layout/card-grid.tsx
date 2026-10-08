import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function CardGrid({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "grid min-w-0 gap-5 sm:grid-cols-2 xl:grid-cols-3",
        className,
      )}
      {...props}
    />
  );
}
