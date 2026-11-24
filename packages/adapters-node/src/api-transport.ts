import { join } from "node:path"
import {
  createApiTransport,
  type ApiTransportDeps,
  type ConnectorTransportHandler,
} from "@workspace/core"
import { createNodeSecretStore } from "./secrets.ts"

export type NodeApiTransportOptions = {
  /** FLOWAPP_HOME; secrets live under `<home>/secrets`. */
  home: string
  onUnauthorized?: ApiTransportDeps["onUnauthorized"]
  fetch?: ApiTransportDeps["fetch"]
  now?: ApiTransportDeps["now"]
}

/** API connector transport wired to the Node SecretStore (BL-162). */
export function createNodeApiTransport(
  options: NodeApiTransportOptions
): ConnectorTransportHandler {
  return createApiTransport({
    secrets: createNodeSecretStore({ root: join(options.home, "secrets") }),
    onUnauthorized: options.onUnauthorized,
    fetch: options.fetch,
    now: options.now,
  })
}
