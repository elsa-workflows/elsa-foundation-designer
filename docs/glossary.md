# Glossary

Project-specific terms used across the docs and code. General Next.js / React
terms are out of scope.

- **Studio shell** — the authenticated app frame (`app/(app)/layout.tsx`):
  sidebar, breadcrumb, providers. It assembles itself from the module registry.

- **Module** — a self-contained studio feature (Workflows, Alterations, …)
  described by one `StudioModule` manifest. Owns nav, routes, i18n and an on/off
  toggle. See [`docs/modules.md`](./modules.md).

- **Manifest** — the `StudioModule` object exported from
  `features/<id>/module.ts`. The single description the shell reads.

- **Feature folder** — `features/<id>/`. Holds the module manifest plus all of
  that module's components, hooks and logic. One folder per module.

- **Registry** — `lib/modules/registry.ts` → `ALL_MODULES`. The ordered list of
  every module the studio knows about. Array order drives sidebar order.

- **Route manifest** — `lib/modules/route-manifest.ts` →
  `MODULE_ROUTE_MANIFEST`. An icon-free, React-free mirror of the registry read
  by `middleware.ts` on the edge runtime. Must stay in lock-step with the
  registry (a dev-only check throws on drift).

- **Owned path** — a route prefix a module claims (`ownedPaths`). Middleware
  redirects requests under a *disabled* module's owned path to `/dashboard`.
  Prefix-matched via `isPathOwnedByModule`.

- **Module gate** — the middleware step that blocks disabled modules' URLs,
  driven by the modules cookie + route manifest.

- **Modules cookie** (`elsa_modules`) — JSON array of enabled module ids set by
  Settings → Modules. Absent ⇒ required + `defaultEnabled` modules are on.

- **Required module** — `required: true`. Always enabled; its toggle is hidden.
  Currently: `dashboard`, `workflows`, `settings`.

- **Nav leaf / nav parent** — a single sidebar link (`ModuleNavLeaf`) vs a
  collapsible group with `items` (`ModuleNavParent`).

- **Placeholder module** — a module whose feature pages aren't ported yet:
  `placeholder: true` on the nav leaf + a `<ComingSoon />` page.

- **Tint** — the icon-tile colour set (`{bg, fg, glow}` Tailwind classes) on a
  module.

- **Engine** — a configured Elsa Workflow Server target. The login screen and
  sidebar let users pick between engines defined in `ELSA_ENGINES`.

- **`elsa` client** — the configured ky HTTP client in `lib/api/client.ts` used
  by all resource hooks.

- **Resource hook** — a `"use client"` TanStack Query hook in `lib/api/<domain>.ts`
  wrapping an Elsa REST resource.

- **List page shell** — the shared `ListPageShell` + `ListPageHeader`
  (`features/workflows/list-page-shell.tsx`) reused across list screens.
