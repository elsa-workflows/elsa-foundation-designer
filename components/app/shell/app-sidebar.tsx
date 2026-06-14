"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { ChevronRight, Plus, Search } from "lucide-react";
import { useState, type ComponentType } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { NavUser } from "@/components/app/shell/nav-user";
import { ConnectionDot } from "@/components/app/shell/connection-dot";
import { EngineSwitcher } from "@/components/app/shell/engine-switcher";
import { Button } from "@/components/ui/button";
import {
  isBranchActive,
  isParent,
  type NavLeaf,
  type NavParent,
} from "@/lib/modules/build-navigation";
import type { NavTint } from "@/lib/modules/types";
import { useNav } from "@/components/app/nav-provider";

/**
 * Compact tile rendering a Lucide icon over a semantic-coloured background.
 * The whole sidebar leans on this primitive so every nav item carries an
 * unmistakable "what section am I in" cue — the pattern used by Linear,
 * Vercel, Stripe and Supabase dashboards.
 */
function IconTile({
  Icon,
  tint,
  active,
  size = "md",
}: {
  Icon: ComponentType<{ className?: string }>;
  tint: NavTint;
  active: boolean;
  size?: "md" | "sm";
}) {
  const box =
    size === "sm"
      ? "size-6 rounded-[6px]"
      : "size-7 rounded-md";
  const iconSize = size === "sm" ? "size-3.5" : "size-4";
  return (
    <div
      className={[
        "flex shrink-0 items-center justify-center transition-all duration-150",
        box,
        tint.bg,
        tint.fg,
        active ? `shadow-sm ${tint.glow}` : "",
      ].join(" ")}
    >
      <Icon className={iconSize} />
    </div>
  );
}

function LeafItem({
  item,
  pathname,
  tint,
}: {
  item: NavLeaf;
  pathname: string;
  tint: NavTint;
}) {
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        tooltip={item.title}
        className={[
          "group/row h-10 gap-2.5 rounded-lg px-2 transition-all duration-150",
          active
            ? "bg-background shadow-sm ring-1 ring-sidebar-border font-medium"
            : "hover:bg-sidebar-accent/60",
          item.placeholder ? "opacity-60" : "",
        ].join(" ")}
        render={<Link href={item.href} prefetch={!item.placeholder} />}
      >
        <IconTile Icon={item.icon} tint={tint} active={active} />
        <span className="truncate">{item.title}</span>
        {item.placeholder ? (
          <span className="bg-muted-foreground/15 text-muted-foreground ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide">
            soon
          </span>
        ) : null}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function ParentBranch({
  item,
  pathname,
  tint,
}: {
  item: NavParent;
  pathname: string;
  tint: NavTint;
}) {
  const branchActive = isBranchActive(item, pathname);
  // Controlled state so navigating into a branch auto-opens it without
  // tripping base-UI's "default state changed after init" warning. Users
  // can still toggle manually; we don't force-close on navigation away.
  // Following React's "adjusting state during render" pattern to avoid
  // the setState-in-effect cascade.
  const [open, setOpen] = useState(branchActive);
  const [prevActive, setPrevActive] = useState(branchActive);
  if (branchActive !== prevActive) {
    setPrevActive(branchActive);
    if (branchActive) setOpen(true);
  }
  return (
    <SidebarMenuItem>
      <Collapsible open={open} onOpenChange={setOpen} className="group/collapsible">
        <CollapsibleTrigger
          render={
            <SidebarMenuButton
              isActive={branchActive}
              tooltip={item.title}
              className={[
                "h-10 gap-2.5 rounded-lg px-2 transition-all duration-150",
                branchActive
                  ? "bg-background shadow-sm ring-1 ring-sidebar-border font-medium"
                  : "hover:bg-sidebar-accent/60",
              ].join(" ")}
            />
          }
        >
          <IconTile Icon={item.icon} tint={tint} active={branchActive} />
          <span className="truncate">{item.title}</span>
          <ChevronRight className="text-muted-foreground ml-auto size-3.5 transition-transform duration-150 group-data-[panel-open]/collapsible:rotate-90" />
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden data-[ending-style]:animate-collapsible-up data-[starting-style]:animate-collapsible-down">
          <SidebarMenuSub className="ml-3 mt-1 gap-0.5 border-l border-sidebar-border/60 pl-3 pr-1">
            {item.items.map((sub) => {
              const subActive =
                pathname === sub.href || pathname.startsWith(`${sub.href}/`);
              return (
                <SidebarMenuSubItem key={sub.href} className="relative">
                  {subActive ? (
                    <span
                      aria-hidden
                      className="bg-sky-500 absolute -left-3 top-1.5 bottom-1.5 w-0.5 rounded-r-full"
                    />
                  ) : null}
                  <Link
                    href={sub.href}
                    prefetch={!sub.placeholder}
                    className={[
                      "flex h-8 items-center gap-2 rounded-md px-2 text-sm transition-colors duration-100",
                      subActive
                        ? "text-sidebar-accent-foreground bg-sidebar-accent/50 font-medium"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40",
                      sub.placeholder ? "opacity-60" : "",
                    ].join(" ")}
                  >
                    <IconTile Icon={sub.icon} tint={tint} active={subActive} size="sm" />
                    <span className="truncate">{sub.title}</span>
                    {sub.placeholder ? (
                      <span className="bg-muted-foreground/15 text-muted-foreground ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide">
                        soon
                      </span>
                    ) : null}
                  </Link>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
}

const DEFAULT_TINT: NavTint = {
  bg: "bg-slate-500/10",
  fg: "text-slate-600 dark:text-slate-400",
  glow: "shadow-slate-500/25",
};

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const { navigation } = useNav();

  // Filter on the leaf items + their parent context. Empty search = the full
  // nav as authored.
  const filteredNav = (() => {
    const q = search.trim().toLowerCase();
    if (!q) return navigation;
    return navigation
      .map((g) => ({
        ...g,
        items: g.items
          .map((it) => {
            if (isParent(it)) {
              const kids = it.items.filter((k) => k.title.toLowerCase().includes(q));
              return kids.length > 0 ? { ...it, items: kids } : null;
            }
            return it.title.toLowerCase().includes(q) ? it : null;
          })
          .filter((x): x is NonNullable<typeof x> => x !== null),
      }))
      .filter((g) => g.items.length > 0);
  })();

  return (
    <Sidebar
      collapsible="icon"
      className="bg-gradient-to-b from-sidebar to-sidebar/95 border-r"
    >
      {/* ===== Brand ====================================================== */}
      <SidebarHeader className="px-2 pt-3 pb-2">
        <div className="hover:bg-sidebar-accent/40 flex h-14 items-center gap-3 rounded-xl px-2 transition-colors">
          <Link
            href="/dashboard"
            aria-label="Elsa Studio dashboard"
            className="bg-gradient-to-br from-sky-500/20 via-blue-500/10 to-indigo-500/20 ring-sidebar-border relative flex aspect-square size-10 shrink-0 items-center justify-center rounded-xl ring-1 shadow-md"
          >
            <Image
              src="/elsa-logo.png"
              alt="Elsa"
              width={32}
              height={32}
              priority
              className="size-7 object-contain"
            />
            <ConnectionDot />
          </Link>
          <div className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
            <EngineSwitcher />
          </div>
        </div>
      </SidebarHeader>

      {/* ===== Search + Quick action ====================================== */}
      <div className="space-y-1.5 px-3 pb-2 group-data-[collapsible=icon]:hidden">
        <div className="relative">
          <Search className="text-muted-foreground absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search nav…"
            className="bg-background/70 ring-sidebar-border placeholder:text-muted-foreground/70 h-8 w-full rounded-md pl-8 pr-2 text-[12px] ring-1 outline-none transition-shadow focus:bg-background focus:ring-2 focus:ring-sky-500/60"
          />
        </div>
        <Button
          size="sm"
          className="h-8 w-full justify-start gap-2 rounded-md bg-sky-500 text-white shadow-sm transition-colors hover:bg-sky-600"
          onClick={() => router.push("/workflows/definitions?new=1")}
        >
          <Plus className="size-3.5" />
          New workflow
        </Button>
      </div>

      {/* ===== Nav ======================================================== */}
      <SidebarContent className="gap-1 px-2">
        {filteredNav.map((group, idx) => (
          <SidebarGroup key={group.title} className="px-0 py-1">
            <div className="text-muted-foreground/70 mb-1 flex items-center gap-2 px-2 text-[10px] font-semibold uppercase tracking-[0.1em] group-data-[collapsible=icon]:hidden">
              <span className="bg-muted-foreground/30 inline-block h-px flex-1" />
              <span>{group.title}</span>
              <span className="bg-muted-foreground/30 inline-block h-px flex-1" />
            </div>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.map((item) => {
                  const tint = item.tint ?? DEFAULT_TINT;
                  return isParent(item) ? (
                    <ParentBranch
                      key={item.title}
                      item={item}
                      pathname={pathname}
                      tint={tint}
                    />
                  ) : (
                    <LeafItem
                      key={item.href}
                      item={item}
                      pathname={pathname}
                      tint={tint}
                    />
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
            {idx < filteredNav.length - 1 ? <div className="h-2" /> : null}
          </SidebarGroup>
        ))}

        {filteredNav.length === 0 ? (
          <p className="text-muted-foreground/80 px-3 py-2 text-xs italic">
            Nothing matches &ldquo;{search}&rdquo;.
          </p>
        ) : null}
      </SidebarContent>

      {/* ===== Footer (user) ============================================== */}
      <SidebarFooter className="border-sidebar-border/60 border-t pt-2">
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
