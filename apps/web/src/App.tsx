import { useEffect, useState } from "react"
import type { Health } from "@workspace/shared"
import { api } from "@/lib/api"

export function App() {
  const [health, setHealth] = useState<Health | "down" | null>(null)

  useEffect(() => {
    api.health
      .$get()
      .then(async (res) => setHealth(await res.json()))
      .catch(() => setHealth("down"))
  }, [])

  return (
    <div className="flex min-h-svh p-6">
      <div className="flex max-w-md min-w-0 flex-col gap-2 text-sm">
        <h1 className="font-medium">Flows</h1>
        <p
          className="font-mono text-xs text-muted-foreground"
          data-testid="health"
        >
          {health === null
            ? "checking server"
            : health === "down"
              ? "server down"
              : `server ok v${health.version}`}
        </p>
      </div>
    </div>
  )
}
