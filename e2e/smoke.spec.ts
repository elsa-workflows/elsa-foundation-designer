import { expect, test } from "@playwright/test";

const PAGES = [
  { path: "/dashboard", heading: "Dashboard" },
  { path: "/workflows/definitions", heading: "Workflow Definitions" },
  { path: "/workflows/instances", heading: "Workflow Instances" },
] as const;

for (const { path, heading } of PAGES) {
  test(`smoke: ${path} renders without page errors`, async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: heading, level: 1 }),
    ).toBeVisible();

    expect(
      pageErrors,
      `Uncaught page errors on ${path}:\n${pageErrors.map((e) => e.message).join("\n")}`,
    ).toEqual([]);
  });
}
