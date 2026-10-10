"use client";

import { useState } from "react";
import { Check, Copy, Layers3, MousePointer2, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { CardGrid } from "@/components/layout/CardGrid";

const shellExample = `import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";

export default function ProjectsPage() {
  return (
    <AppShell title="Projects" description="Your next idea starts here.">
      <Card title="Your first project">Add your content.</Card>
    </AppShell>
  );
}`;

export function ComponentShowcase() {
  const [state, setState] = useState("Ready");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");

  async function copyExample() {
    try {
      await navigator.clipboard.writeText(shellExample);
      setCopyStatus("Copied to clipboard.");
    } catch {
      setCopyStatus("Copy is unavailable. Select the example below to copy it manually.");
    }
  }

  return (
    <div className="space-y-16">
      <section aria-labelledby="pieces-heading">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div><p className="mb-2 text-xs font-semibold tracking-[0.18em] text-primary">02 / THE SMALL THINGS</p><h2 id="pieces-heading" className="text-2xl font-semibold tracking-tight">Familiar pieces. Thoughtful details.</h2></div>
          <p className="max-w-sm text-sm leading-6 text-muted-foreground">A consistent rhythm, clear feedback, and room for your content.</p>
        </div>
        <CardGrid columns={3}>
          <Card title="Actions with intention" description="A clear next step, wherever you are.">
            <div className="mb-6 flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary"><MousePointer2 aria-hidden="true" className="size-5" /></div>
            <div className="flex flex-wrap gap-2"><Button onClick={() => setDialogOpen(true)}>Preview dialog</Button><Button variant="outline" disabled>Unavailable</Button></div>
          </Card>
          <Card title="A little context" description="Status stays readable at a glance.">
            <div className="mb-6 flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary"><Layers3 aria-hidden="true" className="size-5" /></div>
            <div className="flex flex-wrap gap-2"><Badge variant="success">Ready</Badge><Badge variant="info">In progress</Badge><Badge variant="warning">Needs review</Badge></div>
          </Card>
          <Card title="Worth the wait" description="Three sizes, one accessible pattern.">
            <div className="flex min-h-24 items-center justify-around gap-4 rounded-lg bg-muted/50">
              <Spinner size="sm" label="Small loading indicator" /><Spinner size="md" label="Medium loading indicator" /><Spinner size="lg" label="Large loading indicator" />
            </div>
          </Card>
        </CardGrid>
      </section>

      <section aria-labelledby="states-heading" className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="mb-3 text-xs font-semibold tracking-[0.18em] text-primary">03 / EVERY STATE COUNTS</p>
          <h2 id="states-heading" className="text-3xl font-semibold tracking-tight">Design the moments<br className="hidden sm:block" /> between the clicks.</h2>
          <p className="mt-4 max-w-md text-sm leading-7 text-muted-foreground">A blank screen is rarely helpful. Tell people what is happening and give them a useful way forward.</p>
          <div role="group" aria-label="Preview state" className="mt-6 flex flex-wrap gap-2">
            {["Ready", "Loading", "Empty", "Error"].map((value) => <Button key={value} variant={state === value ? "primary" : "outline"} aria-pressed={state === value} onClick={() => setState(value)}>{value}</Button>)}
          </div>
        </div>
        <div aria-label="State preview" className="min-h-72 rounded-2xl border border-border bg-muted/50 p-4 sm:p-6">
          {state === "Ready" && <Card title="Ready for the next step." description="Your project has a home. Give it a direction." footer={<Badge variant="success"><Check aria-hidden="true" className="size-3" /> Ready to build</Badge>}><div className="flex items-center gap-4 py-4"><span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"><PanelLeft aria-hidden="true" className="size-6" /></span><p className="text-sm leading-6 text-muted-foreground">A reusable card with a title, content, and a footer. All three are yours to adapt.</p></div></Card>}
          {state === "Loading" && <CardSkeleton label="Loading project preview…" />}
          {state === "Empty" && <EmptyState title="A little space for something new" description="Your first project will appear here." action={<Button onClick={() => setState("Ready")}>Add a project</Button>} />}
          {state === "Error" && <ErrorState title="Let’s give that another try" message="This is an example error. Retry to return to the ready state." onRetry={() => setState("Ready")} />}
        </div>
      </section>

      <section aria-labelledby="example-heading" className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 text-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700 px-5 py-5 sm:px-7">
          <div><p className="mb-1 text-xs font-medium text-slate-400">04 / MAKE IT YOURS</p><h2 id="example-heading" className="font-semibold">A small start. Plenty of room.</h2></div>
          <button onClick={copyExample} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-600 px-4 text-sm hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-white"><Copy aria-hidden="true" className="size-4" /> Copy shell example</button>
        </div>
        <pre tabIndex={0} aria-label="App shell code example" className="overflow-x-auto p-5 text-xs leading-7 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-white sm:p-7 sm:text-sm"><code>{shellExample}</code></pre>
        <p role="status" className="min-h-10 px-5 pb-4 text-sm text-slate-300 sm:px-7">{copyStatus}</p>
      </section>

      <Modal open={dialogOpen} onClose={() => setDialogOpen(false)} title="A useful next step" description="Give one decision a little room." footer={<Button onClick={() => setDialogOpen(false)}>Got it</Button>}>
        <p className="text-sm leading-7 text-muted-foreground">Use this pattern for a focused action. The rest of the page waits while you finish, and your place is kept when you close it.</p>
      </Modal>
    </div>
  );
}
