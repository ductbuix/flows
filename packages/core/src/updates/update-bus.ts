import type { FcpMethodParams, FcpMethodResult } from "@workspace/contracts"
import {
  unsubscribeMethod,
  type subscribeMethod as SubscribeMethodDef,
} from "@workspace/contracts"
import { updateMatchesTopic } from "./topics.ts"
import type { BufferedUpdate, UpdateNotifyPeer } from "./types.ts"

const DEFAULT_REPLAY_BUFFER_SIZE = 500

export type UpdateBusOptions = {
  readonly replayBufferSize?: number
}

type PeerSubscription = {
  readonly peer: UpdateNotifyPeer
  readonly topics: Set<string>
}

export class UpdateBus {
  private readonly replayBufferSize: number
  private readonly buffer: BufferedUpdate[] = []
  private readonly peers = new Map<string, PeerSubscription>()
  private seq = 0

  constructor(options?: UpdateBusOptions) {
    const size = options?.replayBufferSize ?? DEFAULT_REPLAY_BUFFER_SIZE
    this.replayBufferSize = Math.max(1, size)
  }

  currentSeq(): number {
    return this.seq
  }

  publish(
    notification: string,
    params: Record<string, unknown> & { kind: string }
  ): BufferedUpdate {
    const seq = ++this.seq
    const stamped = { ...params, seq }
    const update: BufferedUpdate = { seq, notification, params: stamped }
    this.pushBuffer(update)
    this.fanOut(update)
    return update
  }

  subscribe(
    peerId: string,
    peer: UpdateNotifyPeer,
    params: FcpMethodParams<typeof SubscribeMethodDef>
  ): FcpMethodResult<typeof SubscribeMethodDef> {
    let sub = this.peers.get(peerId)
    if (!sub) {
      sub = { peer, topics: new Set() }
      this.peers.set(peerId, sub)
    }
    for (const topic of params.topics) {
      sub.topics.add(topic)
    }

    const resync: string[] = []
    const bufferMin = this.bufferMinSeq()
    if (params.since !== undefined) {
      for (const topic of params.topics) {
        if (params.since + 1 < bufferMin) {
          resync.push(topic)
        }
      }
      const replay = this.buffer.filter(
        (u) => params.since !== undefined && u.seq > params.since
      )
      for (const update of replay) {
        if (this.peerWantsUpdate(sub.topics, update)) {
          sub.peer.notify(update.notification, update.params)
        }
      }
    }

    return { seq: this.seq, resync }
  }

  unsubscribe(
    peerId: string,
    params: FcpMethodParams<typeof unsubscribeMethod>
  ): FcpMethodResult<typeof unsubscribeMethod> {
    const sub = this.peers.get(peerId)
    if (!sub) return {}
    for (const topic of params.topics) {
      sub.topics.delete(topic)
    }
    if (sub.topics.size === 0) {
      this.peers.delete(peerId)
    }
    return {}
  }

  detachPeer(peerId: string): void {
    this.peers.delete(peerId)
  }

  private pushBuffer(update: BufferedUpdate): void {
    this.buffer.push(update)
    while (this.buffer.length > this.replayBufferSize) {
      this.buffer.shift()
    }
  }

  private bufferMinSeq(): number {
    return this.buffer[0]?.seq ?? this.seq + 1
  }

  private fanOut(update: BufferedUpdate): void {
    for (const sub of this.peers.values()) {
      if (!this.peerWantsUpdate(sub.topics, update)) continue
      sub.peer.notify(update.notification, update.params)
    }
  }

  private peerWantsUpdate(
    topics: Set<string>,
    update: BufferedUpdate
  ): boolean {
    for (const topic of topics) {
      if (updateMatchesTopic(topic, update.notification, update.params)) {
        return true
      }
    }
    return false
  }
}
