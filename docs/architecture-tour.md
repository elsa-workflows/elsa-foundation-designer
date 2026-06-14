# Architecture tour

A fast orientation to **elsa-foundation-designer** — the Next.js rebuild of Elsa
Studio. Read this before touching the codebase; follow the links only for the
system you actually need.

## What this repo is

A web control plane for an existing **Elsa Workflow Server**. It does not run
workflows — it talks to the server's REST API to design, publish, run and
inspect them. Stack: Next.js (App Router), TypeScript, Tailwind v4, shadcn/ui,
TanStack Query, next-intl.

## The big picture

```
Browser ──▶ Next.js (this app) ──▶ Elsa Workflow Server REST API
              │
              ├─ middleware.ts        auth gate + module gate (edge runtime)
              ├─ app/(auth)/login     sign-in
              ├─ app/(app)/*          the authenticated shell + module routes
              ├─ app/api/auth/*       login / refresh / logout / me proxies
              ├─ features/*           one folder per studio module
              ├─ lib/modules/*        the module system (registry, guard, nav)
              └─ lib/api/*            typed REST client + TanStack Query hooks
```

## The four systems you'll actually touch

### 1. Modules (the heart of the studio)

The studio is a **shell** that assembles itself from a list of modules. A module
is a self-contained feature (Workflows, Alterations, Diagnostics, …) that owns
its sidebar entry, route segments, i18n strings and an on/off toggle.

- Contract: `lib/modules/types.ts` → `StudioModule`.
- Each module: `features/<id>/module.ts` exports one `StudioModule`.
- Registration: `lib/modules/registry.ts` → `ALL_MODULES` (drives nav order).
- Edge gate: `lib/modules/route-manifest.ts` → `MODULE_ROUTE_MANIFEST` (icon-free
  mirror read by `middleware.ts`).
- Toggle UI: **Settings → Modules** reads the registry; required modules can't be
  disabled.

➡ Full guide: [`docs/modules.md`](./modules.md). This is the doc you want for
adding or extending a module.

### 2. Routing & the shell

- `app/(app)/layout.tsx` renders the shell (sidebar, breadcrumb, providers).
- Module routes live under `app/(app)/<owned-path>/...` as standard App Router
  `page.tsx` files.
- `middleware.ts` runs on the edge: redirects unauthenticated users to `/login`
  and requests to *disabled* module paths to `/dashboard`, using the cookie +
  `MODULE_ROUTE_MANIFEST`.

### 3. The API layer

- `lib/api/client.ts` — the `elsa` ky client (base URL, auth header, errors).
- `lib/api/generated/elsa.d.ts` — types generated from the server's swagger
  (`pnpm gen:api`). Don't hand-edit.
- `lib/api/<domain>.ts` — `"use client"` modules exporting TanStack Query hooks
  (`useQuery`/`useMutation`) per resource, e.g. `lib/api/alterations.ts`.

➡ Pattern details: [`docs/extension-points.md`](./extension-points.md).

### 4. Auth

ElsaIdentity username/password. The browser never sees the Elsa tokens directly:
`app/api/auth/*` route handlers proxy login/refresh/logout and store JWTs as
**httpOnly cookies**. `lib/auth/*` has the session helpers. OIDC is a later phase.

## Cross-cutting conventions

- **i18n**: user-facing strings go through next-intl; module titles live in
  `messages/en.json` / `messages/nl.json` under `modules.<id>.title`.
- **Design system**: shadcn/ui primitives in `components/ui`, app-level shared
  pieces in `components/app` (e.g. `ComingSoon` for not-yet-ported modules).
- **Reuse**: list pages share `features/workflows/list-page-shell.tsx`
  (`ListPageShell` + `ListPageHeader`). Prefer it for new list screens.

## Where to go next

| You want to… | Read |
|---|---|
| Add or extend a module | [`docs/modules.md`](./modules.md) |
| Find every place you can plug in | [`docs/extension-points.md`](./extension-points.md) |
| Look up a term | [`docs/glossary.md`](./glossary.md) |
| See the skill operating procedures | [`docs/skills/catalog.md`](./skills/catalog.md) |
