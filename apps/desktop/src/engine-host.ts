import type { MessagePortLike } from "@workspace/protocol"
import { composeDesktopEngine } from "./compose-engine.ts"

/**
 * Electron utilityProcess entry. Main sends `{ type: "connect" }` with a
 * transferred MessagePortMain for each renderer FCP session.
 */
const home = process.env.FLOWAPP_HOME
if (!home) {
  console.error("engine-host: FLOWAPP_HOME is required")
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
  process.exit(1)
}

parentPort.on("message", (event) => {
  if (event.data?.type !== "connect") return
  const port = event.ports?.[0]
  if (!port) return
  // Electron MessagePortMain is structurally compatible at runtime.
  engine.bindPort(port as MessagePortLike)
})

process.on("exit", () => engine.dispose())
