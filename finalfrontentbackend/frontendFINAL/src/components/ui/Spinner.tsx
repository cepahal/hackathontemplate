import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type SpinnerSize = "sm" | "md" | "lg";

const sizeClasses: Record<SpinnerSize, string> = {
  sm: "size-4",
  md: "size-6",
  lg: "size-10",
};

export interface SpinnerProps {
  size?: SpinnerSize;
  /** Screen-reader text. Pass `null` when the surrounding element already announces loading. */
  label?: string | null;
  className?: string;
}

export function Spinner({ size = "md", label = "Loading", className }: SpinnerProps) {
  const icon = (
    <LoaderCircle
      aria-hidden="true"
      className={cn("animate-spin text-current", sizeClasses[size], className)}
    />
  );

  if (label === null) {
    return icon;
  }

  return (
    <span role="status" className="inline-flex items-center">
      {icon}
      <span className="sr-only">{label}</span>
    </span>
  );
}
