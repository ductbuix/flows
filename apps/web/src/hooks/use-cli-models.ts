import { useEffect, useState } from "react"
import { cliModelCatalogSchema, type CliModelCatalog } from "@workspace/shared"
import { api } from "@/lib/api"

type Loaded = {
  cli: "claude" | "cursor"
  catalog: CliModelCatalog | null
  error: string | null
}

/** Load and cache GET /api/cli/:cli/models for the Model Selector. */
export function useCliModels(cli: "claude" | "cursor" | undefined) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    if (!cli) return
    const requested = cli
    let alive = true
    void (async () => {
      const res = await api.cli[":cli"].models.$get({
        param: { cli: requested },
      })
      if (!alive) return
      if (!res.ok) {
        setLoaded({
          cli: requested,
          catalog: null,
          error: "Could not load models",
        })
        return
      }
      const parsed = cliModelCatalogSchema.parse(await res.json())
      setLoaded({
        cli: requested,
        catalog: parsed,
        error: parsed.error ?? null,
      })
    })()
    return () => {
      alive = false
    }
  }, [cli])

  const match = cli !== undefined && loaded?.cli === cli
  return {
    catalog: match ? loaded.catalog : null,
    error: match ? loaded.error : null,
  }
}
