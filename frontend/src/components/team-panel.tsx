"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, errorMessage, type Project } from "@/lib/client";
import { useIdentity } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorNotice, useToast } from "@/components/ui/feedback";

type Member = { user_id: string; role: string; project_id: string };
export function TeamPanel() {
  const identity = useIdentity();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [remove, setRemove] = useState<Member | null>(null);
  const toast = useToast();
  useEffect(() => {
    api<{ items: Project[] }>("/api/v1/projects?limit=100&offset=0")
      .then((result) =>
        setProjects(
          result.items.filter((project) => project.owner_id === identity.id),
        ),
      )
      .catch((err) => setError(errorMessage(err)));
  }, [identity.id]);
  const load = useCallback(async () => {
    if (!projectId) return;
    setError("");
    try {
      const result = await api<{ items: Member[] }>(
        `/api/v1/projects/${projectId}/members`,
      );
      setMembers(result.items);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [projectId]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api(`/api/v1/projects/${projectId}/members`, {
        method: "POST",
        body: JSON.stringify({
          user_id: form.get("user_id"),
          role: form.get("role"),
        }),
      });
      toast("Project member added.");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function revoke() {
    if (!remove) return;
    setBusy(true);
    try {
      await api(`/api/v1/projects/${projectId}/members/${remove.user_id}`, {
        method: "DELETE",
      });
      setRemove(null);
      toast("Member access removed.");
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
          Make it a shared project.
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Owners can invite an existing account as a viewer or editor. Editors
          can change project details; ownership stays with you.
        </p>
      </div>
      <Card className="p-5">
        <p className="text-xs text-muted-foreground">
          Your account ID · share this with a project owner to be added
        </p>
        <code className="mt-2 block break-all text-sm">{identity.id}</code>
      </Card>
      {error && <ErrorNotice message={error} />}
      <Field label="A project you own" htmlFor="team-project">
        <Select
          id="team-project"
          value={projectId}
          onChange={(event) => {
            setProjectId(event.target.value);
            setMembers([]);
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
      {projectId ? (
        <>
          <form
            onSubmit={add}
            className="grid items-end gap-4 rounded-xl border border-border bg-white p-5 sm:grid-cols-[1fr_130px_auto]"
          >
            <Field label="Member account UUID" htmlFor="member-user">
              <Input
                id="member-user"
                name="user_id"
                placeholder="00000000-0000-0000-0000-000000000000"
                required
                pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
              />
            </Field>
            <Field label="Access" htmlFor="member-role">
              <Select id="member-role" name="role">
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </Select>
            </Field>
            <Button type="submit" disabled={busy}>
              Add member
            </Button>
          </form>
          {members.length === 0 ? (
            <EmptyState title="No members yet">
              Add an existing account ID to share this project.
            </EmptyState>
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="p-4">Account</th>
                    <th className="p-4">Access</th>
                    <th className="p-4">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.user_id} className="border-t border-border">
                      <td className="p-4 font-mono text-xs">
                        {member.user_id}
                      </td>
                      <td className="p-4">{member.role}</td>
                      <td className="p-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRemove(member)}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      ) : (
        <EmptyState title="Choose a project to collaborate">
          Only project owners can manage membership.
        </EmptyState>
      )}
      <Dialog
        open={Boolean(remove)}
        onOpenChange={(open) => {
          if (!open && !busy) setRemove(null);
        }}
        title="Remove member access?"
        description="This account will lose its access to the selected project."
      >
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setRemove(null)}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={() => void revoke()}>
            Remove member
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
