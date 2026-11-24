import { connectorToYaml, type ConnectorFile } from "@workspace/contracts"
import { describe, expect, it } from "vitest"
import { createCliTransport } from "../connectors/cli-transport.ts"
import { createConnectorTransportRegistry } from "../connectors/registry.ts"
import { createConnectorRuntime } from "../connectors/runtime.ts"
import { connectorPath, createConnectorService } from "../connectors/service.ts"
import {
  createFakeClock,
  createFakeDocumentStore,
  createFakeEventStore,
  createFakeProcessRunner,
} from "../testing/index.ts"
import {
  createGatewayCallHandler,
  gatewayArgsToCli,
  type GatewayStepCallContext,
} from "./call-handler.ts"

const github: ConnectorFile = {
  id: "github",
  name: "GitHub",
  transport: "cli",
  how: "gh-stub",
  auth: "cli-login",
  capabilities: [
    {
      name: "repo clone",
      desc: "Read",
      write: false,
      allowed: true,
      cmd: ["repo", "clone"],
    },
    {
      name: "pr create",
      desc: "Write",
      write: true,
      allowed: true,
      cmd: ["pr", "create"],
    },
  ],
}

function stack() {
  const docs = createFakeDocumentStore()
  docs.write(connectorPath(github.id), connectorToYaml(github))
  const connectors = createConnectorService({ docs })
  const runner = createFakeProcessRunner()
  runner.on("gh-stub", (spec) => ({
    stdout: `ok ${[spec.command, ...(spec.args ?? [])].join(" ")}\n`,
    exitCode: 0,
  }))
  const runtime = createConnectorRuntime({
    connectors,
    transports: createConnectorTransportRegistry([createCliTransport(runner)]),
  })
  const events = createFakeEventStore()
  const clock = createFakeClock(1_000)
  const handle = createGatewayCallHandler({
    runtime,
    connectors,
    events,
    clock,
  })
  return { handle, events }
}

function step(
  overrides: Partial<GatewayStepCallContext> = {}
): GatewayStepCallContext {
  return {
    runId: "r1",
    nodeId: "agent",
    pass: 1,
    permission: {
      allowedRoots: ["/work"],
      connectorWriteEnabled: false,
      nodeAllowlist: ["github.repo_clone"],
      rememberedAllowAlways: [],
    },
    tools: [
      {
        name: "github.repo_clone",
        connectorId: "github",
        capability: "repo clone",
      },
      {
        name: "github.pr_create",
        connectorId: "github",
        capability: "pr create",
      },
    ],
    ...overrides,
  }
}

describe("gatewayArgsToCli", () => {
  it("prefers args array then sorted primitives", () => {
    expect(gatewayArgsToCli({ args: ["a", 1] })).toEqual(["a", "1"])
    expect(gatewayArgsToCli({ b: "2", a: "1" })).toEqual(["1", "2"])
  })
})

describe("createGatewayCallHandler", () => {
  it("allows an allowlisted read and logs connector_called ok", async () => {
    const { handle, events } = stack()
    const result = await handle(
      step(),
      { name: "github.repo_clone", arguments: { args: ["acme/demo"] } },
      new AbortController().signal
    )
    expect(result.isError).toBeUndefined()
    expect(result.content[0]?.text).toContain("gh-stub repo clone acme/demo")
    const logged = events.read("r1").map((s) => s.event)
    expect(logged).toEqual([
      expect.objectContaining({
        type: "connector_called",
        connectorId: "github",
        capability: "repo clone",
        status: "ok",
      }),
    ])
  })

  it("denies a write capability when connector writes are off", async () => {
    const { handle, events } = stack()
    const result = await handle(
      step({
        permission: {
          allowedRoots: ["/work"],
          connectorWriteEnabled: false,
          nodeAllowlist: ["github.pr_create"],
          rememberedAllowAlways: [],
        },
      }),
      { name: "github.pr_create", arguments: { title: "hi" } },
      new AbortController().signal
    )
    expect(result.isError).toBe(true)
    expect(result.content[0]?.text).toMatch(/denied by connector/)
    expect(events.read("r1")[0]?.event).toEqual(
      expect.objectContaining({
        type: "connector_called",
        capability: "pr create",
        status: "denied",
      })
    )
  })
})
