"use client";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { api, errorMessage } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import {
  EmptyState,
  ErrorNotice,
  Loading,
  useToast,
} from "@/components/ui/feedback";

type DocumentRecord = { id: string; title: string; created_at: string };
export function DocumentLibrary() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [remove, setRemove] = useState<DocumentRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setDocuments(await api("/api/v1/ai/documents"));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  async function destroy() {
    if (!remove) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/v1/ai/documents/${remove.id}`, { method: "DELETE" });
      setRemove(null);
      toast("Document and its indexed passages deleted.");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Your document library</h3>
        <Button
          size="sm"
          variant="ghost"
          disabled={loading}
          onClick={() => void load()}
        >
          <RefreshCw />
          Refresh
        </Button>
      </div>
      {error && <ErrorNotice message={error} retry={() => void load()} />}
      {loading ? (
        <Loading label="Loading documents…" />
      ) : !documents.length ? (
        <EmptyState title="No indexed documents">
          Import a document in the Add a document tab. Refresh this library
          after indexing.
        </EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-background">
              <tr>
                <th className="p-4 font-medium">Document</th>
                <th className="p-4 font-medium">Added</th>
                <th className="p-4">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.id} className="border-t border-border">
                  <td className="p-4">{document.title}</td>
                  <td className="p-4 text-xs text-muted-foreground">
                    {new Date(document.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Delete ${document.title}`}
                      onClick={() => setRemove(document)}
                    >
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <Dialog
        open={Boolean(remove)}
        onOpenChange={(open) => {
          if (!open && !busy) setRemove(null);
        }}
        title="Delete this document?"
        description={`This permanently removes “${remove?.title ?? ""}” and its indexed passages from your knowledge base.`}
      >
        {error && <ErrorNotice message={error} />}
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
            Delete document
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
