import { Navigate, Route, Routes } from "react-router"
import { BrandMockupPage } from "@/pages/brand/BrandMockupPage"
import { BrandPage } from "@/pages/brand/BrandPage"
import { DevKitPage } from "@/pages/DevKitPage"
import { ConnectorsPage } from "@/pages/connectors/ConnectorsPage"
import { SkillsPage } from "@/pages/skills/SkillsPage"
import { DocketPage } from "@/pages/docket/DocketPage"
import { FilesPage } from "@/pages/files/FilesPage"
import { InboxPage } from "@/pages/inbox/InboxPage"
import { LibraryPage } from "@/pages/library/LibraryPage"
import { AppShell } from "@/components/shell/AppShell"
import { WorkflowEditorPage } from "@/pages/workflows/WorkflowEditorPage"
import { WorkflowsPage } from "@/pages/workflows/WorkflowsPage"

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/docket" replace />} />
        <Route path="docket" element={<DocketPage />} />
        <Route path="workflows" element={<WorkflowsPage />} />
        <Route path="workflows/:id" element={<WorkflowEditorPage />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="files" element={<FilesPage />} />
        <Route path="library" element={<LibraryPage />} />
        <Route path="skills" element={<SkillsPage />} />
        <Route path="connectors" element={<ConnectorsPage />} />
        {import.meta.env.DEV ? (
          <Route path="dev/kit" element={<DevKitPage />} />
        ) : null}
        <Route path="brand" element={<BrandPage />} />
        <Route path="brand/:mockupId" element={<BrandMockupPage />} />
      </Route>
    </Routes>
  )
}
