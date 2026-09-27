"use client";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "./button";
import { Dialog } from "./dialog";
import { Input } from "./form";

export function CommandMenu({
  items,
  onSelect,
}: {
  items: readonly { id: string; label: string }[];
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const results = useRef<HTMLDivElement>(null);
  const filtered = items.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase()),
  );
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setQuery("");
        setOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  function choose(id: string) {
    onSelect(id);
    setOpen(false);
    setQuery("");
  }
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setQuery("");
          setOpen(true);
        }}
      >
        <Search />
        Navigate
        <span className="hidden text-xs text-muted-foreground sm:inline">
          Ctrl/⌘ K
        </span>
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Go to a workspace tool"
        description="Search tools, then use Tab or arrow keys to choose one."
      >
        <Input
          aria-label="Search workspace tools"
          placeholder="Search tools…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              results.current?.querySelector("button")?.focus();
            }
            if (event.key === "Enter" && filtered.length) {
              event.preventDefault();
              choose(filtered[0].id);
            }
          }}
          autoFocus
        />
        <div
          ref={results}
          className="mt-3 space-y-1"
          onKeyDown={(event) => {
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
            event.preventDefault();
            const buttons = [...event.currentTarget.querySelectorAll("button")];
            const index = buttons.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            buttons[
              (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) %
                buttons.length
            ]?.focus();
          }}
        >
          {filtered.map((item) => (
            <button
              key={item.id}
              onClick={() => choose(item.id)}
              className="block w-full rounded-lg px-3 py-3 text-left text-sm hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-2 focus-visible:outline-ring"
            >
              {item.label}
            </button>
          ))}
          {filtered.length === 0 && (
            <p role="status" className="p-4 text-sm text-muted-foreground">
              No matching tools.
            </p>
          )}
        </div>
      </Dialog>
    </>
  );
}
