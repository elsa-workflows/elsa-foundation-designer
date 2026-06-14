# Module development guide

Everything you need to **add** or **extend** a studio module, fast. The studio
shell builds its sidebar, command palette, breadcrumbs, route guard and the
**Settings → Modules** toggles from a list of module manifests. Get the manifest
and its touchpoints right and the rest is wired for you.

> Source of truth for the contract: `lib/modules/types.ts`. If this doc and the
> type ever disagree, the type wins — update this doc.

---

## The module contract

A module is a single `StudioModule` object (`lib/modules/types.ts`):

| Field | Required | What it does |
|---|---|---|
| `id` | ✅ | Stable kebab-case id. Used in the modules cookie and as a cross-ref. **Must match** the `id` in `route-manifest.ts`. |
| `title` | ✅ | Raw label used when no i18n key resolves. |
| `i18nKey` | – | next-intl key, e.g. `"modules.inventory.title"`. Falls back to `title`. |
| `description` | – | Shown on the Settings → Modules toggle card. |
| `navGroup` | ✅ | Sidebar group heading, e.g. `"General"` or `"Settings"`. |
| `nav` | ✅ | The sidebar entry — a **leaf** (single link) or a **parent** (group with `items`). See below. |
| `tint` | – | Icon-tile colour (`bg`/`fg`/`glow` Tailwind classes). |
| `ownedPaths` | ✅ | Route prefixes this module owns. Middleware blocks these when disabled. |
| `required` | – | `true` ⇒ cannot be disabled in Settings. |
| `defaultEnabled` | – | Initial state when no cookie preference exists (defaults to `true`). |

### Nav: leaf vs parent

**Leaf** — one sidebar link (`ModuleNavLeaf`):

```ts
nav: { title: "Inventory", href: "/inventory", icon: Boxes }
```

Add `placeholder: true` to render it as "coming soon" styling while the feature
is unported.

**Parent** — a collapsible group with children (`ModuleNavParent`):

```ts
nav: {
  title: "Inventory",
  icon: Boxes,
  basePath: "/inventory",
  items: [
    { title: "Assets", href: "/inventory/assets", icon: Boxes },
    { title: "Locations", href: "/inventory/locations", icon: MapPin },
  ],
}
```

Icons come from `lucide-react`.

---

## Add a new module — the 5 touchpoints

Adding a module means touching **five** places. Miss one and you get a dev-time
throw (registry/manifest drift) or a dead route. Order matters only for #2↔#3
which the drift check enforces.

Worked example: an `inventory` module.

### 1. Manifest — `features/inventory/module.ts`

```ts
import { Boxes } from "lucide-react";
import type { StudioModule } from "@/lib/modules/types";

export const inventoryModule: StudioModule = {
  id: "inventory",
  title: "Inventory",
  i18nKey: "modules.inventory.title",
  description: "Browse and search the asset inventory.",
  navGroup: "General",
  nav: { title: "Inventory", href: "/inventory", icon: Boxes },
  tint: {
    bg: "bg-teal-500/12",
    fg: "text-teal-600 dark:text-teal-400",
    glow: "shadow-teal-500/30",
  },
  ownedPaths: ["/inventory"],
  required: false,
  defaultEnabled: false,
};
```

### 2. Register — `lib/modules/registry.ts`

Import it and append to `ALL_MODULES` (array order = sidebar order):

```ts
import { inventoryModule } from "@/features/inventory/module";
// …
export const ALL_MODULES: readonly StudioModule[] = [
  dashboardModule,
  workflowsModule,
  // …
  inventoryModule,
];
```

### 3. Edge manifest — `lib/modules/route-manifest.ts`

Add the **icon-free, React-free** mirror entry to `MODULE_ROUTE_MANIFEST`. This
runs in the edge middleware, so it must not import components:

```ts
{ id: "inventory", ownedPaths: ["/inventory"], required: false, defaultEnabled: false },
```

> ⚠️ `registry.ts` has a dev-only check that **throws** if the registry and the
> route-manifest drift (ids in one but not the other). Keep `id`, `ownedPaths`,
> `required`, `defaultEnabled` identical across the two files.

### 4. Routes — `app/(app)/inventory/...`

Standard App Router pages under the owned path. A real list page reuses the
shared shell:

```tsx
// app/(app)/inventory/page.tsx
import { AssetsTable } from "@/features/inventory/assets-table";
import { ListPageHeader, ListPageShell } from "@/features/workflows/list-page-shell";

export const metadata = { title: "Inventory" };

export default function Page() {
  return (
    <ListPageShell>
      <ListPageHeader title="Inventory" description="Browse and search the asset inventory." />
      <AssetsTable />
    </ListPageShell>
  );
}
```

> `ListPageShell`/`ListPageHeader` take an optional `kind` prop — a **typed
> discriminator** (`ListPageKind`) that selects the tint and icon. It defaults to
> `"definitions"`. To give a new module its own tint/icon, extend `ListPageKind`
> (and `LIST_PAGE_TINT` / `LIST_PAGE_ICONS`) in `list-page-shell.tsx`, then pass
> your new `kind`. Otherwise omit it.

Not ported yet? Ship a placeholder so the nav entry resolves:

```tsx
// app/(app)/inventory/page.tsx
import { ComingSoon } from "@/components/app/coming-soon";

export const metadata = { title: "Inventory" };

export default function Page() {
  return <ComingSoon title="Inventory" />;
}
```

(Pair the placeholder page with `placeholder: true` on the nav leaf.)

### 5. Translations — `messages/en.json` and `messages/nl.json`

Add the title under `modules.<id>`:

```json
"inventory": { "title": "Inventory" }
```

Add the same key to **every** locale file so the key never falls back silently.

### Done

The module now appears as a sidebar entry and as a checkbox on
`/settings/modules`. Disabling it hides the entry and redirects any direct URL
under `ownedPaths` to `/dashboard`. Verify with the
[`designer-verify`](../.claude/skills/designer-verify/SKILL.md) routine.

---

## Extend an existing module

Pick the smallest touchpoint for the change:

| Change | Where |
|---|---|
| Add a sub-page to a module | Add a child to `nav.items` (convert a leaf to a parent if needed) **and** create the `app/(app)/<path>/page.tsx`. `ownedPaths` already covers nested paths via prefix match. |
| Rename / relabel | `title` + the `messages/*.json` entry. |
| Change icon or colour | `nav.icon` and/or `tint` in `module.ts`. |
| Make it required / change default | Update **both** `module.ts` and `route-manifest.ts` (`required` / `defaultEnabled`). |
| Add data fetching | New hook in `lib/api/<domain>.ts` (TanStack Query + the `elsa` client), consumed by a `features/<id>/*` component. |
| New owned route prefix | Add to `ownedPaths` in **both** files. |

Rule of thumb: anything middleware needs (ids, owned paths, required, default)
must be mirrored in `route-manifest.ts`; anything visual (icons, tints, nav
labels, descriptions) lives only in `module.ts`.

---

## Gotchas

- **Drift check throws on startup**, not at runtime — if `pnpm dev` errors with
  "Module registry and route manifest are out of sync", you edited one of the two
  files but not the other.
- **Edge runtime can't import React/lucide.** Never import `module.ts` (or
  anything pulling in `lucide-react`) from `route-manifest.ts` or `middleware.ts`.
- **`ownedPaths` is prefix-matched** (`isPathOwnedByModule`): `/inventory` covers
  `/inventory/assets/123`. You rarely need to list nested paths.
- **Required modules** (`dashboard`, `workflows`, `settings`) are always enabled;
  don't set `defaultEnabled: false` on a required module.
- **i18n fallback is silent** — a missing `modules.<id>.title` falls back to
  `title`, so a typo'd key won't error; it just won't localise.
