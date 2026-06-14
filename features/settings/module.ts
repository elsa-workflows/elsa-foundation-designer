import { Plug, SlidersHorizontal } from "lucide-react";

import type { StudioModule } from "@/lib/modules/types";

export const settingsModule: StudioModule = {
  id: "settings",
  title: "Settings",
  i18nKey: "modules.settings.title",
  description: "Studio configuration: modules and backend connection health.",
  navGroup: "Settings",
  nav: {
    title: "Settings",
    icon: SlidersHorizontal,
    basePath: "/settings",
    items: [
      { title: "Modules", href: "/settings/modules", icon: SlidersHorizontal },
      { title: "Connection", href: "/settings/connection", icon: Plug },
    ],
  },
  tint: {
    bg: "bg-slate-500/12",
    fg: "text-slate-600 dark:text-slate-400",
    glow: "shadow-slate-500/30",
  },
  ownedPaths: ["/settings"],
  required: true,
  defaultEnabled: true,
};
