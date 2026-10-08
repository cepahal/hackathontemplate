import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      role="status"
      className={cn("inline-flex shrink-0 items-center", className)}
    >
      <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
