import { FileText, Stethoscope, Terminal } from "lucide-react";

import type { StudioModule } from "@/lib/modules/types";

export const diagnosticsModule: StudioModule = {
  id: "diagnostics",
  title: "Diagnostics",
  i18nKey: "modules.diagnostics.title",
  description: "Structured logs and a live console for troubleshooting the server.",
  navGroup: "Diagnostics",
  nav: {
    title: "Diagnostics",
    icon: Stethoscope,
    basePath: "/diagnostics",
    items: [
      { title: "Structured Logs", href: "/diagnostics/logs", icon: FileText, placeholder: true },
      { title: "Console", href: "/diagnostics/console", icon: Terminal, placeholder: true },
    ],
  },
  tint: {
    bg: "bg-emerald-500/12",
    fg: "text-emerald-600 dark:text-emerald-400",
    glow: "shadow-emerald-500/30",
  },
  ownedPaths: ["/diagnostics"],
  required: false,
  defaultEnabled: true,
};
