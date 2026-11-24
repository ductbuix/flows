import { Readable, Writable } from "node:stream"
import type { RunningProcess } from "@workspace/core"
import { RpcPeer } from "@workspace/protocol"
import { ndjsonTransport } from "@workspace/protocol/node"

/** Bridge ProcessRunner web stdio to an ACP RpcPeer. */
export function peerFromProcess(proc: RunningProcess): RpcPeer {
  const stdout = Readable.fromWeb(
    proc.stdout as import("node:stream/web").ReadableStream
  )
  const stdin = Writable.fromWeb(
    proc.stdin as import("node:stream/web").WritableStream
  )
  return new RpcPeer(ndjsonTransport(stdout, stdin))
}
