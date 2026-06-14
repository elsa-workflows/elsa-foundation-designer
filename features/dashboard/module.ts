import { LayoutDashboard } from "lucide-react";

import type { StudioModule } from "@/lib/modules/types";

export const dashboardModule: StudioModule = {
  id: "dashboard",
  title: "Dashboard",
  i18nKey: "modules.dashboard.title",
  description: "Overview, recent activity and at-a-glance health checks.",
  navGroup: "General",
  nav: {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  tint: {
    bg: "bg-sky-500/12",
    fg: "text-sky-600 dark:text-sky-400",
    glow: "shadow-sky-500/30",
  },
  ownedPaths: ["/dashboard"],
  required: true,
  defaultEnabled: true,
};
