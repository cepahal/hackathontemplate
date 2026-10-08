"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  Command,
  Layers3,
  LayoutDashboard,
  LayoutPanelLeft,
  LoaderCircle,
  MonitorSmartphone,
  PanelTop,
  Smartphone,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { CardGrid } from "@/components/layout/card-grid";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorNotice, Loading } from "@/components/ui/feedback";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const sections = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "layouts", label: "Layout shells", icon: LayoutPanelLeft },
  { id: "cards", label: "Card containers", icon: Layers3 },
  { id: "states", label: "Feedback states", icon: LoaderCircle },
] as const;
type Section = (typeof sections)[number]["id"];
const Brand = () => (
  <Link
    href="/ui"
    className="flex items-center gap-2 text-xl font-semibold tracking-tight"
  >
    <Command aria-hidden="true" className="size-6 text-primary" />
    launchpad.
  </Link>
);

export function UiLibrary() {
  const [section, setSection] = useState<Section>("overview");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [state, setState] = useState("empty");
  const selected = sections.find((item) => item.id === section)!;
  function select(id: string) {
    const item = sections.find((entry) => entry.id === id);
    if (item) setSection(item.id);
  }
  return (
    <AppShell
      brand={<Brand />}
      items={sections}
      activeId={section}
      onSelect={select}
      title={<>UI library / {selected.label}</>}
      actions={
        <>
          <Badge variant="outline">UI preview</Badge>
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/welcome">
              Back to home
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </>
      }
      sidebarFooter={
        <div className="rounded-xl bg-background p-4">
          <MonitorSmartphone
            aria-hidden="true"
            className="mb-3 size-5 text-primary"
          />
          <p className="text-sm font-medium">One idea. Every screen.</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Responsive web layouts and a matching native mobile starter.
          </p>
        </div>
      }
      footerLinks={
        <>
          <Link href="/welcome" className="hover:underline">
            Home
          </Link>
          <Link href="/login" className="hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <div key={section} className="enter space-y-8">
        <div>
          <p className="text-xs font-semibold tracking-[1.5px] text-primary">
            BUILDING BLOCKS
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {section === "overview"
              ? "A head start for your next idea."
              : selected.label}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
            {section === "overview"
              ? "A small, thoughtful UI kit. Familiar patterns, comfortable spacing, and room to make it yours."
              : "Try the components below. These previews use local UI state and need no account or connected service."}
          </p>
        </div>
        {section === "overview" && (
          <>
            <section className="hero-grid overflow-hidden rounded-2xl border border-border bg-secondary p-6 sm:p-10">
              <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">
                <div className="max-w-lg">
                  <Badge variant="outline">Web + iOS</Badge>
                  <h2 className="mt-5 text-3xl leading-tight font-semibold tracking-tight">
                    Less scaffolding.
                    <br />
                    More of your idea.
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-muted-foreground">
                    Navigation, cards, and the states between them. Start with a
                    complete shell, then add the part only you can build.
                  </p>
                  <Button
                    className="mt-6 min-h-11"
                    onClick={() => setSection("layouts")}
                  >
                    Explore the layouts
                    <ArrowRight aria-hidden="true" />
                  </Button>
                </div>
                <div className="flex shrink-0 items-center gap-4 rounded-xl border border-border bg-card p-6">
                  <PanelTop
                    aria-hidden="true"
                    className="size-10 text-primary"
                  />
                  <span className="text-muted-foreground">+</span>
                  <Smartphone
                    aria-hidden="true"
                    className="size-10 text-primary"
                  />
                  <span className="sr-only">
                    Website and mobile app layouts
                  </span>
                </div>
              </div>
            </section>
            <CardGrid>
              {[
                {
                  id: "layouts",
                  icon: LayoutPanelLeft,
                  title: "A place for everything",
                  text: "A navbar, desktop sidebar, mobile drawer, and footer that work together.",
                  action: "Try the shells",
                },
                {
                  id: "cards",
                  icon: Layers3,
                  title: "Content with structure",
                  text: "Composable headers, content, and actions. A grid that fits the screen.",
                  action: "Explore cards",
                },
                {
                  id: "states",
                  icon: LoaderCircle,
                  title: "Every step considered",
                  text: "Clear loading, empty, error, and ready states with accessible labels.",
                  action: "Try the states",
                },
              ].map(({ id, icon: Icon, title, text, action }) => (
                <Card key={id} className="flex flex-col">
                  <CardHeader>
                    <Icon
                      aria-hidden="true"
                      className="mb-3 size-6 text-primary"
                    />
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>{text}</CardDescription>
                  </CardHeader>
                  <CardFooter className="mt-auto">
                    <Button
                      variant="ghost"
                      className="min-h-11 px-0"
                      onClick={() => select(id)}
                    >
                      {action}
                      <ArrowRight aria-hidden="true" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </CardGrid>
          </>
        )}
        {section === "layouts" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Navigation bar</CardTitle>
                <CardDescription>
                  A brand, page context, and actions. On small screens, the
                  shell adds a navigation drawer.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-xl border border-border">
                  <Navbar
                    brand={<span className="font-semibold">Your product</span>}
                    actions={
                      <Button
                        className="min-h-11"
                        onClick={() => setDialogOpen(true)}
                      >
                        Preview dialog
                      </Button>
                    }
                  />
                </div>
              </CardContent>
            </Card>
            <CardGrid>
              <Card>
                <CardHeader>
                  <CardTitle>Sidebar</CardTitle>
                  <CardDescription>
                    Use the sidebar on the left. On a narrow screen, open the
                    menu in the navbar. Choose a section to close it.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-7 text-muted-foreground">
                    Keyboard navigation, Escape to close, and focus returning to
                    the menu button.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Footer</CardTitle>
                  <CardDescription>
                    A quiet home for secondary links.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Footer
                    className="mt-0"
                    links={
                      <Link href="/welcome" className="hover:underline">
                        Home
                      </Link>
                    }
                  >
                    Your product · Your next idea.
                  </Footer>
                </CardContent>
              </Card>
            </CardGrid>
          </>
        )}
        {section === "cards" && (
          <CardGrid>
            <Card className="flex flex-col">
              <CardHeader>
                <Badge variant="outline" className="w-fit">
                  Content card
                </Badge>
                <CardTitle className="mt-3">
                  Start with something useful.
                </CardTitle>
                <CardDescription>
                  A clear title and a little context go a long way.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-7">
                  Add your content here. Cards grow with their content and stack
                  naturally on mobile.
                </p>
              </CardContent>
              <CardFooter className="mt-auto">
                <Button
                  className="min-h-11"
                  onClick={() => setDialogOpen(true)}
                >
                  Preview an action
                  <ArrowRight aria-hidden="true" />
                </Button>
              </CardFooter>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>A softer starting point</CardTitle>
                <CardDescription>
                  An empty card still has a next step.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EmptyState
                  title="Nothing here yet"
                  action={
                    <Button
                      variant="outline"
                      className="min-h-11"
                      onClick={() => setDialogOpen(true)}
                    >
                      Preview create
                    </Button>
                  }
                >
                  Use a helpful prompt to invite the first action.
                </EmptyState>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>While you wait</CardTitle>
                <CardDescription>
                  Keep the layout steady while content arrives.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Loading label="Loading preview…" />
                <p className="text-center text-xs text-muted-foreground">
                  Static loading example
                </p>
              </CardContent>
            </Card>
          </CardGrid>
        )}
        {section === "states" && (
          <Card>
            <CardHeader>
              <CardTitle>Make every state clear</CardTitle>
              <CardDescription>
                Switch between examples. Retry and create change this preview to
                its ready state.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={state} onValueChange={setState}>
                <TabsList aria-label="Preview state">
                  {["loading", "empty", "error", "ready"].map((value) => (
                    <TabsTrigger
                      key={value}
                      value={value}
                      className="min-h-11 capitalize"
                    >
                      {value}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <TabsContent value="loading">
                  <Loading label="Loading preview…" />
                </TabsContent>
                <TabsContent value="empty">
                  <EmptyState
                    title="A fresh start"
                    action={
                      <Button
                        className="min-h-11"
                        onClick={() => setState("ready")}
                      >
                        Preview create
                      </Button>
                    }
                  >
                    No items to show. Give people a clear next action.
                  </EmptyState>
                </TabsContent>
                <TabsContent value="error">
                  <ErrorNotice
                    message="This is a sample error. Your work is still here; try again when you’re ready."
                    retry={() => setState("ready")}
                  />
                </TabsContent>
                <TabsContent value="ready">
                  <div
                    role="status"
                    className="flex items-center gap-3 rounded-xl bg-secondary p-6"
                  >
                    <Check aria-hidden="true" className="size-5 text-primary" />
                    <p className="text-sm">
                      The ready-state preview is showing.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
              <div className="mt-8 flex items-center gap-3 border-t border-border pt-5 text-sm text-muted-foreground">
                <Spinner label="Inline loading example" />A spinner also fits
                beside an inline status.
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Room for your next action"
        description="This is a UI preview. Add your own form or content inside this reusable dialog."
      >
        <p className="mb-6 text-sm leading-7 text-muted-foreground">
          The dialog keeps keyboard focus inside and returns it to the button
          when closed.
        </p>
        <Button className="min-h-11" onClick={() => setDialogOpen(false)}>
          Done
          <Check aria-hidden="true" />
        </Button>
      </Dialog>
    </AppShell>
  );
}
