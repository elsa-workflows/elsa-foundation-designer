import { Activity, FileBox, Workflow } from "lucide-react";

import type { StudioModule } from "@/lib/modules/types";

export const workflowsModule: StudioModule = {
  id: "workflows",
  title: "Workflows",
  i18nKey: "modules.workflows.title",
  description: "Design, publish and run workflow definitions and inspect instances.",
  navGroup: "General",
  nav: {
    title: "Workflows",
    icon: Workflow,
    basePath: "/workflows",
    items: [
      { title: "Definitions", href: "/workflows/definitions", icon: FileBox },
      { title: "Instances", href: "/workflows/instances", icon: Activity},
    ],
  },
  tint: {
    bg: "bg-blue-500/12",
    fg: "text-blue-600 dark:text-blue-400",
    glow: "shadow-blue-500/30",
  },
  ownedPaths: ["/workflows"],
  required: true,
  defaultEnabled: true,
};
