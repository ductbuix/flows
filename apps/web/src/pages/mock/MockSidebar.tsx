import { Link, useLocation } from "react-router"
import { File } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@workspace/ui/components/sidebar"
import { useRuns } from "./runs-store"
import { MOCK_CHANGES } from "./mock-data"

/** Sidebar 11 layout (shadcn blocks), reworked for Flows. */
export function MockSidebar() {
  const { pathname } = useLocation()
  const waiting = useRuns().filter((r) => r.tone === "attention" && !r.decision).length
  return (
    <Sidebar data-testid="mock-sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link to="/mock" />}>
              <span className="font-heading font-medium">Flows</span>
              <span className="text-xs text-muted-foreground">mockup</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Changes</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {MOCK_CHANGES.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    render={<Link to={item.to} />}
                    isActive={pathname === item.to}
                  >
                    <File />
                    {item.label}
                  </SidebarMenuButton>
                  <SidebarMenuBadge>
                    {item.label === "Inbox" && waiting > 0 ? waiting : item.badge}
                  </SidebarMenuBadge>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
