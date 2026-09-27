import * as React from "react";
import { cn } from "@/lib/utils";

export const inputClass =
  "w-full rounded-lg border border-input bg-white px-3 py-2.5 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 placeholder:text-muted-foreground/70";
export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(inputClass, className)} {...props} />;
}
export function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(inputClass, "min-h-24 resize-y", className)}
      {...props}
    />
  );
}
export function Select({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return <select className={cn(inputClass, className)} {...props} />;
}
export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-semibold">
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-xs leading-5 text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
