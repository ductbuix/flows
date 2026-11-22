import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router"
import { Plus, Settings } from "lucide-react"
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
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"
import { api } from "@/lib/api"
import { workflowPath } from "@/lib/paths"
import { useWorkflows } from "@/lib/workflows-context"
import { PlatformNav } from "@/components/PlatformNav"
import { WorkflowSidebarList } from "@/components/WorkflowSidebarList"
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
          <PlatformNav />
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
              <WorkflowSidebarList
                onCreate={() => setCreateOpen(true)}
                workflows={workflows}
                onRename={setRenameId}
                onDelete={(id) => void openDelete(id)}
              />
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
          void reload().then(() => navigate(workflowPath(id)))
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
              if (location.pathname.startsWith(workflowPath(oldId))) {
                navigate(
                  `${location.pathname.replace(
                    workflowPath(oldId),
                    workflowPath(newId)
                  )}${location.search}`
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
              if (location.pathname.startsWith(workflowPath(deleteTarget.id)))
                navigate("/")
            })
          }}
        />
      ) : null}
    </>
  )
}
