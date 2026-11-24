import { mkdtempSync, rmSync } from "node:fs"
import { createServer, type IncomingMessage, type Server } from "node:http"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { connectorToYaml, type ConnectorFile } from "@workspace/contracts"
import {
  checkConnector,
  connectorPath,
  cookiesSecretKey,
  createConnectorRuntime,
  createConnectorService,
  createConnectorTransportRegistry,
  tokenSecretKey,
  UpdateBus,
} from "@workspace/core"
import {
  createFakeClock,
  createFakeDocumentStore,
} from "@workspace/core/testing"
import { afterEach, describe, expect, it } from "vitest"
import { createNodeApiTransport } from "./api-transport.ts"
import { createNodeSecretStore } from "./secrets.ts"

const temps: string[] = []
const servers: Server[] = []

afterEach(async () => {
  while (servers.length > 0) {
    const s = servers.pop()!
    await new Promise<void>((resolve, reject) => {
      s.close((err) => (err ? reject(err) : resolve()))
    })
  }
  while (temps.length > 0) {
    rmSync(temps.pop()!, { recursive: true, force: true })
  }
})

function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), "flowapp-api-transport-"))
  temps.push(home)
  return home
}

type Seen = { cookie?: string; auth?: string; url: string }

async function listen(
  handler: (req: IncomingMessage) => {
    status: number
    body: string
    seen: Seen
  }
): Promise<{ baseUrl: string; last: Seen }> {
  const last: Seen = { url: "" }
  const server = createServer((req, res) => {
    const result = handler(req)
    last.cookie = result.seen.cookie
    last.auth = result.seen.auth
    last.url = result.seen.url
    res.writeHead(result.status, { "Content-Type": "text/plain" })
    res.end(result.body)
  })
  servers.push(server)
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve())
  })
  const addr = server.address()
  if (!addr || typeof addr === "string") throw new Error("no address")
  return { baseUrl: `http://127.0.0.1:${addr.port}`, last }
}

describe("Node API connector transport", () => {
  it("sends cookie jar from SecretStore and marks expired on 401", async () => {
    let expire = false
    const { baseUrl, last } = await listen((req) => {
      const cookie = req.headers.cookie
      const url = req.url ?? "/"
      if (!cookie?.includes("ZSESSIONID=good")) {
        return {
          status: 401,
          body: "unauthorized",
          seen: { cookie, url },
        }
      }
      if (expire) {
        return {
          status: 401,
          body: "expired",
          seen: { cookie, url },
        }
      }
      return { status: 200, body: "hello", seen: { cookie, url } }
    })

    const home = tempHome()
    const secrets = createNodeSecretStore({ root: join(home, "secrets") })
    secrets.set(
      cookiesSecretKey("rally"),
      `${JSON.stringify([
        {
          name: "ZSESSIONID",
          value: "good",
          domain: "127.0.0.1",
          path: "/",
        },
      ])}\n`
    )

    const connector: ConnectorFile = {
      id: "rally",
      name: "Rally",
      transport: "api",
      how: baseUrl,
      auth: "cookies",
      capabilities: [
        {
          name: "ping",
          desc: "Ping",
          write: false,
          allowed: true,
          cmd: ["GET", "/ping"],
        },
      ],
    }
    const docs = createFakeDocumentStore()
    docs.write(connectorPath(connector.id), connectorToYaml(connector))
    const connectors = createConnectorService({ docs })
    const bus = new UpdateBus()
    const clock = createFakeClock(Date.parse("2026-11-24T12:00:00.000Z"))

    const markExpired = (c: ConnectorFile, detail: string) => {
      const at = new Date(clock.now()).toISOString()
      connectors.setStatus(c.id, { status: "expired", checkedAt: at, detail })
      bus.publish("connector/update", {
        kind: "status_changed",
        connectorId: c.id,
        status: "expired",
        checkedAt: at,
        detail,
      })
    }

    const runtime = createConnectorRuntime({
      connectors,
      transports: createConnectorTransportRegistry([
        createNodeApiTransport({ home, onUnauthorized: markExpired }),
      ]),
    })

    const ok = await runtime.call(
      "rally",
      "ping",
      [],
      new AbortController().signal
    )
    expect(ok.exitCode).toBe(0)
    expect(ok.stdout).toBe("hello")
    expect(last.cookie).toContain("ZSESSIONID=good")
    expect(last.url).toBe("/ping")

    expire = true
    const failed = await runtime.call(
      "rally",
      "ping",
      [],
      new AbortController().signal
    )
    expect(failed.exitCode).toBe(401)
    expect(connectors.getStatus("rally")?.status).toBe("expired")

    const checked = await checkConnector(
      { service: connectors, runtime, bus, clock },
      "rally",
      new AbortController().signal
    )
    expect(checked.status).toBe("expired")
    expect(checked.detail).toBe("sign-in expired")
  })

  it("sends Bearer token from SecretStore for pat auth", async () => {
    const { baseUrl, last } = await listen((req) => {
      const auth = req.headers.authorization
      return {
        status: auth === "Bearer secret-pat" ? 200 : 401,
        body: auth === "Bearer secret-pat" ? "ok" : "no",
        seen: { auth, url: req.url ?? "/" },
      }
    })

    const home = tempHome()
    const secrets = createNodeSecretStore({ root: join(home, "secrets") })
    secrets.set(tokenSecretKey("jenkins"), "secret-pat")

    const connector: ConnectorFile = {
      id: "jenkins",
      name: "Jenkins",
      transport: "api",
      how: baseUrl,
      auth: "pat",
      capabilities: [
        {
          name: "job read",
          desc: "Read",
          write: false,
          allowed: true,
          cmd: ["GET", "/job/main"],
        },
      ],
    }
    const docs = createFakeDocumentStore()
    docs.write(connectorPath(connector.id), connectorToYaml(connector))
    const runtime = createConnectorRuntime({
      connectors: createConnectorService({ docs }),
      transports: createConnectorTransportRegistry([
        createNodeApiTransport({ home }),
      ]),
    })

    const result = await runtime.call(
      "jenkins",
      "job read",
      [],
      new AbortController().signal
    )
    expect(result.exitCode).toBe(0)
    expect(last.auth).toBe("Bearer secret-pat")
    expect(last.url).toBe("/job/main")
  })
})
