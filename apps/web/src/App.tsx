import { Outlet, Route, Routes } from "react-router"
import { Toaster } from "@workspace/ui/components/sonner"
import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar"
import { AppSidebar } from "@/components/AppSidebar"
import { WorkflowsProvider } from "@/lib/workflows-context"
import { BrandMockupPage } from "@/pages/brand/BrandMockupPage"
import { BrandPage } from "@/pages/brand/BrandPage"
import { DevKitPage } from "@/pages/DevKitPage"
import { HomePage } from "@/pages/HomePage"
import { ConnectionPage } from "@/pages/connections/ConnectionPage"
import { ConnectionsPage } from "@/pages/connections/ConnectionsPage"
import { ConnectorsPage } from "@/pages/mock/ConnectorsPage"
import { SkillsPage } from "@/pages/skills/SkillsPage"
import { DocketPage } from "@/pages/docket/DocketPage"
import { FilesPage } from "@/pages/files/FilesPage"
import { LibraryPage } from "@/pages/mock/LibraryPage"
import { InboxPage } from "@/pages/inbox/InboxPage"
import { MockBlankPage } from "@/pages/mock/MockBlankPage"
import { MockShell } from "@/pages/mock/MockShell"
import { WorkflowEditorPage as MockWorkflowEditorPage } from "@/pages/workflows/WorkflowEditorPage"
import { WorkflowsPage as MockWorkflowsPage } from "@/pages/workflows/WorkflowsPage"
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
      <Route path="mock" element={<MockShell />}>
        <Route index element={<MockBlankPage />} />
        <Route path="docket" element={<DocketPage />} />
        <Route path="workflows" element={<MockWorkflowsPage />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="files" element={<FilesPage />} />
        <Route path="library" element={<LibraryPage />} />
        <Route path="skills" element={<SkillsPage />} />
        <Route path="connectors" element={<ConnectorsPage />} />
        <Route path="workflows/:id" element={<MockWorkflowEditorPage />} />
      </Route>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="settings" element={<SettingsPage />} />
        {import.meta.env.DEV ? (
          <Route path="dev/kit" element={<DevKitPage />} />
        ) : null}
        <Route path="brand" element={<BrandPage />} />
        <Route path="brand/:mockupId" element={<BrandMockupPage />} />
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
