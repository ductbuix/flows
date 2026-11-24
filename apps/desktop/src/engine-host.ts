import { acquireLock, releaseLock, resolveAppHome } from "@workspace/adapters-node"
import type { MessagePortLike } from "@workspace/protocol"
import { randomBytes } from "node:crypto"
import { composeDesktopEngine } from "./compose-engine.ts"

/**
 * Electron utilityProcess entry. Main sends `{ type: "connect" }` with a
 * transferred MessagePortMain for each renderer FCP session.
 */
const home = resolveAppHome()

const lockToken = randomBytes(32).toString("base64url")
const lock = acquireLock(home, {
  // MessagePort host; URL is a sentinel until desktop serves WS (DES-039).
  url: "flows-desktop://utility-process",
  token: lockToken,
})
if ("attachTo" in lock) {
  console.error(
    `engine-host: FLOWAPP_HOME already owned at ${lock.attachTo.url}`
  )
  process.exit(1)
}

const engine = composeDesktopEngine(home)

type ParentMessage = {
  data?: { type?: string }
  ports?: MessagePortLike[]
}

const parentPort = (
  process as NodeJS.Process & {
    parentPort?: {
      on(event: "message", listener: (e: ParentMessage) => void): void
    }
  }
).parentPort

if (!parentPort) {
  console.error(
    "engine-host: process.parentPort missing (not a utilityProcess)"
  )
  releaseLock(home)
  process.exit(1)
}

parentPort.on("message", (event) => {
  if (event.data?.type !== "connect") return
  const port = event.ports?.[0]
  if (!port) return
  // Electron MessagePortMain is structurally compatible at runtime.
  engine.bindPort(port as MessagePortLike)
})

let closed = false
function shutdown() {
  if (closed) return
  closed = true
  engine.dispose()
  releaseLock(home)
}

process.on("exit", shutdown)
process.on("SIGTERM", () => {
  shutdown()
  process.exit(0)
})
