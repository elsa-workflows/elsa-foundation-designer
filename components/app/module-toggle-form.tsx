"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { setEnabledModules } from "@/lib/modules/actions";

export type ModuleSummary = {
  id: string;
  title: string;
  description: string;
  required: boolean;
  navGroup: string;
  i18nKey?: string;
};

export function ModuleToggleForm({
  modules,
  initialEnabled,
}: {
  modules: ModuleSummary[];
  initialEnabled: string[];
}) {
  const t = useTranslations();
  const [enabled, setEnabled] = useState<Set<string>>(() => new Set(initialEnabled));
  const [pending, startTransition] = useTransition();

  const grouped = useMemo(() => {
    const map = new Map<string, ModuleSummary[]>();
    const order: string[] = [];
    for (const m of modules) {
      if (!map.has(m.navGroup)) {
        map.set(m.navGroup, []);
        order.push(m.navGroup);
      }
      map.get(m.navGroup)!.push(m);
    }
    return order.map((title) => ({ title, items: map.get(title)! }));
  }, [modules]);

  const initialSet = useMemo(() => new Set(initialEnabled), [initialEnabled]);
  const dirty = useMemo(() => {
    if (enabled.size !== initialSet.size) return true;
    for (const id of enabled) if (!initialSet.has(id)) return true;
    return false;
  }, [enabled, initialSet]);

  const toggle = (id: string, required: boolean) => {
    if (required) return;
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = () => {
    startTransition(async () => {
      try {
        await setEnabledModules(Array.from(enabled));
        toast.success(t("settings.modules.saved"));
      } catch {
        toast.error(t("settings.modules.saveFailed"));
      }
    });
  };

  const label = (m: ModuleSummary): string =>
    m.i18nKey ? t(m.i18nKey as never) : m.title;

  return (
    <div className="space-y-6">
      {grouped.map((group) => (
        <section key={group.title} className="space-y-3">
          <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.1em]">
            {group.title}
          </h2>
          <Card>
            <CardContent className="divide-y p-0">
              {group.items.map((m) => {
                const checked = enabled.has(m.id);
                const checkboxId = `module-toggle-${m.id}`;
                return (
                  <div key={m.id} className="flex items-start gap-4 p-4">
                    <Checkbox
                      id={checkboxId}
                      checked={checked}
                      disabled={m.required || pending}
                      onCheckedChange={() => toggle(m.id, m.required)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor={checkboxId}
                          className={
                            m.required
                              ? "cursor-default font-medium"
                              : "cursor-pointer font-medium"
                          }
                        >
                          {label(m)}
                        </Label>
                        {m.required ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {t("settings.modules.required")}
                          </Badge>
                        ) : null}
                      </div>
                      {m.description ? (
                        <p className="text-muted-foreground text-sm mt-1">
                          {m.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>
      ))}

      <div className="flex items-center justify-end gap-3 pt-2">
        <p className="text-muted-foreground text-xs">
          {dirty
            ? t("settings.modules.unsavedHint")
            : t("settings.modules.cleanHint")}
        </p>
        <Button onClick={save} disabled={!dirty || pending}>
          {pending ? t("common.loading") : t("settings.modules.save")}
        </Button>
      </div>
    </div>
  );
}
