# Migrating a feature from the Blazor Elsa Studio

How to port a feature from the original **Blazor** Elsa Studio
(`elsa-workflows/elsa-studio`, MudBlazor + .NET) into a module in this Next.js
repo. The goal is **behaviour parity, not visual parity** — the design systems
differ, so you rebuild the UI with shadcn/ui rather than translating MudBlazor
markup.

> Prerequisite: read [`docs/modules.md`](./modules.md) first. A migrated feature
> lands as a **module**, so the 5 touchpoints there are the destination shape.

## Step 1 — Locate the source feature

The source repo is `elsa-workflows/elsa-studio`. Features live in their own
projects/folders (e.g. a `Elsa.Studio.<Feature>` project with `.razor` pages, a
menu provider, and services). **Read the actual source before porting** — don't
assume API names. Get it checked out locally or browse it on GitHub.

## Step 2 — Inventory what the feature is made of

For the source feature, list:

- **Navigation** — its menu entries (look for an `IMenuProvider` /
  `MenuItem`s) → becomes `StudioModule.nav`.
- **Routes/pages** — each `.razor` with `@page "/route"` → becomes an
  `app/(app)/<route>/page.tsx`.
- **Data access** — every `Elsa.Api.Client` / backend service call → becomes a
  TanStack Query hook in `lib/api/<domain>.ts`.
- **Dialogs / interactions** — `MudDialog`, forms, confirmations → shadcn
  `Dialog`, `react-hook-form`, etc.
- **Localized strings** — `IStringLocalizer` / `.resx` → `messages/*.json`.
- **Authorization** — `[Authorize]` / permission checks → module
  enabled/required + the auth phase (note any gaps; auth is phase 1).

## Step 3 — Map onto this repo

| Blazor Elsa Studio | This repo |
|---|---|
| Module/feature registration (`AddModule` / `IFeature`) | `StudioModule` manifest + `ALL_MODULES` + `MODULE_ROUTE_MANIFEST` |
| `IMenuProvider` → `MenuItem` tree | `StudioModule.nav` (leaf or parent) |
| `@page "/x"` Razor page | `app/(app)/x/page.tsx` |
| MudBlazor components (`MudTable`, `MudButton`, `MudDialog`, …) | shadcn/ui in `components/ui`; lists reuse `ListPageShell`/`ListPageHeader` |
| `Elsa.Api.Client` service call | `lib/api/<domain>.ts` hook on the `elsa` client (reuse generated types from `lib/api/generated/elsa.d.ts`) |
| `IStringLocalizer` / `.resx` | next-intl `messages/en.json` + `messages/nl.json` |
| `[Authorize]` / permissions | module `required`/enabled + middleware (flag gaps) |
| SignalR / live updates | `lib/api/signalr.ts` |

## Step 4 — Build it as a module

1. Reuse existing generated DTOs (`lib/api/generated/elsa.d.ts`) — the REST
   contract is the same server, so most types already exist. Run `pnpm gen:api`
   if an endpoint is missing.
2. Add resource hooks in `lib/api/<domain>.ts` (template:
   [`extension-points.md`](./extension-points.md#resource-hook-shape-the-template)).
3. Rebuild the pages with shadcn primitives; reuse `ListPageShell` for list
   screens and `ComingSoon` for any sub-page you're staging.
4. Wire the **5 module touchpoints** per [`docs/modules.md`](./modules.md): the
   manifest, registry, route-manifest, routes, and i18n.
5. Port strings into every locale file.

## Step 5 — Verify parity, then the build

- Walk the source feature's behaviours and confirm each exists in the port
  (filters, actions, empty states, error handling).
- Run the [`designer-verify`](../.claude/skills/designer-verify/SKILL.md)
  routine.
- Note anything intentionally dropped or deferred (e.g. permission checks) so
  it's not mistaken for done.

## What NOT to do

- Don't translate MudBlazor markup component-for-component — rebuild with the
  local design system.
- Don't re-create fetch logic — go through the `elsa` client + a hook.
- Don't add a route without registering its module (you'll get a dead,
  ungated page).
- Don't port C# DTOs by hand when `pnpm gen:api` produces them.
