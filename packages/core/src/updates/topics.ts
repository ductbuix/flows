import { RUN_LIGHT_KINDS } from "@workspace/contracts"

const LIGHT_RUN_KINDS = new Set<string>(RUN_LIGHT_KINDS)

export type ParsedTopic =
  | { readonly kind: "namespace"; readonly namespace: string }
  | { readonly kind: "scoped"; readonly namespace: string; readonly id: string }

export function parseTopic(topic: string): ParsedTopic {
  const colon = topic.indexOf(":")
  if (colon === -1) {
    return { kind: "namespace", namespace: topic }
  }
  const namespace = topic.slice(0, colon)
  const id = topic.slice(colon + 1)
  if (!namespace || !id) {
    return { kind: "namespace", namespace: topic }
  }
  return { kind: "scoped", namespace, id }
}

export function notificationNamespace(notification: string): string {
  const slash = notification.indexOf("/")
  return slash === -1 ? notification : notification.slice(0, slash)
}

function runIdFromParams(
  params: Record<string, unknown> & { kind: string }
): string | undefined {
  const runId = params.runId
  return typeof runId === "string" && runId.length > 0 ? runId : undefined
}

/** Whether `update` should reach a subscriber on `topic` (DES-040 run filtering). */
export function updateMatchesTopic(
  topic: string,
  notification: string,
  params: Record<string, unknown> & { kind: string }
): boolean {
  const parsed = parseTopic(topic)
  const ns = notificationNamespace(notification)
  if (parsed.namespace !== ns) return false

  if (parsed.namespace !== "run") return true

  if (parsed.kind === "scoped") {
    return runIdFromParams(params) === parsed.id
  }

  return LIGHT_RUN_KINDS.has(params.kind)
}
