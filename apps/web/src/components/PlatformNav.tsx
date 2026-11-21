import { Link, useLocation } from "react-router"
import { Briefcase, Cable, Home, Layers, Play } from "lucide-react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"

const ITEMS = [
  { to: "/", label: "Home", testId: "sidebar-home", icon: Home, match: "home" },
  {
    to: "/work-items",
    label: "Work items",
    testId: "sidebar-platform-work-items",
    icon: Briefcase,
    match: "work-items",
  },
  {
    to: "/workflows",
    label: "Workflows",
    testId: "sidebar-platform-workflows",
    icon: Layers,
    match: "workflows",
  },
  {
    to: "/runs",
    label: "Runs",
    testId: "sidebar-platform-runs",
    icon: Play,
    match: "runs",
  },
  {
    to: "/connections",
    label: "Connections",
    testId: "sidebar-platform-connections",
    icon: Cable,
    match: "connections",
  },
] as const

function isActive(pathname: string, match: (typeof ITEMS)[number]["match"]) {
  if (match === "home") return pathname === "/"
  if (match === "work-items") {
    return pathname === "/work-items" || pathname.startsWith("/work-items/")
  }
  if (match === "workflows") {
    return pathname === "/workflows" || pathname.startsWith("/workflows/")
  }
  if (match === "connections") {
    return pathname === "/connections" || pathname.startsWith("/connections/")
  }
  return pathname === "/runs" || pathname.startsWith("/runs/")
}

/** Platform group: Home, Work items, Workflows, Runs, Connections (DES-025). */
export function PlatformNav() {
  const { pathname } = useLocation()

  return (
    <SidebarGroup data-testid="sidebar-platform">
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton
                  isActive={isActive(pathname, item.match)}
                  render={<Link to={item.to} />}
                  data-testid={item.testId}
                >
                  <Icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
