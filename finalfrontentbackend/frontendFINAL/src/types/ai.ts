/** Mirrors backendFINAL/app/ai/schemas.py and app/modules/ai/schemas.py (/api/v1/ai). */
import type { AIGenerationStatus, AIGenerationType, Json } from "@/types/database";
import type { AIProvider } from "@/types/integrations";

export interface TokenUsage {
  input_tokens: number | null;
  output_tokens: number | null;
}

export interface AIProviderInfo {
  name: AIProvider;
  configured: boolean;
  default: boolean;
  model: string;
  attachments: string[];
}

/** Models are chosen by the backend; clients may only pick one of the configured providers. */
export interface GenerateInput {
  prompt: string;
  context?: string | null;
  provider?: AIProvider | null;
}

export type StructuredSchemaName = "generated_plan";

export interface StructuredInput extends GenerateInput {
  output_schema?: StructuredSchemaName;
}

export interface TextGeneration {
  id: string;
  provider: string;
  model: string;
  text: string;
  finish_reason: string | null;
  usage: TokenUsage | null;
  created_at: string;
}

export interface PlanItem {
  title: string;
  description: string;
  estimated_time: string;
}

export interface GeneratedPlan {
  title: string;
  summary: string;
  items: PlanItem[];
  priority: "low" | "medium" | "high" | "critical";
  estimated_time: string;
}

export interface StructuredGeneration<T = GeneratedPlan> {
  id: string;
  provider: string;
  model: string;
  schema_name: StructuredSchemaName;
  data: T;
  created_at: string;
}

export interface GenerationRecord {
  id: string;
  user_id: string;
  provider: string;
  model: string;
  type: AIGenerationType;
  status: AIGenerationStatus;
  input: { [key: string]: Json | undefined };
  output: { [key: string]: Json | undefined } | null;
  created_at: string;
}

export interface HistoryParams {
  limit?: number;
  offset?: number;
  type?: AIGenerationType;
}

/** SSE events from POST /ai/stream. Exactly one of `done` / `error` ends every stream. */
export type AIStreamEvent =
  | { event: "start"; data: { id: string; provider: string; model: string } }
  | { event: "delta"; data: { text: string } }
  | { event: "done"; data: { id: string; finish_reason: string | null; usage: TokenUsage | null } }
  | { event: "error"; data: { code: string; message: string } };

export type AIFileKind = "text" | "image" | "pdf";
