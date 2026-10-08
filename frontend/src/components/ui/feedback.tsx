"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, Inbox, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function ErrorNotice({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1 break-words leading-6">
        {message}
        {retry && (
          <div className="mt-2">
            <Button size="sm" variant="outline" onClick={retry}>
              Try again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 p-12 text-sm text-muted-foreground">
      <Spinner label={label} />
      {label}
    </div>
  );
}
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-input bg-white/50 px-6 py-12 text-center">
      <Inbox className="mx-auto mb-4 size-8 text-primary/60" />
      <h3 className="font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {children}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

const ToastContext = createContext<(message: string) => void>(() => undefined);
export const useToast = () => useContext(ToastContext);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<{ message: string; id: number } | null>(
    null,
  );
  const notify = useCallback(
    (message: string) => setNotice({ message, id: Date.now() }),
    [],
  );
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  return (
    <ToastContext.Provider value={notify}>
      {children}
      {notice && (
        <div
          role="status"
          className="fixed right-5 bottom-5 z-[60] flex max-w-[calc(100%-2.5rem)] items-center gap-3 rounded-xl border border-border bg-white px-5 py-4 text-sm shadow-xl"
        >
          <CheckCircle2 className="size-4 shrink-0 text-primary" />
          {notice.message}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice(null)}
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}
