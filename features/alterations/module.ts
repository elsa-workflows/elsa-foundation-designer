import { ClipboardList, GitBranch, ListChecks } from "lucide-react";

import type { StudioModule } from "@/lib/modules/types";

export const alterationsModule: StudioModule = {
  id: "alterations",
  title: "Alterations",
  i18nKey: "modules.alterations.title",
  description: "Modify in-flight workflow instances with alteration plans.",
  navGroup: "General",
  nav: {
    title: "Alterations",
    icon: GitBranch,
    basePath: "/alterations",
    items: [
      { title: "Plans", href: "/alterations/plans", icon: ClipboardList },
      { title: "Instances", href: "/alterations/instances", icon: ListChecks },
    ],
  },
  tint: {
    bg: "bg-violet-500/12",
    fg: "text-violet-600 dark:text-violet-400",
    glow: "shadow-violet-500/30",
  },
  ownedPaths: ["/alterations"],
  required: false,
  defaultEnabled: true,
};
