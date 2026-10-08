"use client";

import type { LucideIcon } from "lucide-react";
import { Activity, CircleCheck, FolderPlus, Settings, UserPlus } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ROUTES } from "@/lib/constants";
import { cn, isValidEmail, sleep } from "@/lib/utils";

type ActiveModal = "project" | "invite" | null;

const actionClassName = cn(
  "flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left text-sm font-medium text-foreground transition-colors",
  "hover:border-primary/30 hover:bg-primary-soft/50",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
);

function ActionIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
      <Icon aria-hidden="true" className="size-4" />
    </span>
  );
}

export function QuickActions({ className }: { className?: string }) {
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectError, setProjectError] = useState<string | undefined>();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | undefined>();

  const closeModal = () => {
    if (submitting) {
      return;
    }
    setActiveModal(null);
    setProjectError(undefined);
    setInviteError(undefined);
  };

  const openModal = (modal: Exclude<ActiveModal, null>) => {
    setNotice(null);
    setActiveModal(modal);
  };

  const handleCreateProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = projectName.trim();
    if (name.length < 2) {
      setProjectError("Project name must be at least 2 characters.");
      return;
    }
    setProjectError(undefined);
    setSubmitting(true);
    await sleep(600);
    setSubmitting(false);
    setActiveModal(null);
    setProjectName("");
    setProjectDescription("");
    setNotice(`Project “${name}” created (demo data, not saved).`);
  };

  const handleInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = inviteEmail.trim();
    if (!isValidEmail(email)) {
      setInviteError("Enter a valid email address.");
      return;
    }
    setInviteError(undefined);
    setSubmitting(true);
    await sleep(600);
    setSubmitting(false);
    setActiveModal(null);
    setInviteEmail("");
    setNotice(`Invitation prepared for ${email} (demo data, not sent).`);
  };

  return (
    <Card title="Quick actions" description="Common things you might do next." className={className}>
      <div className="flex flex-col gap-2">
        <button type="button" className={actionClassName} onClick={() => openModal("project")}>
          <ActionIcon icon={FolderPlus} />
          New project
        </button>
        <button type="button" className={actionClassName} onClick={() => openModal("invite")}>
          <ActionIcon icon={UserPlus} />
          Invite teammate
        </button>
        <Link href={`${ROUTES.dashboard}#activity`} className={actionClassName}>
          <ActionIcon icon={Activity} />
          View activity
        </Link>
        <Link href={ROUTES.settings} className={actionClassName}>
          <ActionIcon icon={Settings} />
          Open settings
        </Link>
      </div>

      <div aria-live="polite" className="mt-4 empty:hidden">
        {notice && (
          <p className="flex items-start gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
            <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {notice}
          </p>
        )}
      </div>

      <Modal
        open={activeModal === "project"}
        onClose={closeModal}
        title="Create a project"
        description="Give it a name your team will recognise."
        footer={
          <>
            <Button variant="outline" onClick={closeModal} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" form="create-project-form" loading={submitting}>
              Create project
            </Button>
          </>
        }
      >
        <form id="create-project-form" onSubmit={handleCreateProject} className="space-y-4" noValidate>
          <Input
            label="Project name"
            placeholder="e.g. Onboarding flow"
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            error={projectError}
            required
            disabled={submitting}
          />
          <Input
            label="Description"
            placeholder="What is this project about?"
            helperText="Optional. You can change this later."
            value={projectDescription}
            onChange={(event) => setProjectDescription(event.target.value)}
            disabled={submitting}
          />
        </form>
      </Modal>

      <Modal
        open={activeModal === "invite"}
        onClose={closeModal}
        title="Invite a teammate"
        description="They'll get access to this workspace."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={closeModal} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" form="invite-form" loading={submitting}>
              Send invite
            </Button>
          </>
        }
      >
        <form id="invite-form" onSubmit={handleInvite} noValidate>
          <Input
            label="Email address"
            type="email"
            placeholder="teammate@example.com"
            autoComplete="email"
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            error={inviteError}
            required
            disabled={submitting}
          />
        </form>
      </Modal>
    </Card>
  );
}
