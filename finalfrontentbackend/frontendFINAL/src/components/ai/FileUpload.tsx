"use client";

import { FileText, ImageIcon, UploadCloud, X } from "lucide-react";
import { useId, useRef, useState, type DragEvent } from "react";
import { Button } from "@/components/ui/Button";
import { acceptAttribute, AI_MAX_FILE_BYTES, formatBytes, validateFile } from "@/lib/ai";
import { cn } from "@/lib/utils";
import type { AIFileKind } from "@/types/ai";

export interface FileUploadProps {
  /** Selected file after client-side validation, or null when cleared / invalid. */
  onFileChange: (file: File | null, kind: AIFileKind | null) => void;
  file: File | null;
  kinds?: readonly AIFileKind[];
  maxBytes?: number;
  /** 0–100 while uploading; undefined when idle. */
  progress?: number;
  disabled?: boolean;
  label?: string;
}

const KIND_LABELS: Record<AIFileKind, string> = { text: "TXT/MD", image: "PNG, JPEG, WebP, GIF", pdf: "PDF" };

export function FileUpload({
  onFileChange,
  file,
  kinds = ["image"],
  maxBytes = AI_MAX_FILE_BYTES,
  progress,
  disabled = false,
  label = "Attachment",
}: FileUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const uploading = progress !== undefined;

  const select = async (candidate: File | undefined) => {
    if (!candidate) return;
    setChecking(true);
    try {
      const result = await validateFile(candidate, kinds, maxBytes);
      if (result.ok) {
        setError(null);
        onFileChange(candidate, result.kind);
      } else {
        setError(result.error);
        onFileChange(null, null);
      }
    } catch {
      setError("Could not read the file.");
      onFileChange(null, null);
    } finally {
      setChecking(false);
    }
  };

  const clear = () => {
    setError(null);
    onFileChange(null, null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    if (!disabled) void select(event.dataTransfer.files[0]);
  };

  const Icon = file?.type.startsWith("image/") ? ImageIcon : FileText;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {file ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
          <Icon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
            {uploading && (
              <div
                role="progressbar"
                aria-label="Upload progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
              >
                <div className="h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={clear} disabled={disabled || uploading} aria-label="Remove file">
            <X aria-hidden="true" className="size-4" />
          </Button>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 py-6 text-center transition-colors",
            dragging ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
            disabled && "pointer-events-none opacity-60",
          )}
        >
          <UploadCloud aria-hidden="true" className="size-6 text-muted-foreground" />
          <span className="text-sm font-medium">{checking ? "Checking file…" : "Drop a file or click to browse"}</span>
          <span className="text-xs text-muted-foreground">
            {kinds.map((kind) => KIND_LABELS[kind]).join(" · ")} · up to {formatBytes(maxBytes)}
          </span>
        </label>
      )}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={acceptAttribute(kinds)}
        className="sr-only"
        disabled={disabled}
        onChange={(event) => void select(event.target.files?.[0])}
      />
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
