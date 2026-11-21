import { useEffect, useState } from "react"
import { cliModelCatalogSchema, type CliModelCatalog } from "@workspace/shared"
import { api } from "@/lib/api"

/** Load and cache GET /api/cli/:cli/models for the Model Selector. */
export function useCliModels(cli: "claude" | "cursor" | undefined) {
  const [catalog, setCatalog] = useState<CliModelCatalog | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!cli) {
      setCatalog(null)
      setError(null)
      return
    }
    let alive = true
    setCatalog(null)
    setError(null)
    void (async () => {
      const res = await api.cli[":cli"].models.$get({ param: { cli } })
      if (!alive) return
      if (!res.ok) {
        setError("Could not load models")
        return
      }
      const parsed = cliModelCatalogSchema.parse(await res.json())
      setCatalog(parsed)
      if (parsed.error) setError(parsed.error)
    })()
    return () => {
      alive = false
    }
  }, [cli])

  return { catalog, error }
}
