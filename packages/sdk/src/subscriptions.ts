import {
  subscribeMethod,
  unsubscribeMethod,
  type FcpMethodParams,
  type FcpMethodResult,
} from "@workspace/contracts"

export type SubscribeParams = FcpMethodParams<typeof subscribeMethod>
export type SubscribeResult = FcpMethodResult<typeof subscribeMethod>
export type UnsubscribeParams = FcpMethodParams<typeof unsubscribeMethod>

export type SubscriptionTracker = {
  noteParamsSeq(params: unknown): void
  onSubscribe(params: SubscribeParams, result: SubscribeResult): void
  onUnsubscribe(params: UnsubscribeParams): void
  resubscribeParams(): SubscribeParams | undefined
}

/** Tracks topics and the highest engine `seq` seen on this client connection. */
export function createSubscriptionTracker(
  emitResync: (topic: string) => void
): SubscriptionTracker {
  const topics = new Set<string>()
  let lastSeq: number | undefined

  function noteSeq(seq: number): void {
    lastSeq = lastSeq === undefined ? seq : Math.max(lastSeq, seq)
  }

  return {
    noteParamsSeq(params) {
      if (!params || typeof params !== "object") return
      const seq = (params as { seq?: unknown }).seq
      if (typeof seq === "number" && Number.isFinite(seq) && seq >= 0) {
        noteSeq(seq)
      }
    },
    onSubscribe(params, result) {
      for (const topic of params.topics) topics.add(topic)
      noteSeq(result.seq)
      for (const topic of result.resync) emitResync(topic)
    },
    onUnsubscribe(params) {
      for (const topic of params.topics) topics.delete(topic)
    },
    resubscribeParams() {
      if (topics.size === 0) return undefined
      return {
        topics: [...topics],
        ...(lastSeq !== undefined ? { since: lastSeq } : {}),
      }
    },
  }
}
