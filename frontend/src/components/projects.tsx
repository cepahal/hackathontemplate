"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Pencil, Plus, RefreshCw, Trash2, FolderOpen } from "lucide-react";
import { api, errorMessage, type Project } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { BarChart } from "@/components/ui/bar-chart";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form";
import {
  EmptyState,
  ErrorNotice,
  Loading,
  useToast,
} from "@/components/ui/feedback";

export function ProjectsPanel() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const [edit, setEdit] = useState<Project | "new" | null>(null);
  const [remove, setRemove] = useState<Project | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const toast = useToast();
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api<{ items: Project[] }>(
        `/api/v1/projects?limit=20&offset=${offset}`,
      );
      setProjects(result.items);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [offset]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setFormError("");
    try {
      await api(
        `/api/v1/projects${edit !== "new" && edit ? `/${edit.id}` : ""}`,
        {
          method: edit === "new" ? "POST" : "PATCH",
          body: JSON.stringify({
            name: String(data.get("name")).trim(),
            description: String(data.get("description")).trim(),
          }),
        },
      );
      setEdit(null);
      toast(edit === "new" ? "Project created." : "Project updated.");
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function destroy() {
    if (!remove) return;
    setBusy(true);
    setFormError("");
    try {
      await api(`/api/v1/projects/${remove.id}`, { method: "DELETE" });
      setRemove(null);
      toast("Project deleted.");
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Good ideas start small.
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a project, give it a direction, and make it yours.
          </p>
        </div>
        <Button
          onClick={() => {
            setEdit("new");
            setFormError("");
          }}
        >
          <Plus />
          New project
        </Button>
      </div>
      <div className="hero-grid rounded-2xl border border-[#dce5d1] bg-[#eaf0e1] p-6">
        <FolderOpen className="mb-4 size-7 text-primary" />
        <p className="text-sm font-medium">A space for work that matters.</p>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Your projects and projects shared with you appear here. Access follows
          permissions set by the owner.
        </p>
      </div>
      {error && <ErrorNotice message={error} retry={() => void load()} />}
      {loading ? (
        <Loading label="Loading your projects…" />
      ) : !error && projects.length === 0 ? (
        <EmptyState
          title={offset ? "No more projects" : "Your first project is waiting"}
          action={
            !offset && (
              <Button onClick={() => setEdit("new")}>
                <Plus />
                Create a project
              </Button>
            )
          }
        >
          {offset
            ? "Go back to the previous page."
            : "Start with a name and a short description. You can refine it as you go."}
        </EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border p-5">
            <h3 className="text-sm font-semibold">Your projects</h3>
            <Button size="sm" variant="ghost" onClick={() => void load()}>
              <RefreshCw />
              Refresh
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-background text-xs text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Project</th>
                  <th className="px-5 py-3 font-medium">Updated</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id} className="border-t border-border">
                    <td className="max-w-md px-5 py-4">
                      <p className="font-medium">{project.name}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {project.description || "No description yet."}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-muted-foreground">
                      {new Date(project.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Edit ${project.name}`}
                        onClick={() => {
                          setEdit(project);
                          setFormError("");
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Delete ${project.name}`}
                        onClick={() => {
                          setRemove(project);
                          setFormError("");
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {!loading && !error && projects.length > 0 && (
        <BarChart
          title="Created in the last 7 days · current page"
          data={Array.from({ length: 7 }, (_, index) => {
            const day = new Date();
            day.setDate(day.getDate() - 6 + index);
            const count = projects.filter(
              (project) =>
                new Date(project.created_at).toDateString() ===
                day.toDateString(),
            ).length;
            return {
              label: day.toLocaleDateString(undefined, {
                weekday: "short",
                day: "numeric",
              }),
              value: count,
            };
          })}
        />
      )}
      <div className="flex items-center justify-between">
        <Button
          size="sm"
          variant="outline"
          disabled={offset === 0 || loading}
          onClick={() => setOffset(Math.max(0, offset - 20))}
        >
          Previous
        </Button>
        <span className="text-xs text-muted-foreground">
          Page {offset / 20 + 1}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={projects.length < 20 || loading}
          onClick={() => setOffset(offset + 20)}
        >
          Next
        </Button>
      </div>
      <Dialog
        open={edit !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setEdit(null);
        }}
        title={edit === "new" ? "Create a project" : "Edit project"}
        description="Keep the name clear and the description useful."
      >
        <form
          key={edit === "new" ? "new" : edit?.id}
          onSubmit={save}
          className="space-y-4"
        >
          {formError && <ErrorNotice message={formError} />}
          <Field label="Project name" htmlFor="project-name">
            <Input
              id="project-name"
              name="name"
              required
              maxLength={120}
              defaultValue={edit !== "new" ? edit?.name : ""}
              autoFocus
            />
          </Field>
          <Field label="Description" htmlFor="project-description">
            <Textarea
              id="project-description"
              name="description"
              maxLength={5000}
              defaultValue={edit !== "new" ? edit?.description : ""}
            />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save project"}
          </Button>
        </form>
      </Dialog>
      <Dialog
        open={remove !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setRemove(null);
        }}
        title="Delete this project?"
        description={`This permanently deletes “${remove?.name ?? ""}”. This action cannot be undone.`}
      >
        {formError && <ErrorNotice message={formError} />}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setRemove(null)}
          >
            Cancel
          </Button>
          <Button
            className="bg-destructive"
            disabled={busy}
            onClick={() => void destroy()}
          >
            {busy ? "Deleting…" : "Delete project"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
