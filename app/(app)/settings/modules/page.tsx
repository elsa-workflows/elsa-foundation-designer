import { getTranslations } from "next-intl/server";

import {
  ModuleToggleForm,
  type ModuleSummary,
} from "@/components/app/module-toggle-form";
import { getEnabledModuleIds } from "@/lib/modules/enabled-store";
import { ALL_MODULES } from "@/lib/modules/registry";

export const dynamic = "force-dynamic";

export default async function ModulesSettingsPage() {
  const t = await getTranslations();
  const enabled = await getEnabledModuleIds();

  const modules: ModuleSummary[] = ALL_MODULES.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description ?? "",
    required: !!m.required,
    navGroup: m.navGroup,
    i18nKey: m.i18nKey,
  }));

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("settings.modules.pageTitle")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t("settings.modules.pageDescription")}
        </p>
      </header>
      <ModuleToggleForm modules={modules} initialEnabled={enabled} />
    </div>
  );
}
