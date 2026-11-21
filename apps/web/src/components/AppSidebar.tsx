import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router"
import { MoreHorizontal, Plus, Settings } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { api } from "@/lib/api"
import { useWorkflows } from "@/lib/workflows-context"
import { CreateWorkflowDialog } from "@/pages/CreateWorkflowDialog"
import { DeleteWorkflowDialog } from "@/pages/DeleteWorkflowDialog"
import { RenameWorkflowDialog } from "@/pages/RenameWorkflowDialog"

export function AppSidebar() {
  const { workflows, reload } = useWorkflows()
  const location = useLocation()
  const navigate = useNavigate()
  const [createOpen, setCreateOpen] = useState(false)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    runCount: number
  } | null>(null)

  async function openDelete(id: string) {
    const res = await api.workflows[":workflowId"].runs.$get({
      param: { workflowId: id },
    })
    const runCount = res.ok ? ((await res.json()) as unknown[]).length : 0
    setDeleteTarget({ id, runCount })
  }

  return (
    <>
      <Sidebar collapsible="offcanvas" data-testid="app-sidebar">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton render={<Link to="/" />} tooltip="Flows">
                <span className="font-heading font-medium">Flows</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workflows</SidebarGroupLabel>
            <SidebarGroupAction
              title="Create workflow"
              data-testid="workflow-create-open"
              onClick={() => setCreateOpen(true)}
            >
              <Plus />
              <span className="sr-only">Create workflow</span>
            </SidebarGroupAction>
            <SidebarGroupContent>
              {!workflows ? (
                <div className="space-y-2 px-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (
                <SidebarMenu data-testid="sidebar-workflow-list">
                  {workflows.map((wf) => {
                    const active = location.pathname.startsWith(
                      `/workflows/${wf.id}`
                    )
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
                              onClick={() => setRenameId(wf.id)}
                            >
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              data-testid={`workflow-delete-open-${wf.id}`}
                              onClick={() => void openDelete(wf.id)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={location.pathname === "/settings"}
                render={<Link to="/settings" />}
                data-testid="sidebar-settings"
              >
                <Settings />
                <span>Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <CreateWorkflowDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => {
          void reload().then(() => navigate(`/workflows/${id}`))
        }}
      />
      {renameId ? (
        <RenameWorkflowDialog
          open
          workflowId={renameId}
          onOpenChange={(open) => !open && setRenameId(null)}
          onRenamed={(newId) => {
            const oldId = renameId
            setRenameId(null)
            void reload().then(() => {
              if (location.pathname.includes(oldId)) {
                navigate(
                  location.pathname.replace(
                    `/workflows/${oldId}`,
                    `/workflows/${newId}`
                  )
                )
              }
            })
          }}
        />
      ) : null}
      {deleteTarget ? (
        <DeleteWorkflowDialog
          open
          workflowId={deleteTarget.id}
          runCount={deleteTarget.runCount}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null)
            void reload().then(() => {
              if (location.pathname.startsWith(`/workflows/${deleteTarget.id}`))
                navigate("/")
            })
          }}
        />
      ) : null}
    </>
  )
}
