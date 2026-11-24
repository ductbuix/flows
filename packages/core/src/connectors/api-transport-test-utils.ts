import { connectorToYaml, type ConnectorFile } from "@workspace/contracts"
import {
  createFakeDocumentStore,
  createFakeSecretStore,
} from "../testing/index.ts"
import { type StoredCookie } from "./api-auth.ts"
import { createApiTransport } from "./api-transport.ts"
import { createConnectorTransportRegistry } from "./registry.ts"
import { createConnectorRuntime } from "./runtime.ts"
import { connectorPath, createConnectorService } from "./service.ts"

export const rally: ConnectorFile = {
  id: "rally",
  name: "Rally",
  transport: "api",
  how: "https://rally.example/slm",
  auth: "cookies",
  capabilities: [
    {
      name: "artifact read",
      desc: "Read",
      write: false,
      allowed: true,
      cmd: ["GET", "/artifact"],
    },
  ],
}

export const jenkins: ConnectorFile = {
  id: "jenkins",
  name: "Jenkins",
  transport: "api",
  how: "https://ci.example",
  auth: "pat",
  capabilities: [
    {
      name: "job read",
      desc: "Read",
      write: false,
      allowed: true,
      cmd: ["GET", "/job"],
    },
  ],
}

export function cookieJar(value = "good"): StoredCookie[] {
  return [
    {
      name: "ZSESSIONID",
      value,
      domain: "rally.example",
      path: "/",
    },
  ]
}

export function stack(
  seed: ConnectorFile,
  fetchFn: typeof globalThis.fetch,
  onUnauthorized?: (c: ConnectorFile, detail: string) => void
) {
  const docs = createFakeDocumentStore()
  docs.write(connectorPath(seed.id), connectorToYaml(seed))
  const secrets = createFakeSecretStore()
  const connectors = createConnectorService({ docs })
  const transports = createConnectorTransportRegistry([
    createApiTransport({ secrets, fetch: fetchFn, onUnauthorized }),
  ])
  const runtime = createConnectorRuntime({ connectors, transports })
  return { runtime, secrets, connectors }
}
