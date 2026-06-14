"use client";

import { BookOpen, Code2 } from "lucide-react";

import { Breadcrumbs } from "@/components/app/shell/breadcrumbs";
import { CommandPalette } from "@/components/app/shell/command-palette";
import { ThemeToggle } from "@/components/app/shell/theme-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function AppHeader() {
  return (
    <header className="bg-background/80 sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumbs />
      <div className="ml-auto flex items-center gap-2">
        <CommandPalette />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Documentation"
          render={
            <a href="https://docs.elsaworkflows.io/" target="_blank" rel="noreferrer noopener" />
          }
        >
          <BookOpen className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="GitHub"
          render={
            <a
              href="https://github.com/elsa-workflows/elsa-studio"
              target="_blank"
              rel="noreferrer noopener"
            />
          }
        >
          <Code2 className="size-4" />
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}
