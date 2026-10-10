import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const previews = [
  { path: "/ui", title: "Make the first screen count.", screenshot: "component-gallery.png" },
  { path: "/ui/workspace", title: "Projects", screenshot: "workspace-template.png" },
  {
    path: "/ui/website",
    title: "Good ideas deserve a clear starting point.",
    screenshot: "website-template.png",
  },
] as const;

async function expectNoPageOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    "Page content should fit the viewport without horizontal scrolling",
  ).toBeLessThanOrEqual(1);
}

async function expectAccessible(page: Page) {
  await page.evaluate(async () => {
    await Promise.all(
      document.getAnimations()
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
}

async function selectProjectFilter(page: Page, name: string) {
  const trigger = page.getByRole("button", { name: "Workspace navigation", exact: true });
  const mobile = await trigger.isVisible();
  if (mobile) await trigger.click();
  const filter = page.getByRole("group", { name: "Filter projects", exact: true })
    .getByRole("button", { name, exact: true });
  await filter.click();
  if (mobile) {
    await expect(page.getByRole("dialog", { name: "Workspace navigation", exact: true })).toBeHidden();
    await expect(trigger).toBeFocused();
  } else {
    await expect(filter).toHaveAttribute("aria-pressed", "true");
  }
}

for (const preview of previews) {
  test(`${preview.path} is public, accessible, and fits the screen`, async ({ page }) => {
    await page.goto(preview.path);
    await expect(page.getByRole("heading", { level: 1, name: preview.title, exact: true })).toBeVisible();
    await expect(page.getByRole("main")).toHaveCount(1);
    await expectNoPageOverflow(page);
    // Fast-forward finite entrance animations before inspecting their final colors.
    await page.screenshot({
      path: test.info().outputPath(preview.screenshot),
      fullPage: true,
      animations: "disabled",
    });
    await expectAccessible(page);
  });
}

test("gallery links open the workspace and website templates", async ({ page }) => {
  await page.goto("/ui");
  await page.getByRole("link", { name: /Explore workspace/ }).click();
  await expect(page).toHaveURL(/\/ui\/workspace$/);
  await expect(page.getByRole("heading", { level: 1, name: "Projects", exact: true })).toBeVisible();

  await page.goto("/ui");
  await page.getByRole("link", { name: /Explore website/ }).click();
  await expect(page).toHaveURL(/\/ui\/website$/);
  await page.getByRole("link", { name: "Try the workspace", exact: true }).click();
  await expect(page).toHaveURL(/\/ui\/workspace$/);
});

test("website anchor navigation brings its destination into view", async ({ page }) => {
  await page.goto("/ui/website");
  await page.getByRole("link", { name: "How it works", exact: true }).click();
  await expect(page).toHaveURL(/\/ui\/website#how-it-works$/);
  await expect(page.locator("#process-heading")).toBeInViewport();
  await expectNoPageOverflow(page);
});

test("preview dialog contains keyboard focus and returns it when dismissed", async ({ page }) => {
  await page.goto("/ui");
  const trigger = page.getByRole("button", { name: "Preview dialog", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "A useful next step", exact: true });
  await expect(dialog).toBeVisible();
  await expectAccessible(page);

  await dialog.getByRole("button", { name: "Close dialog", exact: true }).focus();
  await page.keyboard.press("Shift+Tab");
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await dialog.getByRole("button", { name: "Close dialog", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("feedback previews support loading, empty, error, and recovery", async ({ page }) => {
  await page.goto("/ui");
  const stateControls = page.getByRole("group", { name: "Preview state", exact: true });
  const preview = page.locator('[aria-label="State preview"]');
  const readyHeading = preview.getByRole("heading", { name: "Ready for the next step.", exact: true });
  await expect(readyHeading).toBeVisible();

  await stateControls.getByRole("button", { name: "Loading", exact: true }).click();
  await expect(preview.getByRole("status")).toHaveCount(1);
  await expect(preview.getByRole("status")).toHaveText("Loading project preview…");
  await expect(preview.locator('[data-slot="skeleton"]').first()).toBeVisible();
  await expectNoPageOverflow(page);

  await stateControls.getByRole("button", { name: "Empty", exact: true }).click();
  await expect(preview.getByRole("heading", { name: "A little space for something new", exact: true })).toBeVisible();
  await preview.getByRole("button", { name: "Add a project", exact: true }).click();
  await expect(readyHeading).toBeVisible();
  await expect(stateControls.getByRole("button", { name: "Ready", exact: true })).toHaveAttribute("aria-pressed", "true");

  await stateControls.getByRole("button", { name: "Error", exact: true }).click();
  await expect(preview.getByRole("alert")).toBeVisible();
  await preview.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(preview.getByRole("alert")).toHaveCount(0);
  await expect(readyHeading).toBeVisible();
  await expectNoPageOverflow(page);
});

test("workspace search, filters, and project creation work without a backend write", async ({ page }) => {
  const writeRequests: string[] = [];
  page.on("request", (request) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      writeRequests.push(`${request.method()} ${new URL(request.url()).pathname}`);
    }
  });
  await page.goto("/ui/workspace");
  const main = page.getByRole("main");
  for (const name of ["Fieldnotes", "Signal", "Atlas"]) {
    await expect(main.getByRole("heading", { name, exact: true })).toBeVisible();
  }

  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
    const navigation = page.getByRole("navigation", { name: "Workspace navigation", exact: true });
    await expect.poll(async () => (await navigation.boundingBox())?.y ?? -1).toBeGreaterThanOrEqual(0);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  }

  const search = page.getByRole("searchbox", { name: "Search projects", exact: true });
  await search.fill("Fieldnotes");
  await expect(main.getByRole("heading", { name: "Fieldnotes", exact: true })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Signal", exact: true })).toHaveCount(0);
  await expect(main.getByRole("heading", { name: "Atlas", exact: true })).toHaveCount(0);
  await search.fill("");

  await selectProjectFilter(page, "Completed");
  await expect(main.getByRole("heading", { name: "Atlas", exact: true })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Fieldnotes", exact: true })).toHaveCount(0);
  await expect(main.getByRole("heading", { name: "Signal", exact: true })).toHaveCount(0);
  await selectProjectFilter(page, "In progress");
  await expect(main.getByRole("heading", { name: "Fieldnotes", exact: true })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Signal", exact: true })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Atlas", exact: true })).toHaveCount(0);
  await selectProjectFilter(page, "All projects");
  for (const name of ["Fieldnotes", "Signal", "Atlas"]) {
    await expect(main.getByRole("heading", { name, exact: true })).toBeVisible();
  }

  await search.fill("no matching project");
  await expect(main.getByRole("heading", { name: "Nothing here just yet", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset filters", exact: true }).click();
  await expect(search).toHaveValue("");
  await expect(main.getByRole("heading", { name: "Fieldnotes", exact: true })).toBeVisible();

  const trigger = page.getByRole("button", { name: "New project", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Create a project", exact: true });
  const nameInput = dialog.getByRole("textbox", { name: "Project name", exact: true });
  await expect(nameInput).toBeFocused();
  await nameInput.fill("Browser preview project");
  await dialog.getByRole("button", { name: "Create project", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(main.getByRole("heading", { name: "Browser preview project", exact: true })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Browser preview project" })).toBeVisible();
  await page.getByRole("button", { name: "Open Browser preview project", exact: true }).click();
  const details = page.getByRole("dialog", { name: "Browser preview project", exact: true });
  await expect(details).toBeVisible();
  await details.getByRole("button", { name: "Mark complete", exact: true }).click();
  await expect(details).toBeHidden();
  await selectProjectFilter(page, "Completed");
  await expect(main.getByRole("heading", { name: "Browser preview project", exact: true })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Fieldnotes", exact: true })).toHaveCount(0);
  await expectNoPageOverflow(page);
  expect(writeRequests).toEqual([]);
});

test("signed-out users still need to log in before opening the real dashboard", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL((url) => url.pathname === "/login" && url.searchParams.get("next") === "/dashboard");
  await expect(page.getByRole("textbox", { name: "Email", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Log in", exact: true })).toBeVisible();
  await expect(page.getByRole("main")).toHaveCount(1);
});

test("navigation drawers restore focus on Escape and release the page on desktop resize", async ({ page }) => {
  for (const drawerCase of [
    { path: "/ui/website", trigger: "Open menu", title: "Main navigation" },
    { path: "/ui/workspace", trigger: "Workspace navigation", title: "Workspace navigation" },
  ]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(drawerCase.path);
    const trigger = page.getByRole("button", { name: drawerCase.trigger, exact: true });
    const drawer = page.getByRole("dialog", { name: drawerCase.title, exact: true });
    await trigger.click();
    await expect(drawer).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();

    if (drawerCase.title === "Main navigation") {
      await trigger.click();
      await drawer.getByRole("link", { name: "UI library", exact: true }).click();
      await expect(page).toHaveURL(/\/ui$/);
      await expect(drawer).toBeHidden();
      await page.goBack();
      await expect(page).toHaveURL(/\/ui\/website$/);
      await expect(drawer).toBeHidden();
    }

    await trigger.click();
    await expect(drawer).toBeVisible();
    await page.setViewportSize({ width: 568, height: 320 });
    const lastControl = drawer.locator("a[href], button").last();
    await lastControl.scrollIntoViewIfNeeded();
    await expect(lastControl).toBeInViewport();
    await expect(drawer.getByRole("button", { name: "Close navigation", exact: true })).toBeInViewport();
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(drawer).toBeHidden();
    await expect(page.getByRole("main")).toBeFocused();
    await expect(page.locator("html")).not.toHaveCSS("overflow", "hidden");
    await expectNoPageOverflow(page);
  }
});

test("skip navigation and reduced-motion loading previews remain usable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/ui");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();

  await page.getByRole("button", { name: "Loading", exact: true }).click();
  await expect(page.locator('[data-slot="spinner"]').first()).toBeVisible();
  await expect(page.locator('[data-slot="spinner"]').first()).toHaveCSS("animation-name", "none");
  await expect(page.locator('[data-slot="skeleton"]').first()).toBeVisible();
  await expect(page.locator('[data-slot="skeleton"]').first()).toHaveCSS("animation-name", "none");
  await expectNoPageOverflow(page);
});
