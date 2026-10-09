import type { ComponentProps } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const spinnerSizes = {
  sm: "size-4",
  md: "size-5",
  lg: "size-8",
};

export type SpinnerProps = Omit<ComponentProps<"span">, "children"> & {
  size?: keyof typeof spinnerSizes;
  label?: string;
  /** Use inside a control or status region that already supplies a label. */
  decorative?: boolean;
};

export function Spinner({
  label = "Loading…",
  size = "md",
  decorative = false,
  className,
  ...props
}: SpinnerProps) {
  return (
    <span
      data-slot="spinner"
      role={decorative ? undefined : "status"}
      aria-hidden={decorative || undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center align-middle",
        spinnerSizes[size],
        className,
      )}
      {...props}
    >
      <LoaderCircle
        aria-hidden="true"
        className="size-full motion-safe:animate-spin"
      />
      {!decorative && <span className="sr-only">{label}</span>}
    </span>
  );
}
