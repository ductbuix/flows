import { Link, useLocation } from "react-router"
import { MoreHorizontal } from "lucide-react"
import type { WorkflowSummary } from "@workspace/shared"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import {
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@workspace/ui/components/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

type Props = {
  workflows: WorkflowSummary[] | null
  onRename: (id: string) => void
  onDelete: (id: string) => void
}

function WorkflowListSkeleton() {
  return (
    <SidebarMenu data-testid="sidebar-workflow-loading">
      {Array.from({ length: 5 }, (_, i) => (
        <SidebarMenuItem key={i}>
          <SidebarMenuSkeleton />
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}

function WorkflowListEmpty() {
  return (
    <Empty className="gap-2 border-0 p-2" data-testid="sidebar-workflows-empty">
      <EmptyHeader>
        <EmptyTitle>No workflows</EmptyTitle>
        <EmptyDescription>Create one with the + button above.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

/** Loading, empty, or workflow rows for the sidebar Workflows group. */
export function WorkflowSidebarList({ workflows, onRename, onDelete }: Props) {
  const location = useLocation()

  if (!workflows) return <WorkflowListSkeleton />
  if (workflows.length === 0) return <WorkflowListEmpty />

  return (
    <SidebarMenu data-testid="sidebar-workflow-list">
      {workflows.map((wf) => {
        const active = location.pathname.startsWith(`/workflows/${wf.id}`)
        return (
          <SidebarMenuItem key={wf.id}>
            <SidebarMenuButton
              isActive={active}
              render={<Link to={`/workflows/${wf.id}`} />}
              data-testid={`sidebar-workflow-${wf.id}`}
            >
              <span className="font-mono">{wf.id}</span>
            </SidebarMenuButton>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuAction
                    showOnHover
                    data-testid={`sidebar-workflow-menu-${wf.id}`}
                  />
                }
              >
                <MoreHorizontal />
                <span className="sr-only">Workflow actions</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start">
                <DropdownMenuItem
                  data-testid={`workflow-rename-open-${wf.id}`}
                  onClick={() => onRename(wf.id)}
                >
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  data-testid={`workflow-delete-open-${wf.id}`}
                  onClick={() => onDelete(wf.id)}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}
