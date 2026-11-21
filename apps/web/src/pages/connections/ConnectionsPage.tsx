import { useState } from "react"
import { useSearchParams } from "react-router"
import { Button } from "@workspace/ui/components/button"
import { PageHeader } from "@/components/PageHeader"
import { PageTitle } from "@/components/PageTitle"
import { parseConnectionsTab } from "@/lib/paths"
import { ConnectionsListTab } from "./ConnectionsListTab"
import { ConnectionsTabs } from "./ConnectionsTabs"
import { LibraryTab } from "./LibraryTab"

/** Connections page with Connections / Library tabs (BL-045). */
export function ConnectionsPage() {
  const [searchParams] = useSearchParams()
  const tab = parseConnectionsTab(searchParams.get("tab")) ?? "connections"
  const [addOpen, setAddOpen] = useState(false)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        crumbs={[{ label: "Connections" }]}
        actions={
          tab === "connections" ? (
            <Button
              size="sm"
              data-testid="connections-add"
              onClick={() => setAddOpen(true)}
            >
              Add connection
            </Button>
          ) : null
        }
      />
      <div
        className="flex flex-1 flex-col gap-6 overflow-auto p-6"
        data-testid="connections-page"
      >
        <PageTitle
          title="Connections"
          description="Connect sources, pull into the Library, and decide how changes go back."
        />
        <ConnectionsTabs tab={tab} />
        {tab === "library" ? (
          <LibraryTab />
        ) : (
          <ConnectionsListTab addOpen={addOpen} onAddOpenChange={setAddOpen} />
        )}
      </div>
    </div>
  )
}
