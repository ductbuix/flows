import { useNavigate } from "react-router"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { type ConnectionsTab, connectionsPath } from "@/lib/paths"

type Props = {
  tab: ConnectionsTab
}

/** Line tabs: Connections | Library (DES-025 / BL-045). */
export function ConnectionsTabs({ tab }: Props) {
  const navigate = useNavigate()

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        if (value === "connections" || value === "library") {
          void navigate(connectionsPath(value))
        }
      }}
      className="gap-0"
    >
      <TabsList variant="line" data-testid="connections-tabs">
        <TabsTrigger
          value="connections"
          data-testid="connections-tab-connections"
        >
          Connections
        </TabsTrigger>
        <TabsTrigger value="library" data-testid="connections-tab-library">
          Library
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
