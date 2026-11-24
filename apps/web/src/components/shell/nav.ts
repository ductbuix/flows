/** Primary app sidebar destinations. */
import {
  BrainCog,
  Folder,
  Inbox,
  Library,
  Link2,
  ListTodo,
  RouteArrowRight,
  type LucideIcon,
} from "lucide-react"

export const APP_NAV: readonly {
  to: string
  label: string
  icon: LucideIcon
}[] = [
  { to: "/docket", label: "Docket", icon: ListTodo },
  { to: "/workflows", label: "Workflows", icon: RouteArrowRight },
  { to: "/inbox", label: "Inbox", icon: Inbox },
  { to: "/files", label: "Files", icon: Folder },
  { to: "/library", label: "Library", icon: Library },
  { to: "/skills", label: "Skills", icon: BrainCog },
  { to: "/connectors", label: "Connectors", icon: Link2 },
]
