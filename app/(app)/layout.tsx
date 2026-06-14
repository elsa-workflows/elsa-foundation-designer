import { AppHeader } from "@/components/app/shell/app-header";
import { AppSidebar } from "@/components/app/shell/app-sidebar";
import { NavProvider } from "@/components/app/nav-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getEnabledModuleIds } from "@/lib/modules/enabled-store";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const enabledIds = await getEnabledModuleIds();
  return (
    <SidebarProvider
      // Wider sidebar so coloured icon tiles, action button and search input
      // get real estate to breathe. Icon-collapsed rail stays at 3 rem.
      style={{ "--sidebar-width": "18.5rem" } as React.CSSProperties}
    >
      <NavProvider enabledIds={enabledIds}>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <div className="flex flex-1 flex-col">{children}</div>
        </SidebarInset>
      </NavProvider>
    </SidebarProvider>
  );
}
