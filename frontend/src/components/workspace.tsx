"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Blocks,
  Bot,
  Command,
  CreditCard,
  FileText,
  FolderKanban,
  Image,
  LogOut,
  MessageSquare,
  PlugZap,
  Radio,
  Users,
} from "lucide-react";
import { AuthGate, useIdentity } from "@/components/auth";
import { ProjectsPanel } from "@/components/projects";
import { ChatPanel, DocumentsPanel, VisionPanel } from "@/components/ai-panels";
import {
  AgentsPanel,
  BillingPanel,
  IntegrationsPanel,
  RealtimePanel,
} from "@/components/service-panels";
import { TeamPanel } from "@/components/team-panel";
import { CommandMenu } from "@/components/ui/command-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToastProvider, ErrorNotice } from "@/components/ui/feedback";
import { getSupabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const modules = [
  {
    id: "projects",
    label: "Projects",
    icon: FolderKanban,
    panel: ProjectsPanel,
  },
  { id: "chat", label: "AI chat", icon: MessageSquare, panel: ChatPanel },
  {
    id: "documents",
    label: "Knowledge",
    icon: FileText,
    panel: DocumentsPanel,
  },
  { id: "agents", label: "Agents", icon: Bot, panel: AgentsPanel },
  { id: "vision", label: "Image studio", icon: Image, panel: VisionPanel },
  {
    id: "integrations",
    label: "Integrations",
    icon: PlugZap,
    panel: IntegrationsPanel,
  },
  { id: "billing", label: "Billing", icon: CreditCard, panel: BillingPanel },
  { id: "realtime", label: "Live activity", icon: Radio, panel: RealtimePanel },
  { id: "team", label: "Collaboration", icon: Users, panel: TeamPanel },
] as const;
export type WorkspaceTab = (typeof modules)[number]["id"];

function WorkspaceContent({ initialTab }: { initialTab: WorkspaceTab }) {
  const identity = useIdentity();
  const [tab, setTab] = useState<WorkspaceTab>(initialTab);
  const [error, setError] = useState("");
  const selected = modules.find((module) => module.id === tab)!;
  const Panel = selected.panel;
  async function logout() {
    const { error } = await getSupabase()!.auth.signOut();
    if (error) setError(error.message);
  }
  return (
    <div className="min-h-screen">
      <a
        href="#workspace-main"
        className="fixed top-3 left-3 z-50 -translate-y-24 rounded-lg bg-primary px-4 py-3 text-white focus:translate-y-0"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-border bg-white lg:flex">
        <Link
          href="/welcome"
          className="flex items-center gap-3 px-7 py-8 text-xl font-semibold tracking-tight"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-white">
            <Command className="size-5" />
          </span>
          launchpad.
        </Link>
        <p className="px-7 pt-3 pb-3 text-[10px] font-semibold tracking-[1.5px] text-muted-foreground">
          YOUR WORKSPACE
        </p>
        <nav className="space-y-1 px-4" aria-label="Workspace modules">
          {modules.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-current={tab === id ? "page" : undefined}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-[13px] font-medium transition-colors",
                tab === id
                  ? "bg-secondary text-primary"
                  : "text-muted-foreground hover:bg-background",
              )}
            >
              <Icon className="size-4" />
              {label}
              {tab === id && (
                <span className="ml-auto size-1.5 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </nav>
        <div className="mt-auto p-5">
          <div className="rounded-xl bg-background p-4">
            <p className="flex items-center gap-2 text-xs font-semibold">
              <Blocks className="size-4" />
              Built to become yours.
            </p>
            <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
              Start small. Connect your tools.
              <br />
              Make the next useful thing.
            </p>
          </div>
          <p className="mt-4 truncate px-1 text-[10px] text-muted-foreground">
            {identity.email ?? identity.id}
          </p>
        </div>
      </aside>
      <div className="lg:pl-60">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-white px-5 py-5 sm:px-9">
          <div className="flex items-center gap-2 text-sm">
            <Command className="size-5 text-primary lg:hidden" />
            <span className="text-muted-foreground">Workspace</span>
            <span className="text-muted-foreground/40">/</span>
            <span className="font-medium">{selected.label}</span>
          </div>
          <div className="flex items-center gap-3">
            <CommandMenu
              items={modules}
              onSelect={(id) => setTab(id as WorkspaceTab)}
            />
            <Badge variant="outline">{identity.role}</Badge>
            <Button size="sm" variant="ghost" onClick={() => void logout()}>
              <LogOut />
              Sign out
            </Button>
          </div>
          <nav
            className="flex w-full gap-2 overflow-x-auto pt-2 lg:hidden"
            aria-label="Workspace modules"
          >
            {modules.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                aria-current={tab === id ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-2 text-xs font-medium",
                  tab === id
                    ? "bg-primary text-white"
                    : "bg-secondary text-muted-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </nav>
        </header>
        <main
          id="workspace-main"
          className="mx-auto max-w-6xl px-5 py-8 sm:px-9 lg:py-10"
        >
          {error && (
            <div className="mb-5">
              <ErrorNotice message={error} />
            </div>
          )}
          <Panel key={tab} />
          <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 text-[10px] text-muted-foreground">
            <span>Launchpad · Make room for your next idea.</span>
            <Link href="/foundation" className="hover:underline">
              Check backend connection
            </Link>
          </footer>
        </main>
      </div>
    </div>
  );
}
export function Workspace({
  initialTab = "projects",
}: {
  initialTab?: WorkspaceTab;
}) {
  return (
    <AuthGate>
      <ToastProvider>
        <WorkspaceContent initialTab={initialTab} />
      </ToastProvider>
    </AuthGate>
  );
}
