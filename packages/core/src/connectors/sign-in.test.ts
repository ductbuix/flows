import { connectorToYaml, type ConnectorFile } from "@workspace/contracts"
import { describe, expect, it, vi } from "vitest"
import {
  createFakeDocumentStore,
  createFakeSecretStore,
} from "../testing/index.ts"
import { createFcpConnection } from "../rpc/initialize.ts"
import { cookiesSecretKey } from "./api-auth.ts"
import { connectorPath, createConnectorService } from "./service.ts"
import { connectorSignInTarget, signInConnector } from "./sign-in.ts"

const rally: ConnectorFile = {
  id: "rally",
  name: "Rally",
  transport: "api",
  how: "https://rally.example/api",
  auth: "cookies",
  capabilities: [],
}

describe("connectorSignInTarget", () => {
  it("derives url and cookie domain from how", () => {
    expect(connectorSignInTarget(rally)).toEqual({
      url: "https://rally.example/api",
      cookieDomains: ["rally.example"],
    })
  })
})

describe("signInConnector", () => {
  it("saves host cookies and returns signedIn", async () => {
    const docs = createFakeDocumentStore()
    docs.write(connectorPath("rally"), connectorToYaml(rally))
    const service = createConnectorService({ docs })
    const secrets = createFakeSecretStore()
    const peer = {
      request: vi.fn().mockResolvedValue({
        cookies: [
          { name: "s", value: "1", domain: "rally.example", path: "/" },
        ],
      }),
    }
    const connection = createFcpConnection()
    connection.clientCapabilities = { host: { browserSignIn: true } }

    const result = await signInConnector(
      { service, secrets, peer, connection },
      "rally",
      new AbortController().signal
    )

    expect(result).toEqual({ signedIn: true })
    expect(secrets.get(cookiesSecretKey("rally"))).toContain('"s"')
  })

  it("returns cancelled without writing secrets", async () => {
    const docs = createFakeDocumentStore()
    docs.write(connectorPath("rally"), connectorToYaml(rally))
    const service = createConnectorService({ docs })
    const secrets = createFakeSecretStore()
    const peer = {
      request: vi.fn().mockResolvedValue({ cancelled: true }),
    }
    const connection = createFcpConnection()
    connection.clientCapabilities = { host: { browserSignIn: true } }

    const result = await signInConnector(
      { service, secrets, peer, connection },
      "rally",
      new AbortController().signal
    )

    expect(result).toEqual({ cancelled: true })
    expect(secrets.get(cookiesSecretKey("rally"))).toBeNull()
  })

  it("uses Chrome fallback without host capability", async () => {
    const docs = createFakeDocumentStore()
    docs.write(connectorPath("rally"), connectorToYaml(rally))
    const service = createConnectorService({ docs })
    const secrets = createFakeSecretStore()
    const chromeSignIn = vi.fn().mockResolvedValue({
      cookies: [
        { name: "c", value: "chrome", domain: "rally.example", path: "/" },
      ],
    })

    const result = await signInConnector(
      { service, secrets, chromeSignIn },
      "rally",
      new AbortController().signal
    )

    expect(chromeSignIn).toHaveBeenCalled()
    expect(result).toEqual({ signedIn: true })
    expect(secrets.get(cookiesSecretKey("rally"))).toContain("chrome")
  })
})
