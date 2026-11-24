import { Navigate, Route, Routes, useParams } from "react-router"
import { BrandMockupPage } from "@/pages/brand/BrandMockupPage"
import { BrandPage } from "@/pages/brand/BrandPage"
import { DevKitPage } from "@/pages/DevKitPage"
import { ConnectorsPage } from "@/pages/connectors/ConnectorsPage"
import { SkillsPage } from "@/pages/skills/SkillsPage"
import { RunsPage } from "@/pages/runs/RunsPage"
import { DocketPage } from "@/pages/docket/DocketPage"
import { FilesPage } from "@/pages/files/FilesPage"
import { InboxPage } from "@/pages/inbox/InboxPage"
import { LibraryPage } from "@/pages/library/LibraryPage"
import { MockShell } from "@/pages/mock/MockShell"
import { WorkflowEditorPage } from "@/pages/workflows/WorkflowEditorPage"
import { WorkflowsPage } from "@/pages/workflows/WorkflowsPage"
function MockWorkflowRedirect() {
  const { id } = useParams()
  return <Navigate to={`/workflows/${id ?? ""}`} replace />
}

export function App() {
  return (
    <Routes>
      <Route element={<MockShell />}>
        <Route index element={<Navigate to="/docket" replace />} />
        <Route path="docket" element={<DocketPage />} />
        <Route path="workflows" element={<WorkflowsPage />} />
        <Route path="workflows/:id" element={<WorkflowEditorPage />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="files" element={<FilesPage />} />
        <Route path="library" element={<LibraryPage />} />
        <Route path="skills" element={<SkillsPage />} />
        <Route path="runs" element={<RunsPage />} />
        <Route path="connectors" element={<ConnectorsPage />} />
        <Route path="settings" element={<Navigate to="/docket" replace />} />
        {import.meta.env.DEV ? (
          <Route path="dev/kit" element={<DevKitPage />} />
        ) : null}
        <Route path="brand" element={<BrandPage />} />
        <Route path="brand/:mockupId" element={<BrandMockupPage />} />
      </Route>
      <Route path="mock">
        <Route index element={<Navigate to="/docket" replace />} />
        <Route path="docket" element={<Navigate to="/docket" replace />} />
        <Route
          path="workflows"
          element={<Navigate to="/workflows" replace />}
        />
        <Route path="workflows/:id" element={<MockWorkflowRedirect />} />
        <Route path="inbox" element={<Navigate to="/inbox" replace />} />
        <Route path="files" element={<Navigate to="/files" replace />} />
        <Route path="library" element={<Navigate to="/library" replace />} />
        <Route path="skills" element={<Navigate to="/skills" replace />} />
        <Route path="runs" element={<Navigate to="/runs" replace />} />
        <Route
          path="connectors"
          element={<Navigate to="/connectors" replace />}
        />
      </Route>
    </Routes>
  )
}
