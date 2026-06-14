import { Shield, ShieldCheck, Users } from "lucide-react";

import type { StudioModule } from "@/lib/modules/types";

export const securityModule: StudioModule = {
  id: "security",
  title: "Security",
  i18nKey: "modules.security.title",
  description: "User accounts and role assignments for the studio.",
  navGroup: "Settings",
  nav: {
    title: "Security",
    icon: Shield,
    basePath: "/security",
    items: [
      { title: "Users", href: "/security/users", icon: Users, placeholder: true },
      { title: "Roles", href: "/security/roles", icon: ShieldCheck, placeholder: true },
    ],
  },
  tint: {
    bg: "bg-amber-500/12",
    fg: "text-amber-600 dark:text-amber-400",
    glow: "shadow-amber-500/30",
  },
  ownedPaths: ["/security"],
  required: false,
  defaultEnabled: true,
};
