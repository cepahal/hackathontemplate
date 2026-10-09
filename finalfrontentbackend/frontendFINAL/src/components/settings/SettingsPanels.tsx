"use client";

import { CircleCheck, Server } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { api, isApiRequestError } from "@/lib/api";
import { API_BASE_URL, API_HEALTH_PATH } from "@/lib/constants";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/browser";
import { sleep } from "@/lib/utils";
import type { HealthResponse } from "@/types";
import type { AuthUser } from "@/types/auth";

type ConnectionState =
  | { status: "checking" }
  | { status: "connected" }
  | { status: "error"; message: string };

function ProfileSettings({ user }: { user: AuthUser }) {
  const router = useRouter();
  const [name, setName] = useState(user.fullName ?? "");
  const [nameError, setNameError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length > 0 && trimmed.length < 2) {
      setNameError("Name must be at least 2 characters.");
      return;
    }
    setNameError(undefined);
    setServerError(undefined);
    setSaved(false);
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ data: { full_name: trimmed || null } });
      if (error) {
        setServerError(getAuthErrorMessage(error));
        return;
      }
      setSaved(true);
      router.refresh();
    } catch (error) {
      setServerError(getAuthErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      title="Profile"
      description="How you appear to teammates."
      footer={
        <>
          <span aria-live="polite" className="mr-auto text-sm">
            {saved && (
              <Badge variant="success">
                <CircleCheck aria-hidden="true" className="size-3.5" />
                Saved
              </Badge>
            )}
          </span>
          <Button type="submit" form="profile-form" loading={saving}>
            Save changes
          </Button>
        </>
      }
    >
      <form id="profile-form" onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        {serverError && (
          <Alert variant="error" className="sm:col-span-2">
            {serverError}
          </Alert>
        )}
        <Input
          label="Full name"
          autoComplete="name"
          placeholder="Your name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={nameError}
          disabled={saving}
        />
        <Input
          label="Email"
          type="email"
          value={user.email ?? ""}
          readOnly
          disabled
          helperText={user.emailConfirmed ? "Verified" : "Not verified yet"}
        />
        <Input
          label="Role"
          value={user.role}
          readOnly
          disabled
          helperText="Assigned by an administrator in Supabase."
        />
      </form>
    </Card>
  );
}

/** Resolves to `null` when the check was cancelled. */
async function checkBackendHealth(signal?: AbortSignal): Promise<ConnectionState | null> {
  try {
    const response = await api.get<HealthResponse>(API_HEALTH_PATH, {
      signal,
      timeoutMs: 5_000,
      auth: false,
    });
    if (response?.status === "ok") {
      return { status: "connected" };
    }
    return {
      status: "error",
      message: `Unexpected response from ${API_HEALTH_PATH}. Expected {"status":"ok"}.`,
    };
  } catch (error) {
    if (isApiRequestError(error) && error.code === "ABORTED") {
      return null;
    }
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error while contacting the API.",
    };
  }
}

function ConnectionSettings() {
  const [connection, setConnection] = useState<ConnectionState>({ status: "checking" });

  useEffect(() => {
    const controller = new AbortController();
    void checkBackendHealth(controller.signal).then((result) => {
      if (result) {
        setConnection(result);
      }
    });
    return () => controller.abort();
  }, []);

  const retry = () => {
    setConnection({ status: "checking" });
    void checkBackendHealth().then((result) => {
      if (result) {
        setConnection(result);
      }
    });
  };

  return (
    <Card
      title="Backend connection"
      description={
        <>
          Checks <code className="rounded bg-muted px-1 py-0.5 text-xs">{`${API_BASE_URL}${API_HEALTH_PATH}`}</code>
        </>
      }
      actions={
        connection.status === "connected" ? (
          <Badge variant="success">Connected</Badge>
        ) : connection.status === "error" ? (
          <Badge variant="error">Unreachable</Badge>
        ) : (
          <Badge variant="info">Checking</Badge>
        )
      }
    >
      {connection.status === "checking" && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Spinner size="sm" label="Checking backend connection" />
          Contacting the API…
        </div>
      )}
      {connection.status === "connected" && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Server aria-hidden="true" className="size-4 text-success" />
          The backend responded successfully.
        </p>
      )}
      {connection.status === "error" && (
        <ErrorState
          title="Can't reach the backend"
          message={connection.message}
          onRetry={retry}
        />
      )}
    </Card>
  );
}

function DangerZone() {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const confirmed = confirmText.trim().toLowerCase() === "delete";

  const close = () => {
    if (deleting) {
      return;
    }
    setOpen(false);
    setConfirmText("");
  };

  const handleDelete = async () => {
    setDeleting(true);
    await sleep(800);
    setDeleting(false);
    setOpen(false);
    setConfirmText("");
    setDeleted(true);
  };

  return (
    <Card
      title="Danger zone"
      description="Irreversible actions for your account."
      className="border-danger/30"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Delete account</p>
          <p className="text-sm text-muted-foreground">
            Permanently remove your account and all associated data.
          </p>
        </div>
        <Button
          variant="destructive"
          onClick={() => {
            setDeleted(false);
            setOpen(true);
          }}
        >
          Delete account
        </Button>
      </div>
      <div aria-live="polite" className="empty:hidden">
        {deleted && (
          <p className="mt-4 text-sm text-muted-foreground">
            Demo mode: nothing was deleted. Connect your backend to make this real.
          </p>
        )}
      </div>

      <Modal
        open={open}
        onClose={close}
        size="sm"
        title="Delete account?"
        description="This action cannot be undone."
        footer={
          <>
            <Button variant="outline" onClick={close} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={!confirmed}
              loading={deleting}
            >
              Delete account
            </Button>
          </>
        }
      >
        <Input
          label='Type "delete" to confirm'
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
          autoComplete="off"
          disabled={deleting}
        />
      </Modal>
    </Card>
  );
}

export function SettingsPanels({ user }: { user: AuthUser }) {
  return (
    <div className="space-y-6">
      <ProfileSettings user={user} />
      <ConnectionSettings />
      <DangerZone />
    </div>
  );
}
