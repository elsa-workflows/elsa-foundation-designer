import { expect, test } from "@playwright/test";

test("opens the first workflow definition and mounts the xyflow canvas", async ({
  page,
}) => {
  await page.goto("/workflows/definitions");
  await expect(
    page.getByRole("heading", { name: "Workflow Definitions", level: 1 }),
  ).toBeVisible();

  // Rows render a Link to /workflows/definitions/<id>/edit on the name cell.
  // Skip cleanly when the seeded backend has zero definitions rather than
  // failing — this suite shouldn't require fixture data.
  const editLink = page
    .locator('a[href^="/workflows/definitions/"][href$="/edit"]')
    .first();
  await editLink.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
  if (!(await editLink.count())) {
    test.skip(true, "No workflow definitions on this server — nothing to open.");
    return;
  }

  await editLink.click();
  await page.waitForURL(/\/workflows\/definitions\/[^/]+\/edit\b/);

  // xyflow renders a stable `.react-flow` container; no testid needed.
  await expect(page.locator(".react-flow").first()).toBeVisible({
    timeout: 15_000,
  });

  // The editor exposes Designer / Code / Properties tabs.
  await expect(page.getByRole("tab", { name: "Designer" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Code" })).toBeVisible();
});
