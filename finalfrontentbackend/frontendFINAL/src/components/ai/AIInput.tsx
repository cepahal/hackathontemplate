"use client";

import { Send, Square } from "lucide-react";
import { useId, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { AI_MAX_PROMPT_CHARS } from "@/lib/ai";
import { cn } from "@/lib/utils";

export interface AIInputProps {
  onSubmit: (prompt: string) => void;
  /** Shown while `loading`; aborts the in-flight request. */
  onCancel?: () => void;
  loading?: boolean;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  submitLabel?: string;
  maxLength?: number;
  /** Keep the text after submitting (e.g. when a file is attached alongside). */
  keepValue?: boolean;
  /** Extra controls rendered left of the buttons (e.g. a provider picker). */
  toolbar?: ReactNode;
  className?: string;
}

export function AIInput({
  onSubmit,
  onCancel,
  loading = false,
  disabled = false,
  label = "Prompt",
  placeholder = "Ask anything…",
  submitLabel = "Generate",
  maxLength = AI_MAX_PROMPT_CHARS,
  keepValue = false,
  toolbar,
  className,
}: AIInputProps) {
  const id = useId();
  const [value, setValue] = useState("");
  const trimmed = value.trim();
  const tooLong = value.length > maxLength;
  const canSubmit = trimmed.length > 0 && !tooLong && !loading && !disabled;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit(trimmed);
    if (!keepValue) setValue("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn("flex flex-col gap-2", className)} noValidate>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={4}
        aria-invalid={tooLong || undefined}
        aria-describedby={`${id}-count`}
        className={cn(
          "min-h-24 w-full resize-y rounded-lg border bg-card px-3 py-2 text-sm text-foreground shadow-sm",
          "placeholder:text-muted-foreground/70 focus-visible:outline-2 focus-visible:outline-ring",
          "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
          tooLong ? "border-danger" : "border-input",
        )}
      />
      <div className="flex flex-wrap items-center gap-2">
        <span
          id={`${id}-count`}
          aria-live="polite"
          className={cn("mr-auto text-xs", tooLong ? "text-danger" : "text-muted-foreground")}
        >
          {tooLong
            ? `${value.length.toLocaleString()} / ${maxLength.toLocaleString()} characters — too long`
            : `${value.length.toLocaleString()} / ${maxLength.toLocaleString()} · Ctrl/⌘ + Enter to send`}
        </span>
        {toolbar}
        {loading && onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            <Square aria-hidden="true" className="size-3.5" />
            Cancel
          </Button>
        )}
        <Button type="submit" loading={loading} disabled={!canSubmit}>
          {!loading && <Send aria-hidden="true" className="size-4" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
