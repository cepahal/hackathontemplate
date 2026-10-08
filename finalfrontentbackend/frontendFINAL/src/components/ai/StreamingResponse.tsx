import { MessageSquareText } from "lucide-react";
import { ResponseMeta } from "@/components/ai/AIResponse";
import { Markdown } from "@/components/ai/Markdown";
import type { AIStreamState } from "@/components/ai/useAIStream";
import { Alert } from "@/components/ui/Alert";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";

const STATUS: Record<AIStreamState["status"], { label: string; variant: BadgeVariant } | null> = {
  idle: null,
  streaming: { label: "Streaming", variant: "info" },
  completed: { label: "Completed", variant: "success" },
  cancelled: { label: "Cancelled", variant: "warning" },
  error: { label: "Failed", variant: "error" },
};

export interface StreamingResponseProps {
  state: AIStreamState;
  onRetry?: () => void;
}

export function StreamingResponse({ state, onRetry }: StreamingResponseProps) {
  if (state.status === "idle") {
    return (
      <EmptyState
        icon={MessageSquareText}
        title="Nothing streamed yet"
        description="Send a prompt and the answer will appear here word by word."
      />
    );
  }

  const status = STATUS[state.status];
  const streaming = state.status === "streaming";

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        {status && <Badge variant={status.variant}>{status.label}</Badge>}
        {state.provider && state.model && (
          <ResponseMeta
            meta={{
              provider: state.provider,
              model: state.model,
              usage: state.usage,
              finishReason: state.finishReason,
            }}
          />
        )}
      </div>

      {state.text ? (
        <div aria-live="polite" aria-busy={streaming}>
          <Markdown text={state.text} />
          {streaming && (
            <span aria-hidden="true" className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-foreground/60 align-middle" />
          )}
        </div>
      ) : (
        streaming && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner size="sm" label={null} /> Waiting for the first words…
          </div>
        )
      )}

      {state.status === "error" && state.error && (
        <Alert variant="error" title="The stream failed">
          <span>{state.error}</span>
          {onRetry && (
            <button type="button" onClick={onRetry} className="ml-2 font-medium underline underline-offset-2">
              Try again
            </button>
          )}
        </Alert>
      )}
      {state.status === "cancelled" && (
        <p className="text-xs text-muted-foreground">Stopped. Partial output is kept above.</p>
      )}
    </div>
  );
}
