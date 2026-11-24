import { randomBytes } from "node:crypto"
import { acquireLock, releaseLock } from "@workspace/adapters-node"
import { createEngine } from "@workspace/adapters-node"
import { ndjsonTransport } from "@workspace/protocol/node"
import { bindFcpTransport, createFcpHost } from "server/fcp-host"
import { engineBusyMessage, INPROC_URL, isInprocUrl } from "./session.ts"

/** Serve FCP over stdin/stdout (DES-040 stdio transport). Takes engine.lock. */
export function serveEngineStdio(home: string): void {
  const lock = acquireLock(home, {
    url: INPROC_URL,
    token: randomBytes(32).toString("base64url"),
  })
  if ("attachTo" in lock) {
    throw new Error(
      isInprocUrl(lock.attachTo.url)
        ? engineBusyMessage(lock.attachTo.pid)
        : `FLOWAPP_HOME already owned at ${lock.attachTo.url}`
    )
  }

  const engine = createEngine({ home })
  const host = createFcpHost(engine)
  const transport = ndjsonTransport(process.stdin, process.stdout)

  let closed = false
  const shutdown = () => {
    if (closed) return
    closed = true
    host.dispose()
    engine.close()
    releaseLock(home)
  }

  bindFcpTransport(transport, engine, host)
  transport.onClose(shutdown)
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      shutdown()
      process.exit(0)
    })
  }
}
