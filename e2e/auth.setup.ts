import { test as setup, expect } from "@playwright/test";

const authFile = "playwright/.auth/user.json";

setup("authenticate", async ({ page }) => {
  const username = process.env.E2E_USERNAME;
  const password = process.env.E2E_PASSWORD;
  if (!username || !password) {
    throw new Error(
      "E2E_USERNAME and E2E_PASSWORD must be set (see .env.test.example).",
    );
  }

  await page.goto("/login");
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();

  // useLogin pushes to /dashboard on success — wait for the URL and the
  // dashboard heading before persisting storage state.
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  await expect(
    page.getByRole("heading", { name: "Dashboard", level: 1 }),
  ).toBeVisible();

  await page.context().storageState({ path: authFile });
});
