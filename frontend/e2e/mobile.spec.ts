import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
});

test("native component gallery renders and navigates from its hero", async ({
  page,
}) => {
  await expect(
    page.getByText("A head start for your next idea."),
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("overview.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Explore the layouts" }).click();
  await expect(page.getByText("Layout shells", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("native navigation drawer closes when selecting a route", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("button", { name: "Close navigation" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Card containers", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Close navigation" }),
  ).toBeHidden();
  await expect(
    page.getByText("Card containers", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Nothing here yet")).toBeVisible();
});

test("native feedback examples switch states and retry", async ({ page }) => {
  await page.getByRole("tab", { name: "States", exact: true }).click();
  await expect(page.getByText("A fresh start")).toBeVisible();
  await page.getByRole("button", { name: "Preview create" }).click();
  await expect(
    page.getByText("The ready-state preview is showing."),
  ).toBeVisible();
  await page.getByRole("tab", { name: "error", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByText("The ready-state preview is showing."),
  ).toBeVisible();
  await page.getByRole("tab", { name: "loading", exact: true }).click();
  await expect(
    page.getByRole("progressbar", { name: "Loading preview…" }),
  ).toBeVisible();
});

test("native cards adapt to a tablet width", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/cards", { waitUntil: "domcontentloaded" });
  const first = await page
    .getByText("Start with something useful.")
    .boundingBox();
  const second = await page.getByText("A softer starting point").boundingBox();
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  expect(second!.x).toBeGreaterThan(first!.x);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("native navigation remains usable on a small phone and tab labels are visible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  for (const name of ["Overview", "Layouts", "Cards", "States"]) {
    const label = page
      .getByRole("tab", { name, exact: true })
      .getByText(name, { exact: true });
    await expect(label).toBeVisible();
    const bounds = await label.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(640);
  }
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Close navigation" }).click();
  await expect(
    page.getByRole("button", { name: "Close navigation" }),
  ).toBeHidden();
});
