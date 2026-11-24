import { useEffect } from "react"
import { useFlowsClient } from "./client-context.tsx"
import { acquireTopics, topicToNotification } from "./topics.ts"

/** Forward `namespace/update` params for a topic (e.g. run chunks). */
export function useSubscription(
  topic: string,
  handler: (params: unknown) => void
): void {
  const client = useFlowsClient()

  useEffect(() => {
    return acquireTopics(client, [topic])
  }, [client, topic])

  useEffect(() => {
    const notification = topicToNotification(topic)
    return client.onNotification(notification, handler)
  }, [client, topic, handler])
}
