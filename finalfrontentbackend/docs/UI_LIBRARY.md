# Web and native UI library

The canonical website is `finalfrontentbackend/frontendFINAL/`: Next.js, React, TypeScript, Tailwind CSS, and the existing uppercase component modules. The separate Expo/React Native app remains in `mobile/` at the repository root. Each app has its own dependencies and lockfile. Web components use the canonical CSS tokens; native components use `mobile/src/theme.ts` and do not import DOM components.

## Run the website

From the repository root:

```sh
cd finalfrontentbackend/frontendFINAL
npm ci
```

Copy `.env.example` to `.env.local` without overwriting an existing configuration. Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (a public publishable/anon key), and the appropriate `NEXT_PUBLIC_API_URL`. Then run:

```sh
npm run dev -- --hostname 127.0.0.1
```

Open the local previews:

| Route | Purpose |
| --- | --- |
| `/ui` | Reusable components and interactive loading, empty, error, and ready states |
| `/ui/workspace` | Workspace layout with section navigation and local demo actions |
| `/ui/website` | Full-width website layout and responsive content sections |

These routes are public and use local demonstration content, but normal development still requires the application's Supabase configuration. They do not bypass `proxy.ts`, session handling, or the existing protected-page checks. Real feature routes must continue using `requireUser`, `requireRole`, or `AuthGuard` as appropriate; hiding a navigation link does not authorize access.

On Windows, use `npm.cmd`/`npx.cmd` if PowerShell blocks their `.ps1` launchers. The browser test configuration described below supplies its own local placeholder values and requires no real credentials.

## Workspace shell and cards

`AppShell` provides the page body and one focusable `main` landmark. The root layout already owns the application navbar, skip link, and site footer. Avoid nesting shells or adding another `main` inside one.

This complete Client Component uses the current `AppShell`, `SidebarPanel`, `CardGrid`, `Button`, and `Card` APIs:

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { CardGrid } from "@/components/layout/CardGrid";
import { SidebarPanel } from "@/components/layout/SidebarPanel";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function ExamplePage() {
  const [view, setView] = useState("Overview");

  return (
    <AppShell
      title="Project space"
      description="Choose the next useful piece of work."
      sidebar={
        <SidebarPanel title="Project views" footer="Local UI example">
          <div className="space-y-1">
            {["Overview", "Activity"].map((item) => (
              <Button
                key={item}
                variant={view === item ? "secondary" : "ghost"}
                aria-pressed={view === item}
                className="w-full justify-start"
                onClick={() => setView(item)}
              >
                {item}
              </Button>
            ))}
          </div>
        </SidebarPanel>
      }
    >
      <CardGrid columns={2}>
        <Card
          title={view}
          description="A reusable container for your feature."
          variant="elevated"
          actions={<Badge variant="info">Preview</Badge>}
          footer={
            <Link href="/ui" className={buttonVariants({ variant: "outline" })}>
              Browse components
            </Link>
          }
        >
          <p className="text-sm leading-6">Replace this text with your feature content.</p>
        </Card>
        <Card title="Next step" variant="muted">
          <p className="text-sm leading-6">Wire real data through the existing typed API client.</p>
        </Card>
      </CardGrid>
    </AppShell>
  );
}
```

`AppShell` accepts `title`, `description`, `actions`, `sidebar`, `userRole`, `footer`, `mainId`, `fullWidth`, `className`, and `children`. Without a custom `sidebar`, it uses the existing role-aware `Sidebar`. Its `footer` is page content; the root layout's `Footer` remains the site footer.

`SidebarPanel` accepts `title`, `children`, `footer`, and `mainId`. It presents an aside at 1024px and wider and a button/drawer below that breakpoint. Children may be links or local selection buttons. Activating one closes the phone drawer. Keep the default `main-content` ID unless you also update the shell, drawer, and root skip link together, so focus has a visible destination when resizing to desktop.

`Card` preserves its `title`, `description`, `actions`, `footer`, and section HTML props. `variant` is `default`, `muted`, or `elevated`. Headers, actions, and footers wrap on narrow screens. `CardGrid` accepts `columns={1 | 2 | 3 | 4}`, defaults to `3`, and starts with one column on phones.

## Website shell

`WebsiteShell` shares the root navbar/footer and supplies a page body without the workspace sidebar. It defaults to `fullWidth={true}`, so sections own their inner width and padding. Use `fullWidth={false}` for the standard constrained page layout.

```tsx
import Link from "next/link";
import { WebsiteShell } from "@/components/layout/WebsiteShell";
import { buttonVariants } from "@/components/ui/Button";

export default function WebsitePage() {
  return (
    <WebsiteShell>
      <section className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h1 className="max-w-xl text-4xl font-semibold tracking-tight">A home for your idea.</h1>
          <p className="mt-4 max-w-xl text-muted-foreground">Add your product's purpose and next step.</p>
          <Link href="/ui/workspace" className={buttonVariants({ className: "mt-6" })}>
            Explore the workspace
          </Link>
        </div>
      </section>
    </WebsiteShell>
  );
}
```

For reusable navigation outside the existing root, `NavigationBar` accepts `brand`, `items`, `actions`, `mobileActions`, `userRole`, and `label`. Items use the existing `NavItem` contract (`href`, `label`, optional icon/role fields). The auth-aware `Navbar` supplies session actions to it. `Footer` accepts `children`, `links`, and `className`. Customize the existing root instances instead of rendering duplicates inside these page shells.

## Loading, feedback, and dialogs

`Button` keeps the `primary`, `secondary`, `outline`, `ghost`, and `destructive` variants, `sm`/`md`/`lg`/`icon` sizes, and `loading` flag. Loading disables the action and adds a decorative spinner. Coarse-pointer devices receive minimum 44px targets. Use `buttonVariants` to style actual links; icon-only controls need an accessible label.

`Spinner` accepts `size="sm" | "md" | "lg"` and `label`. Pass `label={null}` when the parent already announces progress. `Skeleton` and `SkeletonText` are decorative; provide the loading announcement on the parent. `CardSkeleton` can announce its own `label`, or accept `label={null}` for a collection with one shared announcement. Their animations stop for reduced motion.

```tsx
import { CardGrid } from "@/components/layout/CardGrid";
import { LoadingState } from "@/components/ui/LoadingState";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";

export function LoadingExamples() {
  return (
    <div className="space-y-6">
      <LoadingState label="Loading projects" description="Your workspace will appear here." />
      <CardGrid columns={2}>
        <CardSkeleton label="Loading project details" />
        <CardSkeleton label="Loading recent activity" lines={4} variant="muted" />
      </CardGrid>
      <p role="status" className="flex items-center gap-2 text-sm">
        <Spinner size="sm" label={null} /> Saving changes
      </p>
    </div>
  );
}
```

`LoadingState` accepts `label`, `description`, spinner `size`, and `variant="panel" | "inline"`. `EmptyState` accepts `title`, `description`, an optional Lucide `icon`, and an `action`. `ErrorState` accepts `title`, `message`, `onRetry`, `retryLabel`, `retrying`, and an optional extra `action`; it announces an alert and uses the loading button for retries. Replace placeholders with real data and a useful next action when loading succeeds.

`Modal` remains a controlled native dialog: `open`, `onClose`, `title`, `description`, `children`, `footer`, `size`, and `className`. It adds `variant="drawer"`, `side="left" | "right"`, `id`, `closeLabel`, and `onAfterClose`. It keeps focus inside, closes with Escape or an outside click, and restores the opener before invoking `onAfterClose`. Drawers use viewport height, scrollable content, and safe-area padding. Use `NavigationDrawer`/`SidebarPanel` for navigation; they also handle route changes and desktop resizing. The root viewport enables safe-area coverage without disabling pinch zoom.

## Native app

The existing Expo app lives in `mobile/`, separate from the canonical website. From the repository root:

```sh
cd mobile
npm ci
npm start
```

Its overview, layouts, cards, and feedback screens use local examples without service credentials. Follow the [mobile README](../../mobile/README.md) for phone access, file locations, and component reuse. `npm run web` in `mobile/` starts its localhost browser preview; it does not start the Next.js website. Keep native and web dependency installations separate.

## Verification

Run in `finalfrontentbackend/frontendFINAL/`:

```sh
npm run lint
npm run typecheck
npx playwright install chromium
npm run test:ui
```

`test:ui` builds the canonical frontend and starts a temporary loopback server at `127.0.0.1:3100`. The Playwright configuration supplies a local Supabase URL, a non-credential publishable-key placeholder, and a local API URL. The tests use signed-out sessions and UI examples; no real backend or hosted Supabase project is needed for this suite. This configuration does not relax the application auth requirements or prove hosted services work.

The suite targets desktop, phone, and 320px phone layouts, with navigation, focus, feedback, overflow, reduced-motion, and automated accessibility checks. Playwright uses Chromium by default. To use installed Edge on PowerShell:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm.cmd run test:ui
Remove-Item Env:PLAYWRIGHT_CHANNEL
```

On POSIX shells, use `PLAYWRIGHT_CHANNEL=msedge npm run test:ui`. Linux runners may need `npx playwright install --with-deps chromium`. Failure traces are written under the frontend's `.artifacts/playwright/`.

Run native checks separately in `mobile/`:

```sh
npm run lint
npm run typecheck
npm run export:web
npm run export:ios
```

The [UI workflow](../../.github/workflows/ui-checks.yml) has separate canonical-web and native jobs. The web job runs the browser suite; the native job checks lint, types, and web/iOS exports. These commands describe the checks to run, not a claim that a particular revision has passed.

An iOS export is a JavaScript/Hermes bundle, not a signed `.ipa`, simulator run, or physical-device test. Browser phone emulation also does not validate iPhone Safari. Before native release, test VoiceOver, Dynamic Type, safe areas, rotation, navigation, and real network states on devices; signing and distribution remain separate. Hosted authentication, RLS, and provider acceptance remain separate from the UI suite. See the [UI verification record](UI_VERIFICATION.md) for recorded validation and remaining gates.
