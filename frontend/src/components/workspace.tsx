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
import { AppShell } from "@/components/layout/app-shell";
import { CommandMenu } from "@/components/ui/command-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToastProvider, ErrorNotice } from "@/components/ui/feedback";
import { getSupabase } from "@/lib/supabase";

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
  function select(id: string) {
    const item = modules.find((entry) => entry.id === id);
    if (item) setTab(item.id);
  }
  async function logout() {
    const { error } = await getSupabase()!.auth.signOut();
    if (error) setError(error.message);
  }
  return (
    <AppShell
      brand={
        <Link
          href="/welcome"
          className="flex items-center gap-2 text-xl font-semibold tracking-tight"
        >
          <Command aria-hidden="true" className="size-6 text-primary" />
          launchpad.
        </Link>
      }
      items={modules}
      activeId={tab}
      onSelect={select}
      title={<>Workspace / {selected.label}</>}
      mainId="workspace-main"
      actions={
        <>
          <CommandMenu items={modules} onSelect={select} />
          <Badge variant="outline">{identity.role}</Badge>
          <Button
            variant="ghost"
            className="min-h-11"
            onClick={() => void logout()}
          >
            <LogOut />
            Sign out
          </Button>
        </>
      }
      sidebarFooter={
        <>
          <div className="rounded-xl bg-background p-4">
            <p className="flex items-center gap-2 text-xs font-semibold">
              <Blocks className="size-4" />
              Built to become yours.
            </p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Start small. Connect your tools.
              <br />
              Make the next useful thing.
            </p>
          </div>
          <p className="mt-4 truncate px-1 text-xs text-muted-foreground">
            {identity.email ?? identity.id}
          </p>
        </>
      }
      footerLinks={
        <>
          <Link href="/ui" className="hover:underline">
            UI library
          </Link>
          <Link href="/foundation" className="hover:underline">
            Check backend connection
          </Link>
        </>
      }
    >
      {error && (
        <div className="mb-5">
          <ErrorNotice message={error} />
        </div>
      )}
      <Panel key={tab} />
    </AppShell>
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
