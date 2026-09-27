"use client";
import Image from "next/image";
import { DocumentLibrary } from "@/components/document-library";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowUp,
  FileText,
  ImagePlus,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import {
  api,
  authorizedFetch,
  errorMessage,
  readEventStream,
  type ChatMessage,
  type Provider,
  type Usage,
} from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { EmptyState, ErrorNotice, useToast } from "@/components/ui/feedback";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function ProviderFields({
  provider,
  onProvider,
  model,
  onModel,
  disabled,
}: {
  provider: Provider;
  onProvider: (value: Provider) => void;
  model: string;
  onModel: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Provider" htmlFor="ai-provider">
        <Select
          id="ai-provider"
          value={provider}
          onChange={(event) => onProvider(event.target.value as Provider)}
          disabled={disabled}
        >
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="gemini">Google Gemini</option>
        </Select>
      </Field>
      <Field label="Model (optional)" htmlFor="ai-model">
        <Input
          id="ai-model"
          value={model}
          onChange={(event) => onModel(event.target.value)}
          placeholder="Use the server default"
          disabled={disabled}
          maxLength={100}
        />
      </Field>
    </div>
  );
}
function UsageLine({ usage }: { usage: Usage | null }) {
  return (
    usage && (
      <p className="mt-3 text-xs text-muted-foreground">
        {usage.input_tokens ?? "—"} input tokens · {usage.output_tokens ?? "—"}{" "}
        output tokens ·{" "}
        {usage.estimated_cost_usd == null
          ? "Cost estimate unavailable"
          : `Estimated $${usage.estimated_cost_usd.toFixed(6)}`}
      </p>
    )
  );
}

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState<Provider>("openai");
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [usage, setUsage] = useState<Usage | null>(null);
  const [schema, setSchema] = useState("");
  const controller = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "auto", block: "nearest" });
  }, [messages]);
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!prompt.trim() || busy) return;
    setError("");
    setUsage(null);
    let parsedSchema: unknown;
    try {
      if (schema.trim()) {
        parsedSchema = JSON.parse(schema);
        if (
          !parsedSchema ||
          typeof parsedSchema !== "object" ||
          Array.isArray(parsedSchema)
        )
          throw new Error("Use a JSON schema object.");
      }
    } catch {
      setError(
        "Enter a valid JSON schema object, or leave structured output blank.",
      );
      return;
    }
    const next: ChatMessage[] = [
      ...messages.filter((message) => message.content.trim()),
      { role: "user", content: prompt.trim() },
    ];
    if (
      next.length > 30 ||
      next.reduce((total, message) => total + message.content.length, 0) > 60000
    ) {
      setError(
        "This conversation has reached its context limit. Clear the chat to start a new conversation.",
      );
      return;
    }
    setPrompt("");
    setBusy(true);
    setMessages([...next, { role: "assistant", content: "" }]);
    const abort = new AbortController();
    controller.current = abort;
    let completed = false;
    const timer = setTimeout(() => abort.abort(), 120_000);
    try {
      const body = JSON.stringify({
        provider,
        model: model || undefined,
        messages: next,
        json_schema: parsedSchema,
        max_tokens: 2048,
      });
      if (parsedSchema) {
        const result = await api<{
          text: string;
          structured?: unknown;
          usage: Usage;
        }>("/api/v1/ai/chat", { method: "POST", body, signal: abort.signal });
        setMessages([
          ...next,
          {
            role: "assistant",
            content: result.structured
              ? JSON.stringify(result.structured, null, 2)
              : result.text,
          },
        ]);
        setUsage(result.usage);
        completed = true;
      } else {
        const response = await authorizedFetch("/api/v1/ai/chat/stream", {
          method: "POST",
          body,
          signal: abort.signal,
        });
        await readEventStream(response, (event, data) => {
          if (event === "error")
            throw new Error(
              String(data.message ?? "The AI provider returned an error."),
            );
          if (event === "delta" && typeof data.delta === "string")
            setMessages((current) => {
              const copy = [...current];
              copy[copy.length - 1] = {
                role: "assistant",
                content: copy[copy.length - 1].content + data.delta,
              };
              return copy;
            });
          if (event === "done") {
            completed = true;
            setUsage(data.usage as Usage);
          }
        });
      }
      if (!completed)
        throw new Error(
          "The stream ended before completion. The response may be incomplete.",
        );
    } catch (err) {
      setError(
        abort.signal.aborted
          ? "Generation stopped. Any partial answer is shown above."
          : errorMessage(err),
      );
    } finally {
      clearTimeout(timer);
      controller.current = null;
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Think out loud.
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            A streaming conversation with your configured AI provider.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || messages.length === 0}
          onClick={() => {
            setMessages([]);
            setError("");
            setUsage(null);
          }}
        >
          <Trash2 />
          Clear
        </Button>
      </div>
      <ProviderFields
        provider={provider}
        onProvider={setProvider}
        model={model}
        onModel={setModel}
        disabled={busy}
      />
      <Card className="overflow-hidden">
        <div className="max-h-[480px] min-h-[280px] overflow-y-auto p-5 sm:p-7">
          {messages.length === 0 ? (
            <EmptyState title="Start with a question">
              Brainstorm an idea, work through a problem, or ask for a first
              draft. Messages stay in this tab for this session.
            </EmptyState>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                className={`mb-5 flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}
              >
                <div
                  className={`max-w-[92%] rounded-2xl p-4 ${message.role === "user" ? "bg-primary text-white" : "bg-secondary"}`}
                >
                  <p className="mb-2 text-[10px] font-semibold tracking-widest opacity-65">
                    {message.role === "user" ? "YOU" : "ASSISTANT"}
                  </p>
                  <p className="whitespace-pre-wrap break-words text-sm leading-7">
                    {message.content ||
                      (busy && index === messages.length - 1
                        ? "Thinking…"
                        : "No response received.")}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={bottom} />
        </div>
        <form
          onSubmit={send}
          className="border-t border-border bg-background/60 p-4"
        >
          <label htmlFor="chat-prompt" className="sr-only">
            Your message
          </label>
          <Textarea
            id="chat-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="What are you working on?"
            maxLength={20000}
            required
            disabled={busy}
            className="min-h-20"
          />
          <div className="mt-3 flex justify-between gap-3">
            <p className="text-[11px] leading-5 text-muted-foreground">
              AI output can be wrong. Check before using it.
            </p>
            {busy ? (
              <Button
                variant="outline"
                onClick={() => controller.current?.abort()}
              >
                <Square />
                Stop
              </Button>
            ) : (
              <Button type="submit" disabled={!prompt.trim()}>
                <ArrowUp />
                Send
              </Button>
            )}
          </div>
        </form>
      </Card>
      {error && <ErrorNotice message={error} />}
      <UsageLine usage={usage} />
      <details className="rounded-lg border border-border bg-white p-4">
        <summary className="cursor-pointer text-xs font-medium">
          Structured output (optional)
        </summary>
        <Field
          label="JSON schema"
          htmlFor="json-schema"
          hint="Uses a non-streaming request and validates the response on the server."
        >
          <Textarea
            id="json-schema"
            className="mt-3 font-mono text-xs"
            value={schema}
            onChange={(event) => setSchema(event.target.value)}
            placeholder={
              '{"type":"object","properties":{"summary":{"type":"string"}},"required":["summary"],"additionalProperties":false}'
            }
            disabled={busy}
          />
        </Field>
      </details>
    </div>
  );
}

type Citation = {
  document_id: string;
  title: string;
  chunk_index: number;
  excerpt: string;
  score: number;
};
export function DocumentsPanel() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [content, setContent] = useState("");
  const [answer, setAnswer] = useState<{
    answer: string;
    citations: Citation[];
    usage: Usage;
  } | null>(null);
  const toast = useToast();
  async function ingest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("/api/v1/ai/documents", {
        method: "POST",
        body: JSON.stringify({ title: form.get("title"), content }),
      });
      toast("Document indexed successfully.");
      setContent("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function query(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setAnswer(null);
    try {
      setAnswer(
        await api("/api/v1/ai/rag/query", {
          method: "POST",
          body: JSON.stringify({
            query: form.get("query"),
            top_k: 5,
            provider: form.get("provider"),
          }),
        }),
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    if (file.size > 200_000) {
      setError("Choose a text or Markdown document smaller than 200 KB.");
      return;
    }
    if (!/\.(txt|md|csv)$/i.test(file.name)) {
      setError("This importer accepts .txt, .md, and .csv files.");
      return;
    }
    const text = await file.text();
    if (text.length > 50000) {
      setError("Documents must contain at most 50,000 characters.");
      return;
    }
    setContent(text);
    setError("");
  }
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Answers with a source.
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Index your documents, then ask questions grounded in their contents.
        </p>
      </div>
      {error && <ErrorNotice message={error} />}
      <Tabs defaultValue="ask">
        <TabsList>
          <TabsTrigger value="ask">Ask your documents</TabsTrigger>
          <TabsTrigger value="ingest">Add a document</TabsTrigger>
          <TabsTrigger value="library">Library</TabsTrigger>
        </TabsList>
        <TabsContent value="library">
          <DocumentLibrary />
        </TabsContent>
        <TabsContent value="ingest">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="size-4" />
                Add knowledge
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={ingest} className="space-y-4">
                <Field label="Document title" htmlFor="doc-title">
                  <Input
                    name="title"
                    id="doc-title"
                    required
                    maxLength={200}
                    placeholder="Project research notes"
                  />
                </Field>
                <Field label="Import a text file (optional)" htmlFor="doc-file">
                  <Input
                    id="doc-file"
                    type="file"
                    accept=".txt,.md,.csv"
                    onChange={(event) => void upload(event.target.files?.[0])}
                  />
                </Field>
                <Field label="Content" htmlFor="doc-content">
                  <Textarea
                    id="doc-content"
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    required
                    maxLength={50000}
                    className="min-h-52"
                    placeholder="Paste the material you want to search…"
                  />
                </Field>
                <Button type="submit" disabled={busy || !content.trim()}>
                  {busy ? "Indexing…" : "Index document"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="ask">
          <form onSubmit={query} className="space-y-4">
            <Field label="Your question" htmlFor="doc-query">
              <Textarea
                id="doc-query"
                name="query"
                required
                maxLength={4000}
                placeholder="What do my notes say about…?"
              />
            </Field>
            <Field label="Answer provider" htmlFor="rag-provider">
              <Select id="rag-provider" name="provider">
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="gemini">Gemini</option>
              </Select>
            </Field>
            <Button type="submit" disabled={busy}>
              <FileText />
              {busy ? "Searching…" : "Search and answer"}
            </Button>
          </form>
          {answer ? (
            <div className="mt-6 space-y-4">
              <Card className="p-6">
                <h3 className="mb-3 text-sm font-semibold">Answer</h3>
                <p className="whitespace-pre-wrap text-sm leading-7">
                  {answer.answer}
                </p>
                <UsageLine usage={answer.usage} />
              </Card>
              <h3 className="text-sm font-semibold">
                Sources · {answer.citations.length}
              </h3>
              {answer.citations.map((citation, index) => (
                <Card
                  key={`${citation.document_id}-${citation.chunk_index}`}
                  className="p-5"
                >
                  <p className="text-sm font-semibold">
                    [{index + 1}] {citation.title}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-muted-foreground">
                    {citation.excerpt}
                  </p>
                  <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                    Chunk {citation.chunk_index} · score{" "}
                    {citation.score.toFixed(3)}
                  </p>
                </Card>
              ))}
            </div>
          ) : (
            <div className="mt-6">
              <EmptyState title="Your sources come first">
                Add a document in the other tab, then ask a focused question.
                Retrieved passages will appear with the answer.
              </EmptyState>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function VisionPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [provider, setProvider] = useState<Provider>("openai");
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    text: string;
    structured?: {
      summary: string;
      detected_text: string;
      objects: string[];
      uncertainties: string[];
    };
    usage: Usage;
  } | null>(null);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setTimeout(() => setPreview(url), 0);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192)
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      setResult(
        await api("/api/v1/ai/vision", {
          method: "POST",
          body: JSON.stringify({
            image_base64: btoa(binary),
            media_type: file.type,
            prompt: form.get("prompt"),
            provider,
            model: model || undefined,
          }),
        }),
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          A second look.
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Upload an image and ask your AI provider what it sees.
        </p>
      </div>
      {error && <ErrorNotice message={error} />}
      <form onSubmit={analyze} className="space-y-5">
        <ProviderFields
          provider={provider}
          onProvider={setProvider}
          model={model}
          onModel={setModel}
          disabled={busy}
        />
        <Field
          label="Image"
          htmlFor="vision-file"
          hint="PNG, JPEG, or WebP. Maximum 3 MiB. The image is sent to your selected provider."
        >
          <Input
            id="vision-file"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            required
            onChange={(event) => {
              const image = event.target.files?.[0];
              if (!image) return;
              if (
                image.size > 3 * 1024 * 1024 ||
                !["image/png", "image/jpeg", "image/webp"].includes(image.type)
              ) {
                setError("Choose a PNG, JPEG, or WebP image up to 3 MiB.");
                setFile(null);
                return;
              }
              setError("");
              setFile(image);
            }}
          />
        </Field>
        {preview && file && (
          <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-white">
            <Image
              src={preview}
              alt="Selected image preview"
              width={800}
              height={600}
              unoptimized
              className="max-h-full max-w-full object-contain"
            />
          </div>
        )}
        <Field label="What should the model look for?" htmlFor="vision-prompt">
          <Textarea
            id="vision-prompt"
            name="prompt"
            defaultValue="Describe this image and its important details."
            required
            maxLength={4000}
          />
        </Field>
        <Button type="submit" disabled={busy || !file}>
          <ImagePlus />
          {busy ? "Analyzing…" : "Analyze image"}
        </Button>
      </form>
      {result && (
        <Card className="p-6">
          {result.structured ? (
            <div className="space-y-5">
              <div>
                <h3 className="mb-2 text-sm font-semibold">Summary</h3>
                <p className="text-sm leading-7">{result.structured.summary}</p>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Detected text</h3>
                <p className="whitespace-pre-wrap rounded-lg bg-background p-4 font-mono text-xs leading-6">
                  {result.structured.detected_text || "No text detected."}
                </p>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Objects</h3>
                <p className="text-sm">
                  {result.structured.objects.join(", ") || "No objects listed."}
                </p>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Uncertainties</h3>
                <p className="text-sm leading-7">
                  {result.structured.uncertainties.join(" ") ||
                    "None reported by the model."}
                </p>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-7">
              {result.text}
            </p>
          )}
          <UsageLine usage={result.usage} />
        </Card>
      )}
    </div>
  );
}
