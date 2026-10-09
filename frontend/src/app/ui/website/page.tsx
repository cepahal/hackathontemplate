import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Command, LayoutPanelLeft, Layers3, Smartphone } from "lucide-react";
import { WebsiteShell } from "@/components/layout/website-shell";
import { CardGrid } from "@/components/layout/card-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Website shell · Launchpad",
  description: "A reusable website layout that fits desktop and mobile screens.",
};

const items = [
  { id: "overview", label: "Overview", href: "#overview" },
  { id: "patterns", label: "Patterns", href: "#patterns" },
  { id: "library", label: "Component library", href: "/ui" },
] as const;

export default function WebsitePreviewPage() {
  return (
    <WebsiteShell
      brand={
        <Link href="/ui/website" className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Command aria-hidden="true" className="size-6 text-primary" />
          launchpad.
        </Link>
      }
      items={items}
      actions={<Badge variant="outline">Website preview</Badge>}
      footerLinks={
        <>
          <Link href="/ui" className="hover:underline">Component library</Link>
          <Link href="/welcome" className="hover:underline">Starter home</Link>
        </>
      }
    >
      <section id="overview" className="grid items-center gap-12 py-12 sm:py-20 lg:grid-cols-[1.25fr_1fr]">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-primary">YOUR IDEA STARTS HERE</p>
          <h1 className="mt-5 max-w-xl text-4xl leading-[1.08] font-semibold tracking-tight sm:text-6xl">
            A little structure.<br />A lot of possibility.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-8 text-muted-foreground">
            Start with a clear layout. Give your content room to breathe.
            Then spend your time building the part that matters.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link href="/ui">
              Open component library
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
          <p className="mt-4 text-xs leading-6 text-muted-foreground">
            A live layout example. No account or setup required.
          </p>
        </div>
        <div className="hero-grid rounded-2xl border border-border bg-secondary p-5 sm:p-8">
          <Card>
            <CardHeader>
              <div className="mb-6 flex items-center justify-between gap-4">
                <span className="text-xs font-medium text-muted-foreground">YOUR NEXT PROJECT</span>
                <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
              </div>
              <CardTitle className="text-2xl">Make room for the idea.</CardTitle>
              <CardDescription className="mt-2">
                Reusable pieces that feel at home on every screen.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="divide-y divide-border">
                {["Choose a shell", "Add your content", "Make it yours"].map((step, index) => (
                  <li key={step} className="flex items-center gap-4 py-4 text-sm">
                    <span className="font-mono text-xs text-muted-foreground">0{index + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </section>
      <section id="patterns" className="scroll-mt-8 border-t border-border py-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-primary">FAMILIAR BY DESIGN</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">The essentials, ready to use.</h2>
          </div>
          <p className="max-w-sm text-sm leading-7 text-muted-foreground">
            Resize this page or open the menu on your phone to try the same components in another layout.
          </p>
        </div>
        <CardGrid>
          {[
            { icon: LayoutPanelLeft, title: "A place for everything", text: "Navigation, a flexible content area, and a quiet footer. Compose the shell around your product." },
            { icon: Layers3, title: "Content that fits", text: "Cards share a simple structure and stack as the screen narrows. Long content stays inside its container." },
            { icon: Smartphone, title: "Comfortable on a phone", text: "A focused navigation drawer, roomy controls, and spacing that accounts for the edges of the screen." },
          ].map(({ icon: Icon, title, text }) => (
            <Card key={title}>
              <CardHeader>
                <Icon aria-hidden="true" className="mb-4 size-6 text-primary" />
                <CardTitle>{title}</CardTitle>
                <CardDescription>{text}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </CardGrid>
      </section>
    </WebsiteShell>
  );
}
