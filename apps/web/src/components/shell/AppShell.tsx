import { useState } from "react"
import { Outlet } from "react-router"
import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar"
import { SettingsPanel } from "@/pages/settings/SettingsPanel"
import { AppSidebar } from "./AppSidebar"

export function AppShell() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  return (
    <SidebarProvider>
      <AppSidebar onOpenSettings={() => setSettingsOpen(true)} />
      <SidebarInset className="flex h-svh flex-col overflow-hidden">
        <Outlet />
      </SidebarInset>
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </SidebarProvider>
  )
}
