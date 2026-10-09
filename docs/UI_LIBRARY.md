# Web and iOS UI library

The website uses the existing Tailwind/shadcn-style components and Radix primitives. The native app uses Expo Router and React Native components with the same green palette, spacing, rounded containers, and content hierarchy. Web DOM components are not imported into native screens.

This delivery covers UI scaffolding: navigation bar, sidebar/drawer, footer, card containers, responsive grids, loading spinners, and loading/error/empty/ready states. The galleries are interactive local examples; they do not imply a connected backend. Existing web authentication and feature panels remain behind `AuthGate`.

## Run the website

From the repository root:

```sh
npm ci --prefix frontend
npm run dev:frontend
```

Open `http://127.0.0.1:3000/ui`. It requires no account, API, or Supabase keys. The welcome page links to it. The authenticated workspace now uses the same `AppShell`.

For a full-width website example, open `/ui/website` or choose **Layout shells → Open website preview** in the gallery. Both previews adapt to desktop, tablet, and phone widths. The `/ui` route layout opts into `viewportFit: "cover"` for safe-area-aware shells without disabling pinch zoom. Older routes retain browser-managed insets. When reusing a shell on a new route, opt into that viewport setting only after all content on the route handles safe areas.

## Run on an iPhone

```sh
npm run setup:mobile
npm run dev:mobile
```

Install an Expo Go version compatible with the SDK in `mobile/package.json`. Put the phone and computer on the same Wi-Fi, then scan the terminal's QR code with the iPhone camera. The default Expo development command uses LAN access so a physical phone can connect. Stop it with Ctrl+C.

For a local browser preview of the native components:

```sh
npm --prefix mobile run web
```

This binds the Expo web preview to localhost. It is a preview of the React Native app; the Next.js website remains in `frontend/`.

Windows can run the development server and produce JavaScript bundles. The Apple simulator/local native build requires macOS and Xcode. Signed cloud builds can use [Expo EAS](https://docs.expo.dev/build/introduction/), with your own project identity and Apple signing credentials. App Store submission and signing are separate from this UI delivery.

## Reuse the web shell

```tsx
import { AppShell } from "@/components/layout/app-shell";
import { CardGrid } from "@/components/layout/card-grid";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function ExamplePage() {
  return (
    <AppShell
      brand={<span>Your product</span>}
      title="Projects"
      items={[{ id: "projects", label: "Projects", href: "/projects" }]}
      activeId="projects"
    >
      <CardGrid>
        <Card>
          <CardHeader><CardTitle>Your first card</CardTitle></CardHeader>
          <CardContent>Add your feature here.</CardContent>
        </Card>
      </CardGrid>
    </AppShell>
  );
}
```

Navigation items use `href` for real routes or `onSelect(id)` for controlled panel switching. `activeId` marks the current destination. Pass `actions`, `sidebarFooter`, and `footerLinks` to customize the shell. Use a unique `mainId` if needed. The shell includes the skip link and safe-area footer.

`Navbar`, `Footer`, and `CardGrid` also work independently. `Sidebar` and `SidebarTrigger` require a Radix Dialog root; normally compose them through `AppShell`, which supplies state, focus handling, scroll lock, and desktop-resize cleanup.

Use `WebsiteShell` when a page needs a full-width header instead of a desktop sidebar:

```tsx
import { WebsiteShell } from "@/components/layout/website-shell";

<WebsiteShell
  brand={<span>Your product</span>}
  items={[
    { id: "features", label: "Features", href: "#features" },
    { id: "library", label: "UI library", href: "/ui" },
  ]}
  footerLinks={<a href="/ui">Component library</a>}
>
  <section id="features"><h1>Your next useful idea</h1></section>
</WebsiteShell>
```

It shares the app shell's navigation item format and accessible mobile drawer. On desktop the links appear in the header. Both shells close the drawer when navigating or crossing the desktop breakpoint; keyboard focus returns to the trigger, or to main content when the trigger becomes hidden. Long labels wrap, drawer contents scroll in short landscape viewports, and navigation controls have at least 44px touch targets.

`CardGrid` accepts `columns={1 | 2 | 3 | 4}` (default `3`), with one column on small screens. Set `columns={2}` for wider forms. `Spinner` accepts `size="sm" | "md" | "lg"`, `label`, and `decorative` for use beside an existing accessible label. `Skeleton` supplies a decorative placeholder; `CardSkeleton` composes an accessible loading card. Spinners and skeletons stop animating when reduced motion is enabled.

```tsx
import { CardSkeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

<CardGrid columns={2}>
  <CardSkeleton label="Loading project…" />
  <CardSkeleton label="Loading activity…" />
</CardGrid>
<span role="status"><Spinner size="sm" decorative /> Saving…</span>
```

| Component | Source | Behavior |
| --- | --- | --- |
| App shell | `frontend/src/components/layout/app-shell.tsx` | Desktop sidebar at 1024px+, touch drawer below; navbar, main, footer |
| Website shell | `frontend/src/components/layout/website-shell.tsx` | Full-width website header, desktop links, phone drawer, main and footer |
| Navbar | `frontend/src/components/layout/navbar.tsx` | Brand, optional menu, context and actions; wraps on narrow screens |
| Sidebar | `frontend/src/components/layout/sidebar.tsx` | Route links or panel buttons, active state, keyboard-accessible mobile drawer |
| Footer | `frontend/src/components/layout/footer.tsx` | Secondary links and safe-area spacing |
| Card grid | `frontend/src/components/layout/card-grid.tsx` | Responsive grid with configurable maximum of one to four columns |
| Cards | `frontend/src/components/ui/card.tsx` | Composable header, title, description, content, and footer |
| Spinner | `frontend/src/components/ui/spinner.tsx` | Labeled status, decorative icon, reduced-motion CSS |
| Skeletons | `frontend/src/components/ui/skeleton.tsx` | Decorative placeholders and a labeled loading card |
| Feedback | `frontend/src/components/ui/feedback.tsx` | Loading, empty, error/retry, and toast components |
| Dialog | `frontend/src/components/ui/dialog.tsx` | Focus trap, Escape, close control, and restoration to the initiating control |

## Reuse native components

Create screens under `mobile/src/app/`. Keep reusable code outside that route directory. The root supplies safe-area and navigation providers; the tab layout supplies `Navbar` and bottom navigation.

```tsx
import { Screen } from "../../components/layout";
import { Card, CardTitle, Body, Button } from "../../components/ui";

export default function ExampleScreen() {
  return (
    <Screen title="Your feature" description="A little context.">
      <Card>
        <CardTitle>Your first card</CardTitle>
        <Body>Add your content here.</Body>
        <Button label="Continue" onPress={() => { /* Your action */ }} />
      </Card>
    </Screen>
  );
}
```

`Screen` provides scrolling, maximum content width, headings, horizontal safe-area padding and the footer. `Navbar` handles the top inset; Expo's tabs handle the bottom inset. `CardGrid` measures its container and switches at 560px and 900px. Buttons have at least 44-point touch targets and disabled/busy states. Native feedback uses `ActivityIndicator`, labeled tabs, an error alert, and explicit retry/create actions. Native color tokens live in `mobile/src/theme.ts`; web tokens live in `frontend/src/app/globals.css`.

Customize `SidebarProvider` with `items: [{ id, href, label, icon? }]`, `brand`, and `footer`. Or use the controlled `Sidebar` directly with `open` and `onClose`. `Navbar` accepts `brand` and `actions`; `Footer` accepts `label` and `actions`. `Screen` accepts `eyebrow` and `footer` (pass `null` to hide either). `IconButton` supplies a compact, labeled 44-point control. The native spinner honors the system's reduced-motion preference.

## Verification

```sh
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend test
npm run check:mobile
npm --prefix frontend exec -- playwright install chromium
npm run test:ui
```

`test:ui` builds both browser targets, starts temporary loopback servers on ports 3100 and 8082, and runs Playwright. It covers desktop/phone web navigation, drawer closure, dialog focus, feedback actions, overflow, skip-link behavior, reduced motion, and automated web accessibility scans. It also exercises the native app's web-rendered screens, navigation, feedback actions, and tablet grid. Servers stop after the run. Browser dependencies may require `playwright install --with-deps chromium` on Linux.

`check:mobile` runs lint, TypeScript, and an iOS JavaScript/Hermes export. It does not compile, sign, install, or execute an Apple binary. CI performs both sets of checks via `.github/workflows/ui-checks.yml`.

For changes limited to the responsive website, run `npm --prefix frontend run test:web`. This builds Next.js and tests desktop and phone layouts without installing or exporting Expo. Playwright uses Chromium by default; `PLAYWRIGHT_CHANNEL=msedge` selects an already installed Microsoft Edge browser. Phone viewport emulation does not replace testing Safari on a physical iPhone.

Before releasing a native app, test on an iPhone/iPad: VoiceOver, Dynamic Type, safe areas, rotation, drawer dismissal, bottom navigation, and slow/disconnected real feature flows. Before exposing any real services, complete the existing Auth/database/provider gates in `DELIVERY.md`. Review `npm audit` for upstream dependency advisories; a passing UI build is not a dependency-security certification.
