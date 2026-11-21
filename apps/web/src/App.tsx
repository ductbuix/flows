import { Outlet, Route, Routes } from "react-router"
import { Toaster } from "@workspace/ui/components/sonner"
import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar"
import { AppSidebar } from "@/components/AppSidebar"
import { WorkflowsProvider } from "@/lib/workflows-context"
import { DevKitPage } from "@/pages/DevKitPage"
import { HomePage } from "@/pages/HomePage"
import { SettingsPage } from "@/pages/SettingsPage"
import { WorkflowRunsPage } from "@/pages/WorkflowRunsPage"
import { RunViewPage } from "@/pages/run-view/RunViewPage"
import { WorkflowEditorPage } from "@/pages/editor/WorkflowEditorPage"

function AppShell() {
  return (
    <WorkflowsProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="flex h-svh flex-col overflow-hidden">
          <Outlet />
        </SidebarInset>
        <Toaster />
      </SidebarProvider>
    </WorkflowsProvider>
  )
}

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="settings" element={<SettingsPage />} />
        {import.meta.env.DEV ? (
          <Route path="dev/kit" element={<DevKitPage />} />
        ) : null}
        <Route path="workflows/:workflowId" element={<WorkflowEditorPage />} />
        <Route
          path="workflows/:workflowId/runs"
          element={<WorkflowRunsPage />}
        />
        <Route
          path="workflows/:workflowId/runs/:runId"
          element={<RunViewPage />}
        />
      </Route>
    </Routes>
  )
}
