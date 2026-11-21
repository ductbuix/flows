import { Outlet, Route, Routes } from "react-router"
import { Toaster } from "@workspace/ui/components/sonner"
import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar"
import { AppSidebar } from "@/components/AppSidebar"
import { WorkflowsProvider } from "@/lib/workflows-context"
import { HomePage } from "@/pages/HomePage"
import { SettingsPage } from "@/pages/SettingsPage"
import {
  LegacyRunRedirect,
  LegacyWorkflowRunsRedirect,
} from "@/pages/LegacyRedirects"
import { RunViewPage } from "@/pages/run-view/RunViewPage"
import { WorkflowPage } from "@/pages/WorkflowPage"

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
        <Route path="workflows/:workflowId" element={<WorkflowPage />} />
        <Route
          path="workflows/:workflowId/runs/:runId"
          element={<LegacyRunRedirect />}
        />
        <Route
          path="workflows/:workflowId/runs"
          element={<LegacyWorkflowRunsRedirect />}
        />
        <Route path="runs/:runId" element={<RunViewPage />} />
      </Route>
    </Routes>
  )
}
