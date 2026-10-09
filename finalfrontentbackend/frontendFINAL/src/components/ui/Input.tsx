"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends ComponentProps<"input"> {
  label?: string;
  helperText?: string;
  error?: string;
  /** Rendered inside the right edge of the input, e.g. a visibility toggle. */
  endAdornment?: ReactNode;
}

export function Input({
  label,
  helperText,
  error,
  endAdornment,
  id,
  type = "text",
  disabled,
  required,
  className,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;
  const describedBy = [error ? errorId : null, helperText ? helperId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className={cn("text-sm font-medium text-foreground", disabled && "opacity-60")}
        >
          {label}
          {required && (
            <span className="ml-0.5 text-danger" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <div className="relative">
        <input
          id={inputId}
          type={type}
          disabled={disabled}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={cn(
            "h-10 w-full rounded-lg border bg-card px-3 text-sm text-foreground shadow-sm transition-colors",
            "placeholder:text-muted-foreground/70",
            "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring",
            "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
            error ? "border-danger" : "border-input",
            endAdornment ? "pr-11" : null,
            className,
          )}
          {...props}
        />
        {endAdornment && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-1.5">{endAdornment}</div>
        )}
      </div>
      {error && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
      {helperText && (
        <p id={helperId} className="text-sm text-muted-foreground">
          {helperText}
        </p>
      )}
    </div>
  );
}
