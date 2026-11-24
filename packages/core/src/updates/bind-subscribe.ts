import { subscribeMethod, unsubscribeMethod } from "@workspace/contracts"
import type { Disposable } from "../ports/file-watcher.ts"
import { defineBinding, type MethodBindings } from "../rpc/bind.ts"
import { UpdateBus } from "./update-bus.ts"
import type { UpdateNotifyPeer } from "./types.ts"

export function createSubscribeBindings(
  bus: UpdateBus,
  peer: UpdateNotifyPeer,
  peerId: string
): {
  bindings: Pick<MethodBindings, "subscribe" | "unsubscribe">
  dispose: Disposable
} {
  return {
    bindings: {
      subscribe: defineBinding(subscribeMethod, (params) =>
        bus.subscribe(peerId, peer, params)
      ),
      unsubscribe: defineBinding(unsubscribeMethod, (params) =>
        bus.unsubscribe(peerId, params)
      ),
    },
    dispose: {
      dispose() {
        bus.detachPeer(peerId)
      },
    },
  }
}
