import { useEffect, useState } from "react"
import {
  type FcpCallParams,
  type FcpCallResult,
  type FcpMethodName,
} from "@workspace/sdk"
import { useFlowsClient } from "./client-context.tsx"
import {
  acquireTopics,
  topicMatchesNotification,
  topicToNotification,
} from "./topics.ts"

export type UseQueryOptions = {
  readonly topics: readonly string[]
}

export type UseQueryResult<T> = {
  data: T | undefined
  error: unknown
  loading: boolean
}

/** Fetch once, then refetch when a listed topic updates or resyncs. */
export function useQuery<M extends FcpMethodName>(
  method: M,
  params: FcpCallParams<M>,
  options: UseQueryOptions
): UseQueryResult<FcpCallResult<M>> {
  const client = useFlowsClient()
  const [data, setData] = useState<FcpCallResult<M> | undefined>(undefined)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)

  const paramsKey = JSON.stringify(params)
  const topicsKey = options.topics.join("\0")

  useEffect(() => {
    const topics = topicsKey.length === 0 ? [] : topicsKey.split("\0")
    return acquireTopics(client, topics)
  }, [client, topicsKey])

  useEffect(() => {
    let alive = true
    let seq = 0
    const topics = topicsKey.length === 0 ? [] : topicsKey.split("\0")

    async function fetchOnce(): Promise<void> {
      const mine = ++seq
      setLoading(true)
      try {
        const result = await client.call(method, params)
        if (!alive || mine !== seq) return
        setData(result)
        setError(null)
        setLoading(false)
      } catch (err) {
        if (!alive || mine !== seq) return
        setError(err)
        setLoading(false)
      }
    }

    void fetchOnce()

    const notificationNames = [...new Set(topics.map(topicToNotification))]
    const unsubs = notificationNames.map((name) =>
      client.onNotification(name, () => {
        if (topics.some((t) => topicMatchesNotification(t, name))) {
          void fetchOnce()
        }
      })
    )
    const unsubResync = client.on("resync", (topic) => {
      if (topics.includes(topic)) void fetchOnce()
    })

    return () => {
      alive = false
      for (const unsub of unsubs) unsub()
      unsubResync()
    }
    // paramsKey / topicsKey stand in for params and topics identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [client, method, paramsKey, topicsKey])

  return { data, error, loading }
}
