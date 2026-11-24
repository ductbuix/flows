import { Readable, Writable } from "node:stream"
import type { RunningProcess } from "@workspace/core"
import { RpcPeer, type Transport } from "@workspace/protocol"
import { ndjsonTransport } from "@workspace/protocol/node"
import { loggingTransport, type AcpLogSink } from "./acp-log.ts"

export type PeerFromProcessOptions = {
  acpLog?: AcpLogSink
  secrets?: readonly string[]
}

/** Bridge ProcessRunner web stdio to an ACP RpcPeer. */
export function peerFromProcess(
  proc: RunningProcess,
  options?: PeerFromProcessOptions
): RpcPeer {
  const stdout = Readable.fromWeb(
    proc.stdout as import("node:stream/web").ReadableStream
  )
  const stdin = Writable.fromWeb(
    proc.stdin as import("node:stream/web").WritableStream
  )
  let transport: Transport = ndjsonTransport(stdout, stdin)
  if (options?.acpLog) {
    transport = loggingTransport(
      transport,
      options.acpLog,
      options.secrets ?? []
    )
  }
  return new RpcPeer(transport)
}
