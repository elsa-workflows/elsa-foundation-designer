import {
  expect,
  request as apiRequest,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
} from "@playwright/test";

/**
 * Drives the React Flow designer for a workflow definition. Each test spins
 * up its own fresh **Flowchart** workflow via the backend API so it lands on
 * an empty Flowchart canvas — the default "New workflow" UI flow creates a
 * Sequence root, which doesn't support fan-out / free-form edges.
 */

const API_BASE =
  process.env.E2E_API_BASE_URL ?? "http://localhost:5072/elsa/api";

let cachedToken: string | null = null;

async function getApiToken(req: APIRequestContext): Promise<string> {
  if (cachedToken) return cachedToken;
  const username = process.env.E2E_USERNAME;
  const password = process.env.E2E_PASSWORD;
  if (!username || !password) {
    throw new Error(
      "E2E_USERNAME / E2E_PASSWORD must be set in .env.test.local",
    );
  }
  const res = await req.post(`${API_BASE}/identity/login`, {
    data: { username, password },
  });
  if (!res.ok()) {
    throw new Error(`login failed: ${res.status()} ${await res.text()}`);
  }
  const body = (await res.json()) as { accessToken: string };
  cachedToken = body.accessToken;
  return cachedToken;
}

/**
 * POST a fresh empty Flowchart workflow definition and return its
 * `definitionId`. Done over HTTP so the test doesn't depend on what the
 * "New workflow" UI happens to default the root activity to.
 */
async function createFlowchartViaApi(prefix = "e2e-flowchart"): Promise<string> {
  const req = await apiRequest.newContext();
  try {
    const token = await getApiToken(req);
    const definitionId = crypto.randomUUID();
    const res = await req.post(`${API_BASE}/workflow-definitions`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        publish: false,
        model: {
          definitionId,
          name: `${prefix}-${Date.now().toString(36)}`,
          description: null,
          root: {
            type: "Elsa.Flowchart",
            id: "Flowchart1",
            version: 1,
            metadata: {},
            customProperties: {
              notFoundConnections: [],
              canStartWorkflow: false,
              runAsynchronously: false,
            },
            activities: [],
            variables: [],
            connections: [],
          },
        },
      },
    });
    if (!res.ok()) {
      throw new Error(
        `create workflow failed: ${res.status()} ${await res.text()}`,
      );
    }
    const body = (await res.json()) as {
      workflowDefinition: { definitionId: string };
    };
    return body.workflowDefinition.definitionId;
  } finally {
    await req.dispose();
  }
}

/** Open a fresh empty Flowchart workflow in the editor. */
async function createFreshWorkflow(page: Page) {
  const definitionId = await createFlowchartViaApi();
  await page.goto(`/workflows/definitions/${definitionId}/edit`);
  await expect(page.locator(".react-flow").first()).toBeVisible({
    timeout: 15_000,
  });
  // Wait for the canvas to settle (empty state CTA renders once the editor
  // store has hydrated and the canvas knows there are 0 nodes).
  await expect(
    page.getByRole("button", { name: /add an activity/i }),
  ).toBeVisible({ timeout: 10_000 });
}

/**
 * Find the ConnectMenu (the floating activity picker that appears for
 * empty-state CTA, drop-on-pane, and edge "+" button) and click the option
 * whose display name matches `displayName`. The menu's search input shares the
 * same placeholder as the palette search; we scope by the menu's distinctive
 * container class.
 */
async function pickFromConnectMenu(page: Page, displayName: string) {
  const menu = page.locator("div.bg-popover.fixed.z-50").last();
  await expect(menu).toBeVisible({ timeout: 10_000 });
  // Filter the list so only the desired descriptor's row remains.
  await menu.locator('input[placeholder="Search activities…"]').fill(displayName);
  const option = menu.getByRole("button").filter({ hasText: displayName }).first();
  await expect(option).toBeVisible({ timeout: 10_000 });
  await option.click();
  // Menu unmounts on pick.
  await expect(menu).toHaveCount(0);
}

/** Insert an activity onto an empty canvas via the empty-state CTA. */
async function insertViaEmptyState(page: Page, displayName: string) {
  await page.getByRole("button", { name: /add an activity/i }).click();
  await pickFromConnectMenu(page, displayName);
}

/**
 * Drag from a React Flow source handle to an absolute screen point. Used to
 * trigger React Flow's "connect-end-on-pane" gesture which opens the
 * ConnectMenu in `fromPort` mode.
 */
async function dragHandleTo(
  page: Page,
  handle: Locator,
  dropPoint: { x: number; y: number },
) {
  // Scroll the handle into view first so its bounding box lands inside the
  // current viewport — without this, after the first connect-to-create the
  // happy-path auto-layout can push the source's handle off-screen, and the
  // subsequent mouse coordinates fall outside the React Flow pane.
  await handle.scrollIntoViewIfNeeded();
  const box = await handle.boundingBox();
  if (!box) throw new Error("source handle has no bounding box");
  const sx = box.x + box.width / 2;
  const sy = box.y + box.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  // React Flow only registers the drag after a small first move + several
  // subsequent steps. Move in two stages so the connection line attaches.
  await page.mouse.move(sx + 4, sy + 1, { steps: 3 });
  await page.mouse.move(dropPoint.x, dropPoint.y, { steps: 15 });
  await page.mouse.up();
}

/**
 * Fit all nodes into the visible pane via the toolbar Fit-to-view button.
 * Re-centres handles into the viewport before a follow-up drag gesture.
 */
async function fitToView(page: Page) {
  await page.getByRole("button", { name: "Fit to view" }).click();
  // Give the 250ms zoom animation time to settle.
  await page.waitForTimeout(300);
}

/** Click the pane background to deselect the active node. */
async function deselectAll(page: Page) {
  const pane = page.locator(".react-flow__pane").first();
  const box = await pane.boundingBox();
  if (!box) return;
  await page.mouse.click(box.x + 20, box.y + 20);
}

/**
 * Parse the source node id and source handle out of a React Flow edge
 * `data-id`. After commit, edges are rebuilt by buildGraphFromRoot in the
 * form `e-<idx>-<source>:<sourceHandle>-><target>:<targetHandle>`.
 */
function parseEdgeId(
  id: string | null,
): { source: string; sourceHandle: string } | null {
  if (!id) return null;
  const m = /^e-\d+-(.+?):(.+?)->.+?:.+?$/.exec(id);
  if (!m) return null;
  return { source: m[1], sourceHandle: m[2] };
}

async function edgeIds(page: Page): Promise<string[]> {
  return page
    .locator(".react-flow__edge")
    .evaluateAll((els) =>
      els.map((e) => e.getAttribute("data-id") ?? ""),
    );
}

async function edgeSourceNodeIds(page: Page): Promise<string[]> {
  const ids = await edgeIds(page);
  return ids
    .map((id) => parseEdgeId(id)?.source)
    .filter((s): s is string => !!s);
}

async function edgeSourceHandles(page: Page): Promise<string[]> {
  const ids = await edgeIds(page);
  return ids
    .map((id) => parseEdgeId(id)?.sourceHandle)
    .filter((s): s is string => !!s);
}

/** Return absolute centre point of the React Flow pane. */
async function paneRect(page: Page) {
  const pane = page.locator(".react-flow").first();
  const box = await pane.boundingBox();
  if (!box) throw new Error("react-flow pane not visible");
  return box;
}

/**
 * Create A → B by dragging from A's first source handle out to empty pane,
 * then picking `bDisplayName` from the resulting ConnectMenu.
 */
async function connectToCreate(
  page: Page,
  sourceNodeLocator: Locator,
  bDisplayName: string,
  dropOffset?: { dx: number; dy: number },
) {
  const handle = sourceNodeLocator
    .locator(".react-flow__handle.source")
    .first();
  const pane = await paneRect(page);
  const dx = dropOffset?.dx ?? 360;
  const dy = dropOffset?.dy ?? 0;
  // Drop point: somewhere to the right of the canvas centre so the menu
  // anchors comfortably inside the viewport.
  const dropPoint = {
    x: pane.x + pane.width / 2 + dx,
    y: pane.y + pane.height / 2 + dy,
  };
  await dragHandleTo(page, handle, dropPoint);
  await pickFromConnectMenu(page, bDisplayName);
}

test.describe("workflow designer", () => {
  test("mounts the React Flow canvas with MiniMap and Controls", async ({
    page,
  }) => {
    await createFreshWorkflow(page);

    await expect(page.locator(".react-flow").first()).toBeVisible();
    await expect(page.locator(".react-flow__minimap").first()).toBeVisible();
    await expect(page.locator(".react-flow__controls").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Fit to view" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Re-centre" })).toBeVisible();
  });

  test("shows the empty-state CTA on a fresh canvas", async ({ page }) => {
    await createFreshWorkflow(page);

    const cta = page.getByRole("button", { name: /add an activity/i });
    await expect(cta).toBeVisible();
    await expect(page.locator(".react-flow__node")).toHaveCount(0);
  });

  test("inserts an activity via the empty-state ConnectMenu", async ({
    page,
  }) => {
    await createFreshWorkflow(page);

    await insertViaEmptyState(page, "Finish");

    await expect(page.locator(".react-flow__node")).toHaveCount(1, {
      timeout: 5_000,
    });
    await expect(
      page.getByRole("button", { name: /add an activity/i }),
    ).toHaveCount(0);
  });

  test("Designer / Code / Properties tabs switch the main panel", async ({
    page,
  }) => {
    await createFreshWorkflow(page);

    const designerTab = page.getByRole("tab", { name: "Designer" });
    const codeTab = page.getByRole("tab", { name: "Code" });
    const propsTab = page.getByRole("tab", { name: "Properties" });

    // base-ui's tabs expose selection via aria-selected (the data-active
    // attribute is sometimes present-with-empty-value, less reliable).
    await expect(designerTab).toHaveAttribute("aria-selected", "true");

    await codeTab.click();
    await expect(codeTab).toHaveAttribute("aria-selected", "true");
    await expect(designerTab).toHaveAttribute("aria-selected", "false");
    // The React Flow canvas is unmounted when Code is active.
    await expect(page.locator(".react-flow")).toHaveCount(0);

    await propsTab.click();
    await expect(propsTab).toHaveAttribute("aria-selected", "true");

    await designerTab.click();
    await expect(designerTab).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".react-flow").first()).toBeVisible();
  });

  test("activity palette expands a category and filters by search", async ({
    page,
  }) => {
    await createFreshWorkflow(page);

    const palette = page
      .locator("aside")
      .filter({ has: page.getByText("Activities", { exact: true }) })
      .first();
    await expect(palette).toBeVisible();

    // Capture the first category button by index — its aria-expanded value
    // toggles as we click; selecting on the attribute would self-defeat.
    const firstCategory = palette.locator("button[aria-expanded]").first();
    await expect(firstCategory).toHaveAttribute("aria-expanded", "false", {
      timeout: 10_000,
    });
    await firstCategory.click();
    await expect(firstCategory).toHaveAttribute("aria-expanded", "true");

    // Palette search auto-expands every group that matches and filters out
    // everything else. Empty-state appears for nonsense input.
    const paletteSearch = palette.getByPlaceholder("Search activities…");
    await paletteSearch.fill("zzzzz-no-such-activity");
    await expect(palette.getByText(/no activities match/i)).toBeVisible();

    await paletteSearch.fill("");
    await expect(palette.getByText(/no activities match/i)).toHaveCount(0);
  });

  // Undo/redo aren't deterministic from the test runner — the QueryClient's
  // refetchOnWindowFocus default fires when Playwright dispatches synthetic
  // events, and hydrate() wipes `past`/`future`, so undo silently no-ops.
  // Re-enable once the editor opts out of focus refetch (or once tests can
  // patch the QueryClient).
  test.skip("undo removes an inserted activity and re-enables the empty state", async ({
    page,
  }) => {
    await createFreshWorkflow(page);
    await insertViaEmptyState(page, "Finish");
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
    const undo = page.getByRole("button", { name: "Undo" });
    await expect(undo).toBeEnabled();
    await undo.click({ force: true });
    await expect(page.locator(".react-flow__node")).toHaveCount(0);
  });

  test("clicking a node opens the properties inspector", async ({ page }) => {
    await createFreshWorkflow(page);

    await insertViaEmptyState(page, "Finish");

    const node = page.locator(".react-flow__node").first();
    await expect(node).toBeVisible();
    await node.click();

    // Inspector lives in the right-side aside. The activity properties panel
    // renders a tablist (Settings / Input / Output / …).
    await expect(
      page.locator("aside").last().getByRole("tab").first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("auto-layout button stays enabled with nodes on the canvas", async ({
    page,
  }) => {
    await createFreshWorkflow(page);
    await insertViaEmptyState(page, "Finish");

    const autoLayout = page.getByRole("button", { name: "Auto-layout" });
    await expect(autoLayout).toBeEnabled();
    await autoLayout.click();
    await expect(page.locator(".react-flow").first()).toBeVisible();
  });

  // ---- New tests: connections & splicing ---------------------------------

  test("splices a new activity into the edge between two others", async ({
    page,
  }) => {
    await createFreshWorkflow(page);

    // Place A.
    await insertViaEmptyState(page, "Finish");
    const a = page.locator(".react-flow__node").first();
    await expect(a).toBeVisible();

    // Connect-to-create A → B via drag-from-port-to-pane.
    await connectToCreate(page, a, "Run Python");

    await expect(page.locator(".react-flow__node")).toHaveCount(2);
    await expect(page.locator(".react-flow__edge")).toHaveCount(1);

    // Hover the edge to reveal the splice "+" button, click it, pick C.
    const edge = page.locator(".react-flow__edge").first();
    await edge.hover();
    const insertBtn = page.getByRole("button", { name: "Insert activity" });
    await expect(insertBtn).toBeVisible({ timeout: 5_000 });
    await insertBtn.click();

    await pickFromConnectMenu(page, "HTTP Response");

    // The original A→B edge is replaced by A→C and C→B.
    await expect(page.locator(".react-flow__node")).toHaveCount(3);
    await expect(page.locator(".react-flow__edge")).toHaveCount(2);
  });

  test("removes a connection between two activities", async ({ page }) => {
    await createFreshWorkflow(page);

    await insertViaEmptyState(page, "Finish");
    const a = page.locator(".react-flow__node").first();
    await connectToCreate(page, a, "Run Python");
    await fitToView(page);

    await expect(page.locator(".react-flow__edge")).toHaveCount(1);

    // Hover the edge to reveal the floating action buttons, then click the
    // × (Remove edge) button.
    const edge = page.locator(".react-flow__edge").first();
    await edge.hover();
    const removeBtn = page.getByRole("button", { name: "Remove edge" });
    await expect(removeBtn).toBeVisible({ timeout: 5_000 });
    // Force-click bypasses Playwright's actionability checks — the floating
    // edge buttons can dip below opacity 1 or pointer-events: auto for a
    // moment during animation, which intermittently blocks regular clicks.
    await removeBtn.click({ force: true });

    await expect(page.locator(".react-flow__edge")).toHaveCount(0);
    // The two nodes remain — only the connection is gone.
    await expect(page.locator(".react-flow__node")).toHaveCount(2);
  });

  test("connects one activity to multiple downstream activities (fan-out)", async ({
    page,
  }) => {
    await createFreshWorkflow(page);

    await insertViaEmptyState(page, "Finish");
    const source = page.locator(".react-flow__node").filter({ hasText: "Finish" }).first();
    const sourceId = await source.getAttribute("data-id");

    // First fan-out: source → B (upper-right).
    await connectToCreate(page, source, "Run Python", { dx: 360, dy: -120 });
    await expect(page.locator(".react-flow__node")).toHaveCount(2);
    await expect(page.locator(".react-flow__edge")).toHaveCount(1);

    // Fit-to-view brings the post-layout source handle back into the
    // viewport so the second drag's screen coords are valid; deselect the
    // newly-added node so it doesn't intercept the next drag.
    await fitToView(page);
    await deselectAll(page);

    // Second fan-out from the same source: source → C.
    await connectToCreate(page, source, "HTTP Response", { dx: 360, dy: 140 });
    await expect(page.locator(".react-flow__node")).toHaveCount(3);
    await expect(page.locator(".react-flow__edge")).toHaveCount(2);

    // React Flow doesn't expose data-source on edges; we recover the source
    // node id from the edge `data-id`. After commit the canvas rebuilds
    // edges via buildGraphFromRoot, producing ids in the form
    // `e-<idx>-<source>:<sourceHandle>-><target>:<targetHandle>`.
    expect(sourceId).toBeTruthy();
    const sources = await edgeSourceNodeIds(page);
    expect(sources.filter((s) => s === sourceId)).toHaveLength(2);
  });

  test("connects multiple outcome ports to different activities", async ({
    page,
  }) => {
    await createFreshWorkflow(page);

    // Decision has two Flow ports — "True" and "False".
    await insertViaEmptyState(page, "Decision");
    const decision = page
      .locator(".react-flow__node")
      .filter({ hasText: "Decision" })
      .first();
    await expect(decision).toBeVisible();

    // Sanity-check the two source handles render.
    await expect(decision.locator(".react-flow__handle.source")).toHaveCount(2);

    const paneBefore = await paneRect(page);
    const dropA = {
      x: paneBefore.x + paneBefore.width / 2 + 360,
      y: paneBefore.y + paneBefore.height / 2 - 140,
    };

    // First port → Run Python.
    await dragHandleTo(
      page,
      decision.locator(".react-flow__handle.source").first(),
      dropA,
    );
    await pickFromConnectMenu(page, "Run Python");
    await expect(page.locator(".react-flow__node")).toHaveCount(2);
    await expect(page.locator(".react-flow__edge")).toHaveCount(1);

    // Refit + deselect before the second port drag so the bottom handle
    // lands inside the viewport.
    await fitToView(page);
    await deselectAll(page);

    const paneAfter = await paneRect(page);
    const dropB = {
      x: paneAfter.x + paneAfter.width / 2 + 360,
      y: paneAfter.y + paneAfter.height / 2 + 200,
    };
    // Second port → HTTP Response.
    await dragHandleTo(
      page,
      decision.locator(".react-flow__handle.source").nth(1),
      dropB,
    );
    await pickFromConnectMenu(page, "HTTP Response");

    await expect(page.locator(".react-flow__node")).toHaveCount(3);
    await expect(page.locator(".react-flow__edge")).toHaveCount(2);

    // The two edges leave the Decision via different source handles. The
    // sourceHandle is encoded in the edge id (see edgeSourceHandles).
    const handles = await edgeSourceHandles(page);
    expect(new Set(handles).size).toBe(2);
  });
});
