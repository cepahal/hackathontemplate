import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Command,
  FileText,
  FolderKanban,
  Layers3,
  Radio,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function WelcomePage() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-7">
        <Link
          href="/welcome"
          className="flex items-center gap-2 text-xl font-semibold"
        >
          <Command className="size-6 text-primary" />
          launchpad.
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/ui"
            className="inline-flex min-h-11 items-center text-sm font-medium hover:underline"
          >
            UI library
          </Link>
          <Button asChild variant="outline">
            <Link href="/login">
              Sign in
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </header>
      <main>
        <section className="hero-grid mx-4 rounded-3xl border border-[#dfe7d6] bg-[#eaf0e1] px-6 py-20 text-center sm:py-28">
          <p className="text-xs font-semibold tracking-[2px] text-primary">
            ONE WORKSPACE. YOUR NEXT IDEA.
          </p>
          <h1 className="mx-auto mt-6 max-w-3xl text-5xl leading-[1.08] font-semibold tracking-[-2px] sm:text-7xl">
            From “what if”
            <br />
            to something real.
          </h1>
          <p className="mx-auto mt-7 max-w-xl text-base leading-8 text-muted-foreground">
            Bring projects, AI, and your knowledge together. A practical
            starting point for the useful thing you’ve been meaning to build.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link href="/">
              Open your workspace
              <ArrowRight />
            </Link>
          </Button>
          <p className="mt-4 text-xs text-muted-foreground">
            Connect your own services. Make the experience yours.
          </p>
        </section>
        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-10 flex flex-wrap justify-between gap-4">
            <h2 className="max-w-sm text-3xl font-semibold tracking-tight">
              The building blocks.
              <br />
              Already together.
            </h2>
            <p className="max-w-sm text-sm leading-7 text-muted-foreground">
              A foundation you can understand, adapt, and extend.
              Provider-backed features become available when your services are
              configured.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: FolderKanban,
                title: "Projects with a purpose",
                text: "Keep your ideas organized with private, persisted projects.",
              },
              {
                icon: Bot,
                title: "AI, in your workflow",
                text: "Stream conversations, inspect structured answers, and review agent actions.",
              },
              {
                icon: FileText,
                title: "Knowledge with receipts",
                text: "Ask questions about your documents and inspect the source passages.",
              },
              {
                icon: ShieldCheck,
                title: "Your account, your data",
                text: "Supabase authentication and database access rules protect your work.",
              },
              {
                icon: Radio,
                title: "A shared moment",
                text: "Project membership, private presence, and live change notifications.",
              },
              {
                icon: Layers3,
                title: "Ready to adapt",
                text: "Reusable components and API boundaries help your next feature fit naturally.",
              },
            ].map(({ icon: Icon, title, text }) => (
              <Card key={title} className="p-6">
                <Icon className="mb-5 size-6 text-primary" />
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  {text}
                </p>
              </Card>
            ))}
          </div>
        </section>
        <section className="mx-auto mb-16 max-w-6xl px-6">
          <div className="rounded-2xl bg-primary px-6 py-12 text-center text-white">
            <h2 className="text-3xl font-semibold tracking-tight">
              Start with one good idea.
            </h2>
            <p className="mt-4 text-sm text-white/70">
              The rest can grow from there.
            </p>
            <Button asChild variant="secondary" className="mt-7">
              <Link href="/login">
                Let’s get building
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>
      </main>
      <footer className="border-t border-border px-6 py-7 text-center text-xs text-muted-foreground">
        Launchpad · Built to become yours.
      </footer>
    </div>
  );
}
