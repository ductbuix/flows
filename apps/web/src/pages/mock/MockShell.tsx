import { Outlet } from "react-router"
import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar"
import { MockSidebar } from "./MockSidebar"

export function MockShell() {
  return (
    <SidebarProvider>
      <MockSidebar />
      <SidebarInset className="flex h-svh flex-col overflow-hidden">
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )
}
