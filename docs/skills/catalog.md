# Skills catalog

Operating procedures for the `designer-*` skills under `.claude/skills/`. Each
skill is a **thin pointer**: it reads its section here, reads the authoritative
doc the section links to, then follows the outline. Keep the real knowledge in
`docs/` — skills should stay short.

This mirrors the convention used by
[`elsa-workflows/elsa-foundation`](https://github.com/elsa-workflows/elsa-foundation/tree/main/.claude):
docs are the source of truth; skills are the fast entry points.

---

## architecture-tour

**Skill:** `designer-architecture-tour` · **Doc:** [`docs/architecture-tour.md`](../architecture-tour.md)

Give a concise orientation to the repo. Procedure:

1. Read [`docs/architecture-tour.md`](../architecture-tour.md).
2. Follow links **only** for the system the user asked about.
3. Keep it short; end by pointing at the next doc to read.

Do not expand into a module implementation unless asked.

---

## create-module

**Skill:** `designer-create-module` · **Doc:** [`docs/modules.md`](../modules.md)

Plan or scaffold a new studio module. Procedure:

1. Read [`docs/modules.md`](../modules.md) — the contract and the 5 touchpoints.
2. Pin down: `id` (kebab-case), `navGroup`, leaf-vs-parent nav, `ownedPaths`,
   `required`, `defaultEnabled`, and whether the first page is real or a
   `ComingSoon` placeholder.
3. Produce the exact file list before editing:
   - `features/<id>/module.ts`
   - `lib/modules/registry.ts` (append to `ALL_MODULES`)
   - `lib/modules/route-manifest.ts` (mirror entry — keep in lock-step)
   - `app/(app)/<owned-path>/page.tsx` (+ any sub-pages)
   - `messages/en.json` **and** `messages/nl.json`
4. If the user hasn't approved implementation, stop at the plan + file list.
5. After approval, implement all five touchpoints, then run the
   `designer-verify` routine. Confirm the dev-time drift check passes.

Hard rules: registry ↔ route-manifest must not drift; `route-manifest.ts` stays
icon-free/React-free; add the i18n key to every locale.

---

## extend-module

**Skill:** `designer-extend-module` · **Doc:** [`docs/modules.md`](../modules.md#extend-an-existing-module)

Modify an existing module (sub-page, rename, icon, owned path, data, default).
Procedure:

1. Read [`docs/modules.md#extend-an-existing-module`](../modules.md#extend-an-existing-module).
2. Map the change to the **smallest** touchpoint using that table.
3. If the change involves ids / owned paths / required / default, edit **both**
   `module.ts` and `route-manifest.ts`. Visual-only changes touch `module.ts`.
4. For new data, add a hook in `lib/api/<domain>.ts` per the template in
   [`docs/extension-points.md`](../extension-points.md#resource-hook-shape-the-template).
5. Run `designer-verify`.

---

## migrate-feature

**Skill:** `designer-migrate-feature` · **Docs:** [`docs/migrating.md`](../migrating.md) + [`docs/modules.md`](../modules.md)

Port a feature from the Blazor Elsa Studio (`elsa-workflows/elsa-studio`) into a
module here. Procedure:

1. Read [`docs/migrating.md`](../migrating.md) and [`docs/modules.md`](../modules.md).
2. Locate the source feature and **read its actual source** — don't assume
   Blazor API names. Inventory nav, routes/pages, `Elsa.Api.Client` calls,
   dialogs, strings, authorization.
3. Map each piece with the table in `migrating.md`; build it as a module via the
   5 touchpoints in `modules.md`.
4. Reuse generated DTOs + the `elsa` client; rebuild UI with shadcn/ui (not
   MudBlazor markup); behaviour parity, not visual parity.
5. Produce the plan + file list; stop for approval if not given. After
   implementing, verify parity, run `designer-verify`, and flag anything
   deferred.

---

## extension-point-catalog

**Skill:** `designer-extension-points` · **Doc:** [`docs/extension-points.md`](../extension-points.md)

Answer "where do I plug in X?" Procedure:

1. Read [`docs/extension-points.md`](../extension-points.md).
2. Return the owning file + how-to for the asked-about extension point.
3. If no point fits, recommend adding one and updating the catalog rather than a
   one-off hack.

---

## verify-codebase

**Skill:** `designer-verify` · **Doc:** this section

Confirm a change is sound before handing off. Run, in order, and report results
honestly (don't claim green if anything failed):

1. `pnpm typecheck` — `tsc --noEmit`.
2. `pnpm lint` — ESLint.
3. `pnpm build` — catches the module **drift check** and route/SSR errors that
   typecheck misses.
4. For module work, sanity-check the runtime: `pnpm dev`, confirm the new
   sidebar entry appears and the Settings → Modules toggle hides/redirects the
   route. (e2e screenshots can be captured with Playwright if needed.)

Format: a short status line per step + the failing output if any.

---

## glossary-lookup

**Skill:** `designer-glossary-lookup` · **Doc:** [`docs/glossary.md`](../glossary.md)

Define a project term. Procedure:

1. Read [`docs/glossary.md`](../glossary.md).
2. Return the definition; link to the deeper doc if the user needs more.
