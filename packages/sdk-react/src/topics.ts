import type { FlowsClient, FcpNotificationName } from "@workspace/sdk"

/** Map a subscribe topic (`docket`, `run:r-1`) to its `namespace/update` name. */
export function topicToNotification(topic: string): FcpNotificationName {
  const ns = topic.split(":")[0] ?? topic
  return `${ns}/update` as FcpNotificationName
}

/** True when a topic listens for this notification (engine filters by id). */
export function topicMatchesNotification(
  topic: string,
  notification: string
): boolean {
  const ns = notification.endsWith("/update")
    ? notification.slice(0, -"/update".length)
    : (notification.split("/")[0] ?? notification)
  return topic === ns || topic.startsWith(`${ns}:`)
}

type LeaseState = { counts: Map<string, number> }

const leases = new WeakMap<FlowsClient, LeaseState>()

function leaseState(client: FlowsClient): LeaseState {
  let state = leases.get(client)
  if (!state) {
    state = { counts: new Map() }
    leases.set(client, state)
  }
  return state
}

/**
 * Ref-counted subscribe so overlapping hooks share a topic without
 * one unmount dropping it for the others.
 */
export function acquireTopics(
  client: FlowsClient,
  topics: readonly string[]
): () => void {
  if (topics.length === 0) return () => {}
  const state = leaseState(client)
  const acquired: string[] = []
  for (const topic of topics) {
    const next = (state.counts.get(topic) ?? 0) + 1
    state.counts.set(topic, next)
    if (next === 1) acquired.push(topic)
  }
  if (acquired.length > 0) {
    void client.call("subscribe", { topics: acquired })
  }
  return () => {
    const released: string[] = []
    for (const topic of topics) {
      const next = (state.counts.get(topic) ?? 1) - 1
      if (next <= 0) {
        state.counts.delete(topic)
        released.push(topic)
      } else {
        state.counts.set(topic, next)
      }
    }
    if (released.length > 0) {
      void client.call("unsubscribe", { topics: released })
    }
  }
}
