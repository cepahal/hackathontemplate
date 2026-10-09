"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Circle, FolderKanban, LayoutGrid, List, Plus, Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { SidebarPanel } from "@/components/layout/SidebarPanel";
import { CardGrid } from "@/components/layout/CardGrid";
import { TemplateNav } from "@/components/templates/TemplateNav";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";

type Project = { id: string; name: string; description: string; progress: number; color: string };
const initialProjects: Project[] = [
  { id: "fieldnotes", name: "Fieldnotes", description: "A calmer place for research, observations, and the connections between them.", progress: 65, color: "bg-emerald-50 text-emerald-800" },
  { id: "signal", name: "Signal", description: "Turn a noisy stream of feedback into a few clear next steps.", progress: 35, color: "bg-amber-50 text-amber-800" },
  { id: "atlas", name: "Atlas", description: "A shared map of the places and ideas your team wants to explore.", progress: 100, color: "bg-indigo-50 text-indigo-800" },
];

export function WorkspaceTemplate() {
  const [projects, setProjects] = useState(initialProjects);
  const [filter, setFilter] = useState("All projects");
  const [query, setQuery] = useState("");
  const [view, setView] = useState("cards");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = projects.find(project => project.id === selectedId);
  const completed = projects.filter(project => project.progress === 100).length;
  const visible = projects.filter(project =>
    (filter === "All projects" || (filter === "Completed" ? project.progress === 100 : project.progress < 100)) &&
    `${project.name} ${project.description}`.toLowerCase().includes(query.toLowerCase().trim()),
  );

  function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) { setNameError("Give your project a name."); return; }
    if (projects.some(project => project.name.toLowerCase() === cleanName.toLowerCase())) { setNameError("That name is already in this preview. Try another."); return; }
    setProjects(current => [...current, { id: crypto.randomUUID(), name: cleanName, description: "A fresh space for your next idea. Open it to try the project details.", progress: 0, color: "bg-sky-50 text-sky-800" }]);
    setQuery(""); setFilter("All projects"); setCreating(false); setName(""); setNameError("");
    setNotice(`Created ${cleanName} in this preview. Reloading resets these examples.`);
  }

  return (
    <AppShell
      sidebar={<SidebarPanel title="Workspace navigation" footer={<p className="text-xs leading-6 text-muted-foreground">A working layout example.<br />Changes stay in this preview.</p>}>
        <div className="mb-8 flex items-center gap-3 px-3"><span className="flex size-9 items-center justify-center rounded-xl bg-foreground text-background"><LayoutGrid aria-hidden="true" className="size-4" /></span><div><p className="text-sm font-semibold">Studio workspace</p><p className="text-xs text-muted-foreground">A little room to build</p></div></div>
        <div role="group" aria-label="Filter projects" className="space-y-1">
          {[{label:"All projects",icon:FolderKanban,count:projects.length},{label:"In progress",icon:Circle,count:projects.length-completed},{label:"Completed",icon:Check,count:completed}].map(({label,icon:Icon,count}) => <button key={label} onClick={() => setFilter(label)} aria-pressed={filter === label} className={cn("flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring", filter === label ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-muted")}><Icon aria-hidden="true" className="size-4 shrink-0" /><span className="flex-1">{label}</span><span className="text-xs" aria-hidden="true">{count}</span></button>)}
        </div>
        <Link href="/ui" className="mt-8 flex min-h-11 items-center justify-between gap-3 rounded-lg border-t border-border px-3 pt-5 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">Browse the UI library <ArrowUpRight aria-hidden="true" className="size-4" /></Link>
      </SidebarPanel>}
    >
      <TemplateNav name="Workspace" />
      <div className="mb-9 flex flex-wrap items-start justify-between gap-5"><div><p className="mb-2 text-xs font-semibold tracking-[0.18em] text-primary">MAKE SOMETHING USEFUL</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Projects</h1><p className="mt-3 max-w-lg text-sm leading-7 text-muted-foreground">Keep the work in view. Pick up an idea, make a little progress, and keep going.</p></div><Button onClick={() => { setNameError(""); setCreating(true); }}><Plus aria-hidden="true" className="size-4" />New project</Button></div>
      <div className="mb-8 grid grid-cols-3 gap-3 border-y border-border py-6 sm:gap-6">
        {[{label:"Projects",value:projects.length},{label:"In progress",value:projects.length-completed},{label:"Completed",value:completed}].map(({label,value})=><div key={label}><p className="text-xs leading-5 text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{String(value).padStart(2,"0")}</p></div>)}
      </div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div className="w-full sm:max-w-xs"><Input label="Search projects" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find your next focus…" endAdornment={<Search aria-hidden="true" className="size-4 text-muted-foreground" />} /></div><div className="flex items-center gap-3"><span className="text-xs text-muted-foreground">{visible.length} shown</span><div role="group" aria-label="Project view" className="flex rounded-lg border border-border bg-card p-1"><Button variant={view === "cards" ? "secondary" : "ghost"} size="icon" aria-label="Card view" aria-pressed={view === "cards"} onClick={() => setView("cards")}><LayoutGrid aria-hidden="true" className="size-4" /></Button><Button variant={view === "list" ? "secondary" : "ghost"} size="icon" aria-label="List view" aria-pressed={view === "list"} onClick={() => setView("list")}><List aria-hidden="true" className="size-4" /></Button></div></div></div>
      <p role="status" className={cn("text-sm text-success", notice ? "mb-5" : "sr-only")}>{notice}</p>
      {visible.length ? <CardGrid columns={view === "cards" ? 2 : 1}>
        {visible.map(project => <Card key={project.id} title={project.name} description={project.description} actions={<span aria-hidden="true" className={cn("flex size-9 items-center justify-center rounded-xl text-sm font-semibold",project.color)}>{project.name.slice(0,1)}</span>} footer={<div className="flex w-full flex-wrap items-center justify-between gap-2"><Badge variant={project.progress === 100 ? "success" : "info"}>{project.progress === 100 ? "Completed" : "In progress"}</Badge><Button variant="ghost" size="sm" aria-label={`Open ${project.name}`} onClick={() => setSelectedId(project.id)}>Open project <ArrowUpRight aria-hidden="true" className="size-4" /></Button></div>}>
          <div className="pt-5"><div className="mb-2 flex justify-between gap-3 text-xs text-muted-foreground"><span>Progress</span><span>{project.progress}%</span></div><progress aria-label={`${project.name} progress`} max={100} value={project.progress} className="block h-1.5 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary" /></div>
        </Card>)}
      </CardGrid> : <EmptyState title="Nothing here just yet" description="Try another search or start a project of your own." action={<Button variant="outline" onClick={() => { setQuery(""); setFilter("All projects"); }}>Reset filters</Button>} />}
      <p className="mt-8 border-t border-border pt-5 text-xs leading-6 text-muted-foreground">Sample workspace. Search, switch views, open projects, or create one. These examples reset when you reload.</p>

      <Modal open={creating} onClose={() => setCreating(false)} title="Create a project" description="Start with a name. The rest can take shape as you go." footer={<><Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button><Button type="submit" form="create-preview-project">Create project</Button></>}>
        <form id="create-preview-project" onSubmit={createProject}><Input label="Project name" value={name} onChange={event => { setName(event.target.value); setNameError(""); }} placeholder="Something worth building" maxLength={60} required error={nameError} helperText="This project is saved only for the current preview." /></form>
      </Modal>
      <Modal open={Boolean(selected)} onClose={() => setSelectedId(null)} title={selected?.name ?? "Project"} description="Project details" footer={selected && <Button onClick={() => { setProjects(current => current.map(project => project.id === selected.id ? {...project, progress: project.progress === 100 ? 0 : 100} : project)); setNotice(`Updated ${selected.name} in this preview.`); setSelectedId(null); }}>{selected.progress === 100 ? "Reopen project" : "Mark complete"}</Button>}>
        {selected && <div className="space-y-5"><p className="text-sm leading-7 text-muted-foreground">{selected.description}</p><Badge variant={selected.progress === 100 ? "success" : "info"}>{selected.progress === 100 ? "Completed" : "In progress"}</Badge><p className="text-xs leading-6 text-muted-foreground">Try changing the status. Your project counts and filters will update together.</p></div>}
      </Modal>
    </AppShell>
  );
}
