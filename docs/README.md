# Docs

Authoritative documentation for **elsa-foundation-designer**. These docs are the
source of truth; the `.claude/skills/designer-*` skills are thin entry points
that read them (see [`skills/catalog.md`](./skills/catalog.md)).

| Doc | Read it when |
|---|---|
| [`architecture-tour.md`](./architecture-tour.md) | You're new here or need to orient quickly. |
| [`modules.md`](./modules.md) | **Adding or extending a module** — the contract, the 5 touchpoints, recipes. |
| [`migrating.md`](./migrating.md) | **Porting a feature** from the Blazor Elsa Studio into a module. |
| [`extension-points.md`](./extension-points.md) | "Where do I plug in X?" — nav, routes, the module gate, API hooks, i18n, UI. |
| [`glossary.md`](./glossary.md) | You hit a project-specific term. |
| [`skills/catalog.md`](./skills/catalog.md) | You want the operating procedure behind a `designer-*` skill. |

## Skills

Run these from Claude Code with `/<name>`:

| Skill | Does |
|---|---|
| `designer-architecture-tour` | Concise repo orientation. |
| `designer-create-module` | Plan/scaffold a new module across all 5 touchpoints. |
| `designer-extend-module` | Modify an existing module via the smallest touchpoint. |
| `designer-migrate-feature` | Port a Blazor Elsa Studio feature into a module. |
| `designer-extension-points` | Find the right place to plug in a change. |
| `designer-verify` | typecheck → lint → build (drift check) → runtime sanity. |
| `designer-glossary-lookup` | Define a project term. |

> Convention borrowed from
> [`elsa-workflows/elsa-foundation`](https://github.com/elsa-workflows/elsa-foundation/tree/main/.claude):
> keep knowledge in `docs/`, keep skills short and pointed at it. When you add a
> skill, add its operating procedure to `skills/catalog.md` and keep the
> `SKILL.md` thin.
