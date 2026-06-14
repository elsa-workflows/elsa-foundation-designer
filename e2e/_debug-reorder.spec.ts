import { test } from "@playwright/test";

test("verify Earlier/Later reorder buttons", async ({ page }) => {
  await page.goto(
    "/workflows/definitions/e74fe49f-113c-4229-8b0e-8655d46b0815/edit",
  );
  await page.locator(".react-flow").first().waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(2000);

  // Without selection, the buttons shouldn't appear.
  const earlierBefore = await page
    .getByRole("button", { name: /move activity earlier/i })
    .count();
  console.log("EARLIER_BEFORE_SELECT (expect 0):", earlierBefore);

  // Click the first node to select it.
  const firstNode = page.locator(".react-flow__node").first();
  await firstNode.click({ force: true });
  await page.waitForTimeout(500);

  const earlierAfter = await page
    .getByRole("button", { name: /move activity earlier/i })
    .count();
  const laterAfter = await page
    .getByRole("button", { name: /move activity later/i })
    .count();
  console.log("EARLIER_AFTER_SELECT (expect 1):", earlierAfter);
  console.log("LATER_AFTER_SELECT (expect 1):", laterAfter);

  // The first node has nothing earlier — Earlier should be disabled.
  const earlierDisabled = await page
    .getByRole("button", { name: /move activity earlier/i })
    .first()
    .isDisabled();
  console.log("EARLIER_DISABLED_FOR_FIRST (expect true):", earlierDisabled);
});
