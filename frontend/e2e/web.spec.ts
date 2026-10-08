import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function navigate(page: Page, label: string) {
  const menu = page.getByRole("button", { name: "Open navigation" });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("button", { name: label, exact: true })
    .click();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/ui", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".enter")).toHaveCSS("animation-name", "enter");
  // Scan the final colors, rather than a partially transparent entry animation.
  await page.locator(".enter").evaluate(async (element) => {
    await Promise.all(
      element.getAnimations().map((animation) => animation.finished),
    );
  });
});

test("gallery needs no credentials, fits the screen, and passes accessibility checks", async ({
  page,
}) => {
  await expect(
    page.getByRole("heading", { name: "A head start for your next idea." }),
  ).toBeVisible();
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("overview.png"),
    fullPage: true,
    animations: "disabled",
  });
});

test("navigation chooses a section and phone drawer restores focus on Escape", async ({
  page,
}) => {
  const trigger = page.getByRole("button", { name: "Open navigation" });
  if (await trigger.isVisible()) {
    await trigger.click();
    await expect(
      page.getByRole("dialog", { name: "Workspace navigation" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "Workspace navigation" }),
    ).toBeHidden();
    await expect(trigger).toBeFocused();
  }
  await navigate(page, "Card containers");
  await expect(
    page.getByRole("heading", { name: "Card containers", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Workspace navigation" }),
  ).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("card action opens an accessible dialog and returns keyboard focus", async ({
  page,
}) => {
  await navigate(page, "Card containers");
  const trigger = page.getByRole("button", { name: "Preview an action" });
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "Room for your next action",
  });
  await expect(dialog).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("feedback preview supports empty, create, error, retry, and loading states", async ({
  page,
}) => {
  await navigate(page, "Feedback states");
  await expect(
    page.getByRole("heading", { name: "A fresh start" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Preview create" }).click();
  await expect(
    page.getByText("The ready-state preview is showing."),
  ).toBeVisible();
  await page.getByRole("tab", { name: "error", exact: true }).click();
  await expect(
    page.getByRole("tabpanel", { name: "error" }).getByRole("alert"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByText("The ready-state preview is showing."),
  ).toBeVisible();
  await page.getByRole("tab", { name: "loading", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Loading preview…" }),
  ).toBeVisible();
});

test("skip link and reduced-motion preference remain usable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  const duration = await page
    .locator(".enter")
    .evaluate((element) => getComputedStyle(element).animationDuration);
  expect(parseFloat(duration)).toBeLessThan(0.01);
});

test("welcome page exposes the UI library without signing in", async ({
  page,
}) => {
  await page.goto("/welcome");
  await page.getByRole("link", { name: "UI library" }).click();
  await expect(
    page.getByRole("heading", { name: "A head start for your next idea." }),
  ).toBeVisible();
});
