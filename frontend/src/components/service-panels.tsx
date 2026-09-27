"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Bot,
  Check,
  CreditCard,
  ExternalLink,
  Radio,
  RefreshCw,
  X,
} from "lucide-react";
import { api, errorMessage, type Project } from "@/lib/client";
import { getSupabase } from "@/lib/supabase";
import { useIdentity } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Dialog } from "@/components/ui/dialog";
import {
  EmptyState,
  ErrorNotice,
  Loading,
  useToast,
} from "@/components/ui/feedback";

type AgentRun = {
  id: string;
  goal: string;
  status: string;
  state: {
    answer?: string;
    steps?: { action: string; arguments: unknown; result?: unknown }[];
    pending_action?: { tool: string; arguments: unknown };
  };
};
export function AgentsPanel() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<AgentRun | null>(null);
  const toast = useToast();
  const load = useCallback(async () => {
    try {
      const result = await api<AgentRun[]>("/api/v1/ai/agents/runs");
      setRuns(result);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  async function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const created = await api<AgentRun>("/api/v1/ai/agents/runs", {
        method: "POST",
        body: JSON.stringify({
          goal: form.get("goal"),
          provider: form.get("provider"),
          max_steps: 3,
        }),
      });
      setRuns((current) => [created, ...current]);
      toast("Agent run recorded.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function approve(approve: boolean) {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<AgentRun>(
        `/api/v1/ai/agents/runs/${selected.id}/approve`,
        { method: "POST", body: JSON.stringify({ approve }) },
      );
      setRuns((current) =>
        current.map((run) => (run.id === result.id ? result : run)),
      );
      setSelected(null);
      toast(approve ? "Approved action completed." : "Action rejected.");
      await load();
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
          A little help, with a clear boundary.
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Give an agent a goal. Inspect its steps and approve a proposed project
          creation before it runs.
        </p>
      </div>
      {error && <ErrorNotice message={error} />}
      <form onSubmit={run} className="space-y-4">
        <Field label="Goal" htmlFor="agent-goal">
          <Textarea
            id="agent-goal"
            name="goal"
            required
            maxLength={4000}
            placeholder="Help me plan a project for a campus event discovery app."
          />
        </Field>
        <Field label="Provider" htmlFor="agent-provider">
          <Select id="agent-provider" name="provider">
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="gemini">Gemini</option>
          </Select>
        </Field>
        <Button type="submit" disabled={busy}>
          <Bot />
          {busy ? "Working…" : "Run agent"}
        </Button>
      </form>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Your agent runs</h3>
        <Button size="sm" variant="ghost" onClick={() => void load()}>
          <RefreshCw />
          Refresh
        </Button>
      </div>
      {runs.length === 0 ? (
        <EmptyState title="No agent runs yet">
          Run history and action proposals will appear here.
        </EmptyState>
      ) : (
        runs.map((run) => (
          <Card key={run.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold">{run.goal}</h3>
              <Badge variant="outline">{run.status}</Badge>
            </div>
            {run.state.answer && (
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7">
                {run.state.answer}
              </p>
            )}
            <details className="mt-4">
              <summary className="cursor-pointer text-xs font-medium">
                Inspect steps ({run.state.steps?.length ?? 0})
              </summary>
              <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-background p-3 text-xs">
                {JSON.stringify(run.state.steps ?? [], null, 2)}
              </pre>
            </details>
            {run.state.pending_action && (
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => setSelected(run)}
              >
                Review proposed action
              </Button>
            )}
          </Card>
        ))
      )}
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open && !busy) setSelected(null);
        }}
        title="Review the exact action"
        description="Approval executes the saved action below. Reject it if these details do not match your intent."
      >
        <p className="mb-3 text-sm font-semibold">
          Tool: {selected?.state.pending_action?.tool}
        </p>
        <pre className="max-h-64 overflow-auto rounded-lg bg-background p-4 text-xs">
          {JSON.stringify(selected?.state.pending_action?.arguments, null, 2)}
        </pre>
        {error && <ErrorNotice message={error} />}
        <div className="mt-5 flex justify-end gap-3">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void approve(false)}
          >
            <X />
            Reject
          </Button>
          <Button disabled={busy} onClick={() => void approve(true)}>
            <Check />
            Approve action
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

type CatalogItem = {
  id: string;
  name: string;
  configured: boolean;
  operations: string[];
};
type Repo = {
  id: number;
  name: string;
  url: string;
  description: string | null;
};
export function IntegrationsPanel() {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [repos, setRepos] = useState<Repo[] | null>(null);
  useEffect(() => {
    let active = true;
    api<{ items: CatalogItem[] }>("/api/v1/integrations/catalog")
      .then((result) => {
        if (active) setCatalog(result.items);
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const result = await api<{ items: Repo[] }>(
        `/api/v1/integrations/github/repos?username=${encodeURIComponent(String(form.get("username")))}&page=1`,
      );
      setRepos(result.items);
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
          Bring your tools along.
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Provider credentials stay on the server. Availability reflects the
          backend configuration.
        </p>
      </div>
      {error && <ErrorNotice message={error} />}
      {loading ? (
        <Loading />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {catalog.map((item) => (
            <Card key={item.id} className="p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">{item.name}</h3>
                <Badge variant={item.configured ? "success" : "outline"}>
                  {item.configured ? "Configured" : "Setup required"}
                </Badge>
              </div>
              <p className="mt-3 text-xs leading-6 text-muted-foreground">
                {item.operations.join(" · ") || "No operations available"}
              </p>
            </Card>
          ))}
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>GitHub repository browser</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={search} className="flex items-end gap-3">
            <div className="flex-1">
              <Field label="GitHub username" htmlFor="github-username">
                <Input
                  id="github-username"
                  name="username"
                  required
                  pattern="[A-Za-z0-9-]+"
                  maxLength={39}
                  placeholder="octocat"
                />
              </Field>
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? "Loading…" : "List repositories"}
            </Button>
          </form>
          {repos && (
            <div className="mt-5 space-y-3">
              {repos.length === 0 ? (
                <EmptyState title="No repositories found">
                  Try another GitHub username.
                </EmptyState>
              ) : (
                repos.map((repo) => (
                  <a
                    key={repo.id}
                    href={
                      repo.url.startsWith("https://github.com/")
                        ? repo.url
                        : "https://github.com"
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-lg border border-border p-4 hover:bg-secondary"
                  >
                    <span className="inline-flex items-center gap-2 text-sm font-semibold">
                      {repo.name}
                      <ExternalLink className="size-3" />
                    </span>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {repo.description}
                    </p>
                  </a>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function BillingPanel() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<{
    subscriptions: Record<string, unknown>[];
    orders: Record<string, unknown>[];
  } | null>(null);
  const checkoutKey = useRef<string | null>(null);
  const load = useCallback(async () => {
    setError("");
    try {
      setStatus(await api("/api/v1/billing/status"));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  async function checkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      checkoutKey.current ??= crypto.randomUUID();
      const result = await api<{ url: string }>("/api/v1/billing/checkout", {
        method: "POST",
        headers: { "Idempotency-Key": checkoutKey.current },
        body: JSON.stringify({
          price_id: form.get("price"),
          mode: form.get("mode"),
        }),
      });
      const url = new URL(result.url);
      if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com")
        throw new Error("The server returned an unexpected checkout URL.");
      window.location.assign(url.href);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }
  async function portal() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ url: string }>("/api/v1/billing/portal", {
        method: "POST",
      });
      const url = new URL(result.url);
      if (url.protocol !== "https:" || url.hostname !== "billing.stripe.com")
        throw new Error(
          "The server returned an unexpected billing portal URL.",
        );
      window.location.assign(url.href);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Billing, with a receipt.
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Start a hosted Stripe checkout. Payment state updates only after a
          verified webhook.
        </p>
      </div>
      {error && <ErrorNotice message={error} retry={() => void load()} />}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="size-5" />
            Checkout
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={checkout}
            onChange={() => {
              checkoutKey.current = null;
            }}
            className="space-y-4"
          >
            <Field
              label="Stripe price ID"
              htmlFor="billing-price"
              hint="Use a price allowed by your backend configuration. Start with Stripe test mode."
            >
              <Input
                id="billing-price"
                name="price"
                required
                placeholder="price_…"
                pattern="price_[A-Za-z0-9]+"
              />
            </Field>
            <Field label="Purchase type" htmlFor="billing-mode">
              <Select id="billing-mode" name="mode">
                <option value="payment">One-time payment</option>
                <option value="subscription">Subscription</option>
              </Select>
            </Field>
            <Button type="submit" disabled={busy}>
              {busy ? "Opening checkout…" : "Continue to Stripe"}
              <ExternalLink />
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Recorded billing activity</h3>
        {Boolean(status?.subscriptions.length) && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void portal()}
          >
            Manage subscription
            <ExternalLink />
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => void load()}>
          <RefreshCw />
          Refresh
        </Button>
      </div>
      {status && status.subscriptions.length + status.orders.length === 0 ? (
        <EmptyState title="No billing activity yet">
          Completed checkouts appear after Stripe delivers and the server
          processes its webhook.
        </EmptyState>
      ) : (
        status && (
          <div className="grid gap-4 sm:grid-cols-2">
            {(["subscriptions", "orders"] as const).map((kind) => (
              <Card key={kind} className="p-5">
                <h3 className="mb-4 text-sm font-semibold capitalize">
                  {kind}
                </h3>
                {status[kind].map((record, index) => (
                  <div
                    key={String(record.id ?? index)}
                    className="border-t border-border py-3"
                  >
                    <p className="text-xs font-medium">
                      {String(record.status ?? "Recorded")}
                    </p>
                    <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
                      {String(record.id ?? record.stripe_session_id ?? "")}
                    </p>
                  </div>
                ))}
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}

type Notification = {
  id: string;
  title: string;
  message: string;
  read_at: string | null;
  created_at: string;
};
export function RealtimePanel() {
  const identity = useIdentity();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState("Choose a project");
  const [presence, setPresence] = useState(0);
  const [events, setEvents] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState("");
  const loadNotifications = useCallback(async () => {
    const client = getSupabase();
    if (!client) return;
    const { data, error } = await client
      .from("notifications")
      .select("id,title,message,read_at,created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw error;
    setNotifications(data ?? []);
  }, []);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      void Promise.all([
        api<{ items: Project[] }>("/api/v1/projects?limit=100&offset=0"),
        loadNotifications(),
      ])
        .then(([result]) => {
          if (active) setProjects(result.items);
        })
        .catch((err) => {
          if (active) setError(errorMessage(err));
        });
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [loadNotifications]);
  useEffect(() => {
    const client = getSupabase();
    if (!client) return;
    const changes = client
      .channel(`user:${identity.id}`, { config: { private: true } })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "projects",
          filter: `owner_id=eq.${identity.id}`,
        },
        (payload) => {
          setEvents((current) =>
            [
              `${new Date().toLocaleTimeString()} · project ${payload.eventType.toLowerCase()}`,
              ...current,
            ].slice(0, 20),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `owner_id=eq.${identity.id}`,
        },
        () => {
          void loadNotifications().catch((err) => setError(errorMessage(err)));
        },
      )
      .subscribe((state) => {
        if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
          setError(
            "Live notifications could not connect. Check private realtime permissions.",
          );
        }
      });
    return () => {
      void client.removeChannel(changes);
    };
  }, [identity.id, loadNotifications]);
  useEffect(() => {
    const client = getSupabase();
    if (!client || !projectId) return;
    let active = true;
    const channel = client.channel(`project:${projectId}`, {
      config: { private: true, presence: { key: identity.id } },
    });
    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "projects",
          filter: `id=eq.${projectId}`,
        },
        (payload) =>
          setEvents((current) =>
            [
              `${new Date().toLocaleTimeString()} · selected project ${payload.eventType.toLowerCase()}`,
              ...current,
            ].slice(0, 20),
          ),
      )
      .on(
        "presence",
        { event: "sync" },
        () =>
          active &&
          setPresence(
            Object.values(channel.presenceState()).reduce(
              (total, sessions) => total + sessions.length,
              0,
            ),
          ),
      )
      .subscribe(async (state) => {
        if (!active) return;
        setStatus(
          state === "SUBSCRIBED"
            ? "Connected"
            : state === "CHANNEL_ERROR"
              ? "Setup required: check private realtime permissions"
              : state,
        );
        if (state === "SUBSCRIBED") {
          try {
            const tracked = await channel.track({
              user_id: identity.id,
              online_at: new Date().toISOString(),
            });
            if (active && tracked !== "ok")
              setError(
                "Presence could not be published. Check channel permissions.",
              );
          } catch (error) {
            if (active) setError(errorMessage(error));
          }
        } else setPresence(0);
      });
    return () => {
      active = false;
      void channel.untrack();
      void client.removeChannel(channel);
    };
  }, [projectId, identity.id]);
  async function markRead(id: string) {
    const client = getSupabase();
    if (!client) return;
    const result = await client
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    if (result.error) setError(result.error.message);
    else {
      try {
        await loadNotifications();
      } catch (error) {
        setError(errorMessage(error));
      }
    }
  }
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Stay in the same moment.
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Private presence, project changes, and notifications from Supabase
          Realtime.
        </p>
      </div>
      {error && <ErrorNotice message={error} />}
      <Card className="p-6">
        <Field
          label="Presence channel"
          htmlFor="presence-project"
          hint="Project access is private. Presence shows sessions of the owner and invited members."
        >
          <Select
            id="presence-project"
            value={projectId}
            onChange={(event) => {
              setPresence(0);
              setStatus("Connecting…");
              setProjectId(event.target.value);
            }}
          >
            <option value="">Choose a project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="mt-5 flex items-center gap-3">
          <Radio className="size-4 text-primary" />
          <span className="text-sm">
            {projectId ? status : "Choose a project"}
          </span>
          {status === "Connected" && (
            <Badge variant="success">{presence} active sessions</Badge>
          )}
        </div>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold">Project events</h3>
          {events.length ? (
            <ul className="space-y-2 text-xs text-muted-foreground">
              {events.map((event, index) => (
                <li key={index}>{event}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">
              Project changes received while this panel is open appear here.
              Open another tab and edit a project to try it.
            </p>
          )}
        </Card>
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold">Notifications</h3>
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No notifications yet.
            </p>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className="border-t border-border py-4"
              >
                <p className="text-sm font-medium">{notification.title}</p>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">
                  {notification.message}
                </p>
                {!notification.read_at && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void markRead(notification.id)}
                  >
                    Mark read
                  </Button>
                )}
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
