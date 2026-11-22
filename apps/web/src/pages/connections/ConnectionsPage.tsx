import { useState } from "react"
import { useSearchParams } from "react-router"
import { Button } from "@workspace/ui/components/button"
import { Page, PageTitle } from "@/components/page"
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
    <Page
      crumbs={[{ label: "Connections" }]}
      data-testid="connections-page"
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
    </Page>
  )
}
