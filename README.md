# Elsa Studio Next

A modern, fast control plane for [Elsa Workflows](https://elsaworkflows.io/) — a
ground-up rebuild of Elsa Studio on **Next.js** (App Router), **TypeScript**,
**Tailwind v4** and **shadcn/ui**. Design workflows on a drag-and-drop canvas,
publish and run them, and inspect every execution — all against your existing
Elsa Workflow Server over its REST API.

The studio is modular: each feature (Workflows, Alterations, Diagnostics, …)
plugs into a shared shell and can be toggled on or off per deployment.

## A quick tour

### Workflow designer

Drag activities onto the canvas and wire them together. New activities flow
left-to-right by default; reorder by dragging, flip orientation, and switch
between the visual **Designer**, raw **Code** and **Properties** views.

![Workflow designer](docs/screenshots/workflow-editor.png)

### Dashboard

At-a-glance health: definition counts, live instances, faults in the last 24h,
a 7-day activity chart and the most recent runs.

![Dashboard](docs/screenshots/dashboard.png)

### Workflow definitions & instances

Browse, search and filter every workflow registered with the server, then drill
into individual runs to follow their execution.

| Definitions | Instances |
|---|---|
| ![Workflow definitions](docs/screenshots/workflows-definitions.png) | ![Workflow instances](docs/screenshots/workflows-instances.png) |

### Alterations

Inspect alteration plans the server is executing and modify in-flight workflow
instances.

![Alterations](docs/screenshots/alterations.png)

### Settings

Turn studio modules on or off and check backend connection health. Required
modules (Dashboard, Workflows, Settings) can't be disabled.

![Settings — Modules](docs/screenshots/settings.png)

### Sign in

ElsaIdentity username/password against your chosen engine.

![Sign in](docs/screenshots/login.png)

> **Coming in a follow-up phase.** The shell, navigation and design system are in
> place for these modules; the feature pages land in upcoming PRs.
>
> | Diagnostics | Security | Labels |
> |---|---|---|
> | ![Diagnostics](docs/screenshots/diagnostics.png) | ![Security](docs/screenshots/security.png) | ![Labels](docs/screenshots/labels.png) |

## Quick start

```bash
pnpm install
cp .env.example .env.local            # point ELSA_API_URL at your local Elsa server
pnpm gen:api                          # generates lib/api/generated/elsa.d.ts from /swagger/v1/swagger.json
pnpm dev                              # http://localhost:3000
```

You'll need a local Elsa Workflow Server (default `https://localhost:5001/elsa/api`)
with CORS allowing `http://localhost:3000` and an ElsaIdentity admin user.

Self-signed dev cert? Set `NODE_EXTRA_CA_CERTS=/path/to/cert.crt` in `.env.local`.

## Scripts

| Script | What |
|---|---|
| `pnpm dev` | Start the dev server. |
| `pnpm build` | Production build. |
| `pnpm start` | Run the production build. |
| `pnpm lint` | ESLint (next config). |
| `pnpm typecheck` | `tsc --noEmit`. |
| `pnpm format` | Prettier write. |
| `pnpm gen:api` | Regenerate Elsa TS types from swagger. |

## Layout

```
app/(app)/...        # protected routes (shell + dashboard + module placeholders)
app/(auth)/login     # sign-in page
app/api/auth/...     # 4 route handlers: login, refresh, logout, me
components/ui        # shadcn primitives
components/app       # shell, providers, app-level shared components
features/*           # one folder per studio module (dashboard, workflows, …)
lib/api              # ky client + generated types + TanStack Query hooks
lib/auth             # cookie session helpers
lib/modules/         # module manifest, registry, route guard + enable/disable
middleware.ts        # cookie-based auth + module gate
```

## Adding a module

Studio features are pluggable. Each module owns its sidebar entry, route
segments and i18n strings, and can be toggled on/off from
**Settings → Modules**. To add one, e.g. an `inventory` module:

1. **Create the feature folder + manifest**

   ```ts
   // features/inventory/module.ts
   import { Boxes } from "lucide-react";
   import type { StudioModule } from "@/lib/modules/types";

   export const inventoryModule: StudioModule = {
     id: "inventory",
     title: "Inventory",
     i18nKey: "modules.inventory.title",
     description: "Browse and search the asset inventory.",
     navGroup: "General",
     nav: { title: "Inventory", href: "/inventory", icon: Boxes },
     tint: { bg: "bg-teal-500/12", fg: "text-teal-600 dark:text-teal-400", glow: "shadow-teal-500/30" },
     ownedPaths: ["/inventory"],
     defaultEnabled: false,
   };
   ```

2. **Register it** in `lib/modules/registry.ts` (append to `ALL_MODULES`)
   and add the matching entry to `lib/modules/route-manifest.ts` — the
   manifest is what the edge-runtime middleware reads to gate URLs, so it
   must stay icon-free.

3. **Build the route pages** under `app/(app)/inventory/...`.

4. **Add translations** to `messages/en.json` / `messages/nl.json` under
   `modules.inventory.title`.

Done — the module appears as a checkbox on `/settings/modules`. Disabling
it hides the sidebar entry and redirects any direct URL to `/dashboard`.
Required modules (Dashboard, Workflows, Settings) cannot be disabled.

## Auth model (phase 1)

ElsaIdentity username/password only. JWT access + refresh tokens stored as
**httpOnly cookies** via Next route handlers acting as a thin proxy. OIDC is
deferred to a follow-up phase.
