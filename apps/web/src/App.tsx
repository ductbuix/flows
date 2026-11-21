import { Outlet, Route, Routes } from "react-router"
import { Toaster } from "@workspace/ui/components/sonner"
import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar"
import { AppSidebar } from "@/components/AppSidebar"
import { WorkflowsProvider } from "@/lib/workflows-context"
import { DevKitPage } from "@/pages/DevKitPage"
import { HomePage } from "@/pages/HomePage"
import { ConnectionPage } from "@/pages/connections/ConnectionPage"
import { ConnectionsPage } from "@/pages/connections/ConnectionsPage"
import { RunsPage } from "@/pages/RunsPage"
import { SettingsPage } from "@/pages/SettingsPage"
import {
  LegacyRunRedirect,
  LegacyWorkflowRunsRedirect,
} from "@/pages/LegacyRedirects"
import { RunViewPage } from "@/pages/run-view/RunViewPage"
import { WorkItemPage } from "@/pages/WorkItemPage"
import { WorkItemsPage } from "@/pages/WorkItemsPage"
import { WorkflowPage } from "@/pages/WorkflowPage"
import { WorkflowsPage } from "@/pages/WorkflowsPage"

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
        <Route path="work-items" element={<WorkItemsPage />} />
        <Route path="work-items/:workItemId" element={<WorkItemPage />} />
        <Route path="connections" element={<ConnectionsPage />} />
        <Route path="connections/:connectionId" element={<ConnectionPage />} />
        <Route path="workflows" element={<WorkflowsPage />} />
        <Route path="workflows/:workflowId" element={<WorkflowPage />} />
        <Route
          path="workflows/:workflowId/runs/:runId"
          element={<LegacyRunRedirect />}
        />
        <Route
          path="workflows/:workflowId/runs"
          element={<LegacyWorkflowRunsRedirect />}
        />
        <Route path="runs" element={<RunsPage />} />
        <Route path="runs/:runId" element={<RunViewPage />} />
      </Route>
    </Routes>
  )
}
