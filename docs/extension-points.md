# Extension-point catalog

Every place the studio is designed to be plugged into, with the file that owns
it and how to extend it. If you're adding behaviour and it isn't listed here,
prefer adding a new extension point over a one-off hack — and add it to this
catalog.

## Module-level

| Extension point | File | How to extend |
|---|---|---|
| **Sidebar entry** | `features/<id>/module.ts` (`nav`) | Add/modify the `ModuleNavLeaf` or `ModuleNavParent`. Order across modules comes from `ALL_MODULES`. |
| **Sidebar group** | `module.ts` (`navGroup`) | Set the group heading; groups render in first-seen order. |
| **Module registration** | `lib/modules/registry.ts` (`ALL_MODULES`) | Append the manifest. Position = sidebar order. |
| **Route guard** | `lib/modules/route-manifest.ts` (`MODULE_ROUTE_MANIFEST`) | Mirror `{id, ownedPaths, required, defaultEnabled}`. Read by `middleware.ts` on the edge. |
| **Enable/disable toggle** | `lib/modules/registry.ts` + Settings → Modules | Automatic from the manifest. `required: true` hides the toggle. |
| **Owned routes** | `module.ts` + `route-manifest.ts` (`ownedPaths`) | Prefix-matched. Add a prefix to both files. |
| **Default on/off** | both files (`defaultEnabled`) | Initial state with no cookie. |
| **Icon tile colour** | `module.ts` (`tint`) | `{bg, fg, glow}` Tailwind classes. |

➡ Step-by-step recipes live in [`docs/modules.md`](./modules.md).

## Routing & shell

| Extension point | File | How to extend |
|---|---|---|
| **Module page** | `app/(app)/<owned-path>/page.tsx` | Standard App Router page. Reuse `ListPageShell`/`ListPageHeader` for list screens. |
| **Detail route** | `app/(app)/<path>/[id]/page.tsx` | Dynamic segment; covered by the parent's `ownedPaths` prefix. |
| **Placeholder page** | `components/app/coming-soon.tsx` (`ComingSoon`) | Render `<ComingSoon title="…" />` for unported modules; pair with `placeholder: true` on the nav leaf. |
| **Auth gate / module gate** | `middleware.ts` | Edge logic; usually you only feed it via `route-manifest.ts`, not by editing middleware. |
| **Shared list UI** | `features/workflows/list-page-shell.tsx` | `ListPageShell` + `ListPageHeader`. Optional `kind` is a typed `ListPageKind` discriminator (tint + icon); defaults to `"definitions"`. Extend `ListPageKind`/`LIST_PAGE_TINT`/`LIST_PAGE_ICONS` to add a new one. |

## Data / API

| Extension point | File | How to extend |
|---|---|---|
| **REST client** | `lib/api/client.ts` (`elsa`) | The configured ky client (base URL, auth, error mapping). Use it; don't re-create fetch logic. |
| **Generated types** | `lib/api/generated/elsa.d.ts` | Regenerate with `pnpm gen:api`. Never hand-edit. |
| **Resource hooks** | `lib/api/<domain>.ts` | `"use client"` module exporting TanStack Query `useQuery`/`useMutation` hooks. Mirror DTOs near the hooks. See `lib/api/alterations.ts` as the template. |
| **Realtime** | `lib/api/signalr.ts` | SignalR connection for server-pushed workflow updates. |
| **Downloads** | `lib/api/download.ts` | File/export helpers. |

### Resource-hook shape (the template)

```ts
"use client";
import { useQuery } from "@tanstack/react-query";
import { elsa } from "@/lib/api/client";

export type Asset = { id: string; name: string };

export function useAssets() {
  return useQuery({
    queryKey: ["inventory", "assets"],
    queryFn: () => elsa.get("inventory/assets").json<Asset[]>(),
  });
}
```

## Cross-cutting

| Extension point | File | How to extend |
|---|---|---|
| **i18n strings** | `messages/en.json`, `messages/nl.json` | Add keys under `modules.<id>`. Add to **all** locales — fallback is silent. |
| **UI primitives** | `components/ui/*` | shadcn/ui components. Add new primitives here. |
| **App-level shared UI** | `components/app/*` | Shell, providers, cross-module pieces (e.g. `ComingSoon`). |
| **Auth session** | `lib/auth/*`, `app/api/auth/*` | Cookie session helpers + the login/refresh/logout/me proxies. |
