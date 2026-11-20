import { Link, Outlet, Route, Routes } from "react-router"
import { HomePage } from "@/pages/HomePage"
import { WorkflowRunsPage } from "@/pages/WorkflowRunsPage"
import { RunViewPage } from "@/pages/run-view/RunViewPage"

function AppShell() {
  return (
    <div className="flex min-h-svh">
      <nav className="w-44 shrink-0 border-r p-4 text-sm">
        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">
          Flows
        </p>
        <ul className="space-y-1">
          <li>
            <Link
              to="/"
              className="text-foreground underline-offset-4 hover:underline"
            >
              Workflows
            </Link>
          </li>
        </ul>
      </nav>
      <main className="min-w-0 flex-1 p-6">
        <Outlet />
      </main>
    </div>
  )
}

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="workflows/:workflowId" element={<WorkflowRunsPage />} />
        <Route
          path="workflows/:workflowId/runs/:runId"
          element={<RunViewPage />}
        />
      </Route>
    </Routes>
  )
}
