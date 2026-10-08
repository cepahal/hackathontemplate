import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Markdown } from "@/components/ai/Markdown";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonText } from "@/components/ui/Skeleton";
import type { TokenUsage } from "@/types/ai";

export interface AIResponseMeta {
  provider: string;
  model: string;
  usage?: TokenUsage | null;
  finishReason?: string | null;
}

export interface AIResponseProps {
  text?: string | null;
  /** Rendered instead of `text`, e.g. a structured result. */
  children?: ReactNode;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  meta?: AIResponseMeta | null;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function ResponseMeta({ meta }: { meta: AIResponseMeta }) {
  const tokens =
    meta.usage && (meta.usage.input_tokens !== null || meta.usage.output_tokens !== null)
      ? `${meta.usage.input_tokens ?? "?"} in · ${meta.usage.output_tokens ?? "?"} out`
      : null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Badge variant="info">{meta.provider}</Badge>
      <span className="font-mono">{meta.model}</span>
      {tokens && <span>{tokens} tokens</span>}
      {meta.finishReason && !["stop", "STOP", "end_turn"].includes(meta.finishReason) && (
        <Badge variant="warning">finished: {meta.finishReason}</Badge>
      )}
    </div>
  );
}

export function AIResponse({
  text,
  children,
  loading = false,
  error,
  onRetry,
  meta,
  emptyTitle = "No response yet",
  emptyDescription = "Results from the AI will appear here.",
}: AIResponseProps) {
  if (loading) {
    return (
      <div role="status" aria-label="Generating response" className="rounded-xl border border-border p-4">
        <SkeletonText lines={4} />
      </div>
    );
  }
  if (error) {
    return <ErrorState title="The AI request failed" message={error} onRetry={onRetry} />;
  }
  const hasContent = children !== undefined && children !== null ? true : Boolean(text?.trim());
  if (!hasContent) {
    return <EmptyState icon={Sparkles} title={emptyTitle} description={emptyDescription} />;
  }
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4" aria-live="polite">
      {meta && <ResponseMeta meta={meta} />}
      {children ?? <Markdown text={text ?? ""} />}
    </div>
  );
}
