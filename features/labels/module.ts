import { Tag } from "lucide-react";

import type { StudioModule } from "@/lib/modules/types";

export const labelsModule: StudioModule = {
  id: "labels",
  title: "Labels",
  i18nKey: "modules.labels.title",
  description: "Manage labels used to categorise workflow definitions and instances.",
  navGroup: "Settings",
  nav: {
    title: "Labels",
    href: "/labels",
    icon: Tag,
    placeholder: true,
  },
  tint: {
    bg: "bg-pink-500/12",
    fg: "text-pink-600 dark:text-pink-400",
    glow: "shadow-pink-500/30",
  },
  ownedPaths: ["/labels"],
  required: false,
  defaultEnabled: true,
};
