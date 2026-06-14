"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Monitor, Moon, Search, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { isParent, type NavLeaf } from "@/lib/modules/build-navigation";
import { useNav } from "@/components/app/nav-provider";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { setTheme } = useTheme();
  const { navigation } = useNav();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hidden h-9 w-full max-w-64 justify-between gap-2 px-2 md:flex"
      >
        <span className="flex items-center gap-2">
          <Search className="size-4" />
          Search…
        </span>
        <kbd className="bg-muted text-muted-foreground pointer-events-none inline-flex h-5 items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium select-none">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label="Open command palette"
        className="md:hidden"
      >
        <Search className="size-4" />
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Jump to…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {navigation.map((group) => {
            // Flatten nested groups into the command list, prefixing the child
            // title with its parent (e.g. "Workflows · Definitions") so search
            // catches either token.
            const entries: { leaf: NavLeaf; prefix?: string }[] = group.items.flatMap((item) =>
              isParent(item)
                ? item.items.map((leaf) => ({ leaf, prefix: item.title }))
                : [{ leaf: item }],
            );
            return (
              <CommandGroup key={group.title} heading={group.title}>
                {entries.map(({ leaf, prefix }) => {
                  const Icon = leaf.icon;
                  return (
                    <CommandItem
                      key={leaf.href}
                      value={`${group.title} ${prefix ?? ""} ${leaf.title}`.trim()}
                      onSelect={() => run(() => router.push(leaf.href))}
                    >
                      <Icon className="mr-2 size-4" />
                      <span>
                        {prefix ? (
                          <>
                            <span className="text-muted-foreground">{prefix} ·</span> {leaf.title}
                          </>
                        ) : (
                          leaf.title
                        )}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            );
          })}
          <CommandSeparator />
          <CommandGroup heading="Theme">
            <CommandItem onSelect={() => run(() => setTheme("light"))}>
              <Sun className="mr-2 size-4" /> Light
            </CommandItem>
            <CommandItem onSelect={() => run(() => setTheme("dark"))}>
              <Moon className="mr-2 size-4" /> Dark
            </CommandItem>
            <CommandItem onSelect={() => run(() => setTheme("system"))}>
              <Monitor className="mr-2 size-4" /> System
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
