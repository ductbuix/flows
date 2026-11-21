import { useEffect, useState } from "react"
import {
  connectionCheckResultSchema,
  connectionsListSchema,
} from "@workspace/shared"
import { api } from "@/lib/api"
import type { ExpiredSignIn } from "./ExpiredSignIns"

/** Connections whose check fails (expired / missing sign-in). */
export function useExpiredSignIns(enabled: boolean): ExpiredSignIn[] {
  const [items, setItems] = useState<ExpiredSignIn[]>([])

  useEffect(() => {
    if (!enabled) {
      setItems([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await api.connections.$get()
        if (!res.ok) return
        const body = connectionsListSchema.parse(await res.json())
        const expired: ExpiredSignIn[] = []
        await Promise.all(
          body.connections.map(async (conn) => {
            const checkRes = await api.connections[":id"].check.$post({
              param: { id: conn.id },
            })
            if (!checkRes.ok) return
            const check = connectionCheckResultSchema.parse(
              await checkRes.json()
            )
            if (!check.ok) {
              expired.push({
                id: conn.id,
                name: conn.name,
                message: check.message,
              })
            }
          })
        )
        if (!cancelled) {
          setItems(expired.sort((a, b) => a.id.localeCompare(b.id)))
        }
      } catch {
        if (!cancelled) setItems([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled])

  return items
}
