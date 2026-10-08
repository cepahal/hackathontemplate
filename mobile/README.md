# Native mobile UI starter

Expo Router + TypeScript + React Native, matching the website's Launchpad design. Includes a navigation bar, drawer/sidebar, bottom tabs, footer, responsive card grid, buttons, badges, loading spinners and feedback states. Overview, layouts, cards and states screens all work without credentials.

From the repository root:

```sh
npm run setup:mobile
npm run dev:mobile
```

On Windows, use `npm.cmd` if PowerShell blocks npm's `.ps1` launcher. Open the terminal QR code in a compatible Expo Go app on your iPhone; both devices must share Wi-Fi. The development server uses LAN so the phone can connect. `npm --prefix mobile run web` instead opens a localhost browser preview.

Root `npm run setup` continues to install the website and backend. Mobile is installed explicitly with `setup:mobile`. Mobile has its own lockfile because its React version must match Expo's SDK, while the website retains its existing Next.js versions.

## Files to edit

- `src/app/(tabs)/`: the four demo screens and bottom navigation.
- `src/app/_layout.tsx`: safe-area provider, navigation provider, root stack and status bar.
- `src/components/layout.tsx`: reusable navbar, sidebar provider, screen shell and footer.
- `src/components/ui.tsx`: cards/grid, buttons, badges and feedback states.
- `src/theme.ts`: semantic colors, spacing and radii.
- `app.json`: display name, URL scheme, platform options and Expo plugins. Replace template icons and choose your bundle identifier before distribution.

## Checks

```sh
npm run lint
npm run typecheck
npm run export:web
npm run export:ios
npx expo-doctor
```

The iOS export checks bundling and emits a Hermes bundle under `.artifacts/ios/`. It is not an `.ipa` or simulator run. Local Apple builds require a Mac; [EAS cloud builds](https://docs.expo.dev/build/introduction/) support building from Windows with appropriate Expo/Apple project configuration. Native device acceptance and signing remain release steps.

See [UI library guide](../docs/UI_LIBRARY.md) for usage examples, component contracts, browser tests, and acceptance boundaries. This app demonstrates UI patterns; backend authentication and business flows belong in subsequent feature work.
