import { useEffect, useState } from "react"
import { healthSchema } from "@workspace/shared"
import { api } from "@/lib/api"

let cached: Promise<boolean> | undefined

/** Whether the server runs with FLOWS_NODES=1 (DES-037 Rollout); read once. */
function loadNodesEnabled(): Promise<boolean> {
  cached ??= api.health
    .$get()
    .then(async (res) =>
      res.ok ? healthSchema.parse(await res.json()).nodes === true : false
    )
    .catch(() => {
      cached = undefined
      return false
    })
  return cached
}

/** `undefined` while loading, then the flag. */
export function useNodesEnabled(): boolean | undefined {
  const [enabled, setEnabled] = useState<boolean | undefined>(undefined)
  useEffect(() => {
    let alive = true
    void loadNodesEnabled().then((v) => {
      if (alive) setEnabled(v)
    })
    return () => {
      alive = false
    }
  }, [])
  return enabled
}
