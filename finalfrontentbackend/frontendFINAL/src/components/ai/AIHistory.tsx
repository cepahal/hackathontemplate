"use client";

import { History, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { aiApi } from "@/lib/ai";
import { formatDateTime } from "@/lib/utils";
import type { GenerationRecord } from "@/types/ai";
import { AI_GENERATION_TYPES, type AIGenerationStatus, type AIGenerationType } from "@/types/database";

const STATUS_VARIANT: Record<AIGenerationStatus, BadgeVariant> = {
  pending: "info",
  completed: "success",
  failed: "error",
  cancelled: "warning",
};

function preview(value: unknown, max = 160): string {
  const text = typeof value === "string" ? value : value === undefined || value === null ? "" : JSON.stringify(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function outputPreview(record: GenerationRecord): string {
  const output = record.output;
  if (!output) return "";
  if (output.error && typeof output.error === "object" && !Array.isArray(output.error)) {
    return `Error: ${preview(output.error.message)}`;
  }
  return preview(output.text ?? output.data);
}

type LoadResult =
  | { key: string; status: "error"; message: string }
  | { key: string; status: "ready"; records: GenerationRecord[] };

type LoadState = LoadResult | { status: "loading" };

export interface AIHistoryProps {
  /** Change to reload (e.g. after a new generation). */
  refreshKey?: number;
  limit?: number;
}

export function AIHistory({ refreshKey = 0, limit = 10 }: AIHistoryProps) {
  const [type, setType] = useState<AIGenerationType | "">("");
  const [reloads, setReloads] = useState(0);
  const [result, setResult] = useState<LoadResult | null>(null);
  const requestKey = `${type}|${limit}|${refreshKey}|${reloads}`;
  // Loading is derived: the latest result belongs to an older request until the new one lands.
  const state: LoadState = result && result.key === requestKey ? result : { status: "loading" };
  const reload = useCallback(() => setReloads((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    aiApi
      .history({ limit, type: type || undefined }, { signal: controller.signal })
      .then((records) => setResult({ key: requestKey, status: "ready", records }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : "Could not load history.";
        setResult({ key: requestKey, status: "error", message });
      });
    return () => controller.abort();
  }, [limit, type, requestKey]);

  return (
    <Card
      title="History"
      description="Your recent AI requests. Only you can see these."
      actions={
        <>
          <select
            aria-label="Filter by type"
            value={type}
            onChange={(event) => setType(event.target.value as AIGenerationType | "")}
            className="h-8 rounded-md border border-input bg-card px-2 text-sm"
          >
            <option value="">All types</option>
            {AI_GENERATION_TYPES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={reload} aria-label="Refresh history">
            <RefreshCw aria-hidden="true" className="size-3.5" />
          </Button>
        </>
      }
    >
      {state.status === "loading" && (
        <div className="space-y-3" role="status" aria-label="Loading history">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      )}
      {state.status === "error" && (
        <ErrorState title="Couldn't load history" message={state.message} onRetry={reload} />
      )}
      {state.status === "ready" && state.records.length === 0 && (
        <EmptyState icon={History} title="No AI requests yet" description="Generations you run will show up here." />
      )}
      {state.status === "ready" && state.records.length > 0 && (
        <ul className="divide-y divide-border">
          {state.records.map((record) => (
            <li key={record.id} className="space-y-1 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant={STATUS_VARIANT[record.status]}>{record.status}</Badge>
                <Badge>{record.type}</Badge>
                <span>
                  {record.provider} · <span className="font-mono">{record.model}</span>
                </span>
                <time dateTime={record.created_at} className="ml-auto">
                  {formatDateTime(record.created_at)}
                </time>
              </div>
              <p className="text-sm font-medium break-words">{preview(record.input.prompt, 200)}</p>
              {outputPreview(record) && (
                <p className="text-sm break-words text-muted-foreground">{outputPreview(record)}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
