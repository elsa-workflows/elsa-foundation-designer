"use client";

import { Languages } from "lucide-react";
import { useLocale } from "next-intl";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setLocale } from "@/lib/i18n-actions";

const LANGUAGES: { code: "en" | "nl"; label: string }[] = [
  { code: "en", label: "English" },
  { code: "nl", label: "Nederlands" },
];

/**
 * App-header dropdown for switching the UI language. Writes the chosen
 * locale to a cookie via a server action; the layout re-renders with the
 * new messages on the next response.
 */
export function LanguagePicker() {
  const current = useLocale();
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Language"
            disabled={pending}
          />
        }
      >
        <Languages className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGUAGES.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onSelect={() => startTransition(() => setLocale(l.code))}
            className={l.code === current ? "bg-accent" : undefined}
          >
            {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
