# CLAUDE.md

Project memory for **elsa-foundation-designer** — the Next.js rebuild of Elsa
Studio. Auto-loaded every session. Keep it short; the depth lives in `docs/`.

## What this repo is

A web control plane for an existing **Elsa Workflow Server** (it calls the
server's REST API; it doesn't run workflows). Stack: Next.js App Router,
TypeScript, Tailwind v4, shadcn/ui, TanStack Query, next-intl. New here? Read
[`docs/architecture-tour.md`](docs/architecture-tour.md).

## Golden rule: feature work = a module

The studio is a shell assembled from **modules**. Almost any "implement / add /
build / port a feature" request maps to **creating or extending a module**, not
dropping a loose page. When a request is feature-shaped, treat it as module work
and follow the routing below — don't improvise a one-off.

## Intent → what to do

| When the user says… | Do this |
|---|---|
| "implement / add / build / scaffold a \<feature\>" | It's a new module. Read [`docs/modules.md`](docs/modules.md) or invoke `/designer-create-module`. Produce the 5-touchpoint file list, get approval, implement. |
| "extend / change / add a page to \<module\>" | Read [`docs/modules.md#extend-an-existing-module`](docs/modules.md). Use `/designer-extend-module`. Pick the smallest touchpoint. |
| "migrate / port \<feature\> from the old (Blazor) Studio" | Read [`docs/migrating.md`](docs/migrating.md) or invoke `/designer-migrate-feature`. Source repo: `elsa-workflows/elsa-studio`. |
| "where do I add / change X?" | Read [`docs/extension-points.md`](docs/extension-points.md) or `/designer-extension-points`. |
| "what is this repo / how does it work?" | `/designer-architecture-tour`. |
| "what does \<term\> mean?" | `/designer-glossary-lookup`. |

If a feature request is too vague to scope (no name / no behaviour), ask one
clarifying question before scaffolding — don't guess the module's identity.

## Non-negotiables (you will break the build otherwise)

- **Registry ↔ route-manifest must stay in lock-step.** Every module is in
  *both* `lib/modules/registry.ts` and `lib/modules/route-manifest.ts` with
  identical `id` / `ownedPaths` / `required` / `defaultEnabled`. A dev-only check
  **throws** on drift.
- **`route-manifest.ts` and `middleware.ts` are edge-runtime** — no
  `lucide-react`, no React, no component imports.
- **i18n keys go in every locale** (`messages/en.json` *and* `messages/nl.json`);
  the fallback is silent, so a missing key won't error, it just won't localise.
- **Don't hand-edit `lib/api/generated/elsa.d.ts`** — regenerate with
  `pnpm gen:api`.

## Always finish with the verify gate

After any module/feature change, run `/designer-verify` (or manually:
`pnpm typecheck` → `pnpm lint` → `pnpm build`). `pnpm build` is what catches the
registry/route-manifest drift and route/SSR errors. Report results honestly.

## Docs & skills map

- Authoritative docs: [`docs/`](docs/) (see [`docs/README.md`](docs/README.md)).
- Skill operating procedures: [`docs/skills/catalog.md`](docs/skills/catalog.md).
- Skills: `.claude/skills/designer-*` — invoke with `/designer-<name>`.
