import { useState } from "react"
import { Outlet } from "react-router"
import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar"
import { SettingsPanel } from "@/pages/settings/SettingsPanel"
import { MockSidebar } from "./MockSidebar"

export function MockShell() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  return (
    <SidebarProvider>
      <MockSidebar onOpenSettings={() => setSettingsOpen(true)} />
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
