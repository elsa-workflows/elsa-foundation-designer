import { expect, test } from "@playwright/test";

test("time-range filter writes and clears the ts URL param", async ({
  page,
}) => {
  await page.goto("/workflows/instances");
  await expect(
    page.getByRole("heading", { name: "Workflow Instances", level: 1 }),
  ).toBeVisible();

  const trigger = page.getByTestId("time-range-filter-trigger");
  await expect(trigger).toContainText("Any time");

  // Open the popover and add the default row (CreatedAt / ≥ / now). This
  // alone is enough to populate the `ts` URL param via the instances-table
  // effect that mirrors filters into the URL.
  await trigger.click();
  await page.getByRole("button", { name: /add filter/i }).click();
  await expect(page.getByRole("button", { name: /clear all/i })).toBeVisible();
  await page.keyboard.press("Escape");

  await expect
    .poll(() => new URL(page.url()).searchParams.get("ts"))
    .not.toBeNull();

  // Trigger text should reflect the new row (no longer "Any time").
  await expect(trigger).not.toContainText("Any time");

  // Reopen, clear all, confirm the param disappears.
  await trigger.click();
  await page.getByRole("button", { name: /clear all/i }).click();
  await page.keyboard.press("Escape");

  await expect
    .poll(() => new URL(page.url()).searchParams.get("ts"))
    .toBeNull();
  await expect(trigger).toContainText("Any time");
});
