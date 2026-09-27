"use client";
import Link from "next/link";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Blocks,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Code2,
  Command,
  Database,
  ExternalLink,
  FileCode2,
  Layers3,
  LayoutDashboard,
  LoaderCircle,
  Monitor,
  PlugZap,
  Radio,
  RefreshCw,
  Rocket,
  Server,
  Terminal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { API_URL, checkHealth, type HealthResult } from "@/lib/api";
import { cn } from "@/lib/utils";

type Connection =
  | { state: "checking" }
  | { state: "connected"; result: HealthResult }
  | { state: "error"; message: string };

const navigation = [
  { href: "#overview", label: "Overview", icon: LayoutDashboard },
  { href: "#connection", label: "Connection", icon: PlugZap },
  { href: "#stack", label: "Your stack", icon: Layers3 },
  { href: "#next-steps", label: "Next steps", icon: ArrowUpRight },
];

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <a
      href="#overview"
      className="flex items-center gap-2.5"
      aria-label="Launchpad home"
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-[#e1efc8]">
        <Command className="size-5" aria-hidden="true" />
      </span>
      {!compact && (
        <span className="text-xl font-semibold tracking-[-0.8px]">
          launchpad<span className="text-primary">.</span>
        </span>
      )}
    </a>
  );
}

export function Dashboard() {
  const [connection, setConnection] = useState<Connection>({
    state: "checking",
  });
  const request = useRef<AbortController | null>(null);
  const connected = connection.state === "connected";
  const checking = connection.state === "checking";

  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setConnection({ state: "checking" });
    try {
      const result = await checkHealth(controller.signal);
      if (!controller.signal.aborted)
        setConnection({ state: "connected", result });
    } catch (error) {
      if (!controller.signal.aborted) {
        setConnection({
          state: "error",
          message:
            error instanceof Error
              ? error.message
              : "Something went wrong while checking the API. Try again.",
        });
      }
    }
  }, []);

  useEffect(() => {
    // Start on the next task so the initial render stays deterministic and the
    // request is cancelled cleanly when React remounts in development mode.
    const timer = setTimeout(() => {
      void refresh();
    }, 0);
    return () => {
      clearTimeout(timer);
      request.current?.abort();
    };
  }, [refresh]);

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="fixed top-3 left-3 z-50 -translate-y-24 rounded-lg bg-primary px-4 py-3 text-white focus:translate-y-0"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 hidden w-[236px] flex-col border-r border-border bg-white lg:flex">
        <div className="px-7 pt-9 pb-10">
          <Logo />
        </div>
        <div className="px-7 text-[10px] font-semibold tracking-[1.7px] text-muted-foreground">
          WORKSPACE
        </div>
        <nav aria-label="Main navigation" className="mt-3 space-y-1 px-4">
          {navigation.map(({ href, label, icon: Icon }, index) => (
            <a
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-4 py-3 text-[13px] font-medium transition-colors",
                index === 0
                  ? "bg-secondary text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-[17px]" aria-hidden="true" />
              {label}
              {index === 0 && (
                <span className="ml-auto size-1.5 rounded-full bg-primary" />
              )}
            </a>
          ))}
        </nav>
        <div className="mx-7 mt-9 border-t border-border pt-6">
          <p className="text-[10px] font-semibold tracking-[1.7px] text-muted-foreground">
            BUILD SOMETHING GOOD
          </p>
          <p className="mt-3 text-xs leading-6 text-muted-foreground">
            A little structure.
            <br />A lot of possibility.
          </p>
        </div>
        <div className="mt-auto p-5">
          <div className="rounded-xl border border-border bg-background p-4">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Terminal className="size-3.5" aria-hidden="true" />
              Local workspace
            </div>
            <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
              Built for the first commit.
              <br />
              Ready for your next idea.
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between px-1 text-[10px] text-muted-foreground">
            <span>HACKATHON STARTER</span>
            <span className="font-mono">v0.1.0</span>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[236px]">
        <header className="flex h-[76px] items-center justify-between border-b border-border bg-white/70 px-5 sm:px-9 xl:px-12">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground lg:flex">
            <span>Workspace</span>
            <ChevronRight className="size-3" aria-hidden="true" />
            <span className="font-medium text-foreground">Overview</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-[11px] text-muted-foreground sm:inline">
              Make room for your next idea
            </span>
            <Badge variant="outline" className="border-border bg-white py-1.5">
              <span className="size-1.5 rounded-full bg-primary" />
              Local development
            </Badge>
          </div>
        </header>

        <main
          id="main"
          className="mx-auto max-w-[1400px] px-5 pt-8 pb-6 sm:px-9 xl:px-12"
        >
          <section id="overview" className="enter">
            <div className="mb-7 flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold tracking-[1.8px] text-muted-foreground">
                  YOUR WORKSPACE, AT A GLANCE
                </p>
                <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.9px]">
                  Let’s get building.
                </h1>
              </div>
              <span className="hidden rounded-full border border-border bg-white px-3 py-1.5 font-mono text-[10px] text-muted-foreground sm:inline">
                FOUNDATION / 01
              </span>
            </div>

            <div className="hero-grid relative overflow-hidden rounded-2xl border border-[#dde5d6] bg-[#edf2e7] px-6 py-8 sm:px-8 sm:py-9">
              <div className="relative z-10 max-w-lg">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d0ddc8] bg-white/50 px-2.5 py-1 text-[10px] font-medium text-primary">
                  <Rocket className="size-3" aria-hidden="true" />A strong start
                </span>
                <h2 className="mt-4 text-[34px] leading-[1.13] font-semibold tracking-[-1.5px] sm:text-[42px]">
                  Your next idea
                  <br />
                  starts here.
                </h2>
                <p className="mt-4 max-w-[340px] text-sm leading-[1.75] text-[#5c6c5b]">
                  The essentials are in place. A frontend, an API, and space to
                  make something your own.
                </p>
                <Button asChild className="mt-6">
                  <a href="#connection">
                    Check your connection
                    <ArrowDown aria-hidden="true" />
                  </a>
                </Button>
              </div>
              <div
                className="absolute top-1/2 right-[-35px] hidden h-[248px] w-[340px] -translate-y-1/2 xl:block"
                aria-hidden="true"
              >
                <div className="absolute top-0 left-8 size-60 rounded-full border border-[#bfcfb377]" />
                <div className="absolute top-8 left-16 size-44 rounded-full border border-[#bfcfb377]" />
                <div className="absolute top-[58px] left-[-24px] flex -rotate-6 items-center gap-4 rounded-xl border border-white bg-white/90 px-5 py-4 shadow-[0_8px_24px_#2447310a]">
                  <span className="rounded-lg bg-secondary p-2.5">
                    <Code2 className="size-6 text-primary" />
                  </span>
                  <div>
                    <span className="text-sm font-semibold">Your frontend</span>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      Next.js + TypeScript
                    </p>
                  </div>
                </div>
                <div className="absolute right-8 bottom-9 flex rotate-6 items-center gap-4 rounded-xl border border-white bg-white/95 px-5 py-4 shadow-[0_8px_24px_#2447310a]">
                  <span className="rounded-lg bg-[#e9efda] p-2.5">
                    <Server className="size-6 text-primary" />
                  </span>
                  <div>
                    <span className="text-sm font-semibold">Your backend</span>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      FastAPI + Python
                    </p>
                  </div>
                </div>
                <span className="absolute top-3 right-14 text-[#739253]">
                  <Blocks className="size-6" />
                </span>
              </div>
            </div>
          </section>

          <section
            id="connection"
            className="enter mt-8"
            aria-labelledby="connection-heading"
            style={{ animationDelay: "70ms" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="connection-heading" className="text-[15px] font-semibold">
                One connected foundation
              </h2>
              <span className="text-[11px] text-muted-foreground">
                LIVE API CHECK
              </span>
            </div>
            <Card className="overflow-hidden">
              <div className="grid md:grid-cols-[1fr_1.2fr]">
                <div className="border-b border-border p-6 md:border-r md:border-b-0">
                  <div className="flex items-center justify-between">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-secondary">
                      <Activity
                        className="size-5 text-primary"
                        aria-hidden="true"
                      />
                    </span>
                    <Badge
                      variant={
                        connected
                          ? "success"
                          : connection.state === "error"
                            ? "warning"
                            : "outline"
                      }
                    >
                      {checking ? (
                        <LoaderCircle
                          className="size-3 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            connected ? "bg-emerald-600" : "bg-amber-500",
                          )}
                        />
                      )}
                      {checking
                        ? "Checking"
                        : connected
                          ? "Connected"
                          : "Needs attention"}
                    </Badge>
                  </div>
                  <div
                    aria-live="polite"
                    aria-atomic="true"
                    className="mt-5 min-h-[92px]"
                  >
                    <h3 className="text-xl font-semibold tracking-[-0.5px]">
                      {checking
                        ? "Reaching your backend…"
                        : connected
                          ? "Frontend, meet backend."
                          : "Let’s connect your API."}
                    </h3>
                    <p className="mt-2 text-xs leading-[1.8] text-muted-foreground">
                      {checking
                        ? "Sending a real request from this browser to the API health endpoint."
                        : connected
                          ? "The API responded successfully. Your browser and backend are talking to each other."
                          : connection.message}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 bg-white"
                    onClick={() => void refresh()}
                    disabled={checking}
                  >
                    <RefreshCw
                      className={cn(checking && "animate-spin")}
                      aria-hidden="true"
                    />
                    {checking ? "Checking connection…" : "Check again"}
                  </Button>
                </div>
                <div className="flex flex-col justify-between bg-[#fcfdfb] p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-center">
                      <span className="mx-auto flex size-11 items-center justify-center rounded-xl border border-border bg-white">
                        <Monitor className="size-5" aria-hidden="true" />
                      </span>
                      <p className="mt-2 text-xs font-medium">Browser</p>
                      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                        Next.js
                      </p>
                    </div>
                    <div className="flex flex-1 items-center pb-9">
                      <span
                        className={cn(
                          "h-px flex-1",
                          connected ? "bg-[#b0caa8]" : "bg-border",
                        )}
                      />
                      <span className="mx-2 rounded-full border border-border bg-white px-2 py-1 font-mono text-[9px] text-muted-foreground">
                        GET /health
                      </span>
                      <ArrowRight
                        className={cn(
                          "size-4",
                          connected ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                    </div>
                    <div className="text-center">
                      <span
                        className={cn(
                          "mx-auto flex size-11 items-center justify-center rounded-xl border",
                          connected
                            ? "border-[#c8d9bf] bg-[#edf4e8] text-primary"
                            : "border-border bg-white",
                        )}
                      >
                        <Server className="size-5" aria-hidden="true" />
                      </span>
                      <p className="mt-2 text-xs font-medium">Backend</p>
                      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                        FastAPI
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 rounded-lg border border-border bg-white px-3.5 py-3">
                    <div className="mb-1.5 flex items-center justify-between text-[9px] font-medium tracking-[0.8px] text-muted-foreground">
                      <span>API ENDPOINT</span>
                      {connected && (
                        <span className="tracking-normal text-primary">
                          {connection.result.latency} ms round trip
                        </span>
                      )}
                    </div>
                    <code className="break-all text-[11px]">
                      {API_URL}/health
                    </code>
                  </div>
                  {connected && (
                    <dl className="mt-3 grid grid-cols-3 gap-2 font-mono text-[9px]">
                      <div>
                        <dt className="text-muted-foreground">Service</dt>
                        <dd className="mt-1 break-all">
                          {connection.result.data.service}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Environment</dt>
                        <dd className="mt-1 break-all">
                          {connection.result.data.environment}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Version</dt>
                        <dd className="mt-1 break-all">
                          {connection.result.data.version}
                        </dd>
                      </div>
                    </dl>
                  )}
                  <p className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Radio className="size-3" aria-hidden="true" />
                    {connected
                      ? `Last checked at ${connection.result.checkedAt.toLocaleTimeString()}. Check again after changes.`
                      : "A connection is confirmed only after a valid API response."}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-6 py-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Terminal className="size-3" aria-hidden="true" />
                  Start both services using the root README.
                </span>
                <a
                  href={`${API_URL}/docs`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  Open API docs
                  <ExternalLink className="size-3" aria-hidden="true" />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </div>
            </Card>
          </section>

          <section
            id="stack"
            className="enter mt-8"
            aria-labelledby="stack-heading"
            style={{ animationDelay: "130ms" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="stack-heading" className="text-[15px] font-semibold">
                Good tools. Less setup.
              </h2>
              <span className="text-[11px] text-muted-foreground">
                YOUR STARTER STACK
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  icon: Code2,
                  title: "Next.js + TypeScript",
                  description:
                    "Pages, routing, and a typed starting point for your interface.",
                  detail: "FRONTEND",
                  href: "https://nextjs.org/docs",
                },
                {
                  icon: Server,
                  title: "FastAPI + Python",
                  description:
                    "A health endpoint and a clean place for your application logic.",
                  detail: "BACKEND",
                  href: "https://fastapi.tiangolo.com/",
                },
                {
                  icon: Blocks,
                  title: "Tailwind + shadcn/ui",
                  description:
                    "Reusable buttons, cards, and badges. Styled and ready to extend.",
                  detail: "INTERFACE",
                  href: "https://ui.shadcn.com/docs",
                },
              ].map(({ icon: Icon, title, description, detail, href }) => (
                <Card key={title}>
                  <CardHeader className="p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <Icon
                        className="size-5 text-primary"
                        aria-hidden="true"
                      />
                      <span className="text-[9px] font-medium tracking-[1px] text-muted-foreground">
                        {detail}
                      </span>
                    </div>
                    <CardTitle className="text-[13px]">{title}</CardTitle>
                    <CardDescription className="text-xs leading-[1.8]">
                      {description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-5 pb-5">
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                    >
                      Documentation
                      <ArrowUpRight className="size-3" aria-hidden="true" />
                      <span className="sr-only">
                        {" "}
                        for {title} (opens in a new tab)
                      </span>
                    </a>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section
            id="next-steps"
            className="enter mt-8 grid gap-6 lg:grid-cols-[1.15fr_1fr]"
            aria-label="Foundation scope and next steps"
            style={{ animationDelay: "180ms" }}
          >
            <div>
              <h2 className="text-[15px] font-semibold">
                Small steps. Real progress.
              </h2>
              <p className="mt-1.5 text-xs text-muted-foreground">
                A clear starting line for the rest of your build.
              </p>
              <ol className="mt-5 space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle2
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-xs font-medium">
                      Bring your frontend to life
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      You’re here. Your local interface is running.
                    </p>
                  </div>
                  <Badge variant="secondary" className="ml-auto shrink-0">
                    Ready
                  </Badge>
                </li>
                <li className="flex items-start gap-3">
                  {connected ? (
                    <CheckCircle2
                      className="mt-0.5 size-4 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                  ) : (
                    <CircleDashed
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  )}
                  <div>
                    <p className="text-xs font-medium">
                      Make the first API call
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {connected
                        ? "A valid health response confirms your connection."
                        : "Run the backend, then check the connection above."}
                    </p>
                  </div>
                  <Badge
                    variant={connected ? "secondary" : "outline"}
                    className="ml-auto shrink-0"
                  >
                    {connected ? "Verified" : "Pending"}
                  </Badge>
                </li>
                <li className="flex items-start gap-3">
                  <CircleDashed
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-xs font-medium">
                      Build your first feature
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Start with one page, one endpoint, and one useful idea.
                    </p>
                  </div>
                  <Badge variant="outline" className="ml-auto shrink-0">
                    Up next
                  </Badge>
                </li>
              </ol>
            </div>
            <Card className="bg-[#f0f3ec]">
              <CardHeader className="p-5">
                <div className="mb-1 flex items-center gap-2">
                  <FileCode2
                    className="size-4 text-primary"
                    aria-hidden="true"
                  />
                  <CardTitle className="text-sm">
                    Your foundation connection check
                  </CardTitle>
                </div>
                <CardDescription className="text-xs">
                  This page checks the app shell and frontend–backend
                  connection. The main workspace contains your application
                  modules.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="flex items-center gap-2 border-t border-[#dce4d7] pt-4 text-[11px] text-primary">
                  <Check className="size-3.5" aria-hidden="true" />
                  <Link href="/" className="hover:underline">
                    Open your workspace
                  </Link>
                </div>
                <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
                  <Database className="mr-1 inline size-3" aria-hidden="true" />
                  Projects, authentication, AI, billing, and collaboration each
                  require their documented service configuration.
                </p>
              </CardContent>
            </Card>
          </section>

          <footer className="mt-9 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-5 text-[10px] text-muted-foreground">
            <span>Launchpad · A starting point, made yours.</span>
            <span className="font-mono">LOCAL FIRST. IDEA NEXT.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
