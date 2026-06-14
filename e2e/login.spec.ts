import { expect, test } from "@playwright/test";

// All tests in this file run unauthenticated. Override the storageState the
// chromium project loads by default so /dashboard requires a real login.
test.use({ storageState: { cookies: [], origins: [] } });

test("redirects unauthenticated user from /dashboard to /login with next=", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await page.waitForURL(/\/login\?next=/);
  await expect(
    page.getByRole("heading", { name: /sign in to elsa studio/i }),
  ).toBeVisible();
});

test("rejects bad credentials and stays on /login", async ({ page }) => {
  await page.goto("/login");
  await page.locator("#username").fill("not-a-real-user");
  await page.locator("#password").fill("not-a-real-password");
  await page.getByRole("button", { name: /sign in/i }).click();

  // sonner renders the error as a toast region; assert via role=status.
  await expect(page.getByRole("status").first()).toBeVisible({
    timeout: 10_000,
  });
  await expect(page).toHaveURL(/\/login\b/);
});

test("logs in successfully with valid credentials", async ({ page }) => {
  const username = process.env.E2E_USERNAME;
  const password = process.env.E2E_PASSWORD;
  test.skip(
    !username || !password,
    "E2E_USERNAME and E2E_PASSWORD must be set in .env.test.local",
  );

  await page.goto("/login");
  await page.locator("#username").fill(username!);
  await page.locator("#password").fill(password!);
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.waitForURL("**/dashboard");
  await expect(
    page.getByRole("heading", { name: "Dashboard", level: 1 }),
  ).toBeVisible();
});
