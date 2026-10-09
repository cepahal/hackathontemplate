# Native mobile UI starter

The existing Expo Router + TypeScript + React Native app provides a navbar, drawer/sidebar, bottom tabs, footer, responsive cards, buttons, badges, spinners, and feedback states. Its overview, layouts, cards, and states screens use local examples without credentials. The canonical Next.js website is a separate app in `finalfrontentbackend/frontendFINAL/`.

## Install and run

From the repository root:

```sh
cd mobile
npm ci
npm start
```

On Windows, use `npm.cmd` if PowerShell blocks npm's `.ps1` launcher. To open it on an iPhone, use an Expo Go version compatible with the SDK in this app's `package.json`, put the computer and phone on the same Wi-Fi, and scan the development server's QR code. The default development command uses LAN access so the phone can connect; stop it with Ctrl+C.

For the native app's localhost browser preview, run from `mobile/`:

```sh
npm run web
```

Install this app independently of the website. It retains its own lockfile and Expo-compatible React/React Native versions. Website and backend setup are documented in [the canonical setup guide](../finalfrontentbackend/docs/SETUP.md).

## Files to edit

- `src/app/(tabs)/`: overview, layouts, cards, and states screens plus bottom navigation.
- `src/app/_layout.tsx`: safe-area provider, navigation provider, root stack, and status bar.
- `src/components/layout.tsx`: shared navbar, sidebar provider, screen shell, and footer.
- `src/components/ui.tsx`: cards/grid, buttons, badges, loading, and feedback states.
- `src/theme.ts`: native colors, spacing, and radii.
- `app.json`: app identity, platform options, and Expo plugins.

Create a route such as `src/app/(tabs)/example.tsx` using the existing components:

```tsx
import { Screen } from "../../components/layout";
import { Card, CardTitle, Body } from "../../components/ui";

export default function ExampleScreen() {
  return (
    <Screen title="Your feature" description="A little context.">
      <Card>
        <CardTitle>Your first card</CardTitle>
        <Body>Add your feature content here.</Body>
      </Card>
    </Screen>
  );
}
```

`Screen` supplies scrolling, content width, headings, horizontal safe-area padding, and the footer. The root/tab layouts supply top navigation and bottom tabs. Reuse native components here rather than importing web DOM components. Backend authentication and real business flows require their own integration work.

## Checks

Run these commands in `mobile/`:

```sh
npm run lint
npm run typecheck
npm run export:web
npm run export:ios
npx expo-doctor
```

The [UI workflow](../.github/workflows/ui-checks.yml) runs native lint, types, and both exports in a separate job from the canonical website's browser suite. The website suite does not exercise this native app.

The iOS export emits a JavaScript/Hermes bundle under `.artifacts/ios/`; it does not produce a signed `.ipa` or run an Apple simulator/device. Local Apple builds require macOS and Xcode. Physical iPhone/iPad behavior, VoiceOver, Dynamic Type, safe areas, rotation, signing, and distribution remain separate acceptance steps. An Expo web preview is useful for layout checks but does not establish native runtime behavior.

See the [canonical UI guide](../finalfrontentbackend/docs/UI_LIBRARY.md) for web component contracts and verification boundaries, and the [UI verification record](../finalfrontentbackend/docs/UI_VERIFICATION.md) for recorded checks and remaining acceptance steps.
