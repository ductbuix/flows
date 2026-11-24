import { connectorToYaml, type ConnectorFile } from "@workspace/contracts"
import { describe, expect, it } from "vitest"
import { isEngineError } from "../rpc/map-error.ts"
import {
  createFakeDocumentStore,
  createFakeProcessRunner,
} from "../testing/index.ts"
import { createCliTransport } from "./cli-transport.ts"
import { createConnectorTransportRegistry } from "./registry.ts"
import { createConnectorRuntime } from "./runtime.ts"
import { connectorPath, createConnectorService } from "./service.ts"

const github: ConnectorFile = {
  id: "github-cli",
  name: "GitHub",
  transport: "cli",
  how: "gh-stub",
  auth: "cli-login",
  capabilities: [
    {
      name: "repo clone",
      desc: "Read repositories",
      write: false,
      allowed: true,
      cmd: ["repo", "clone"],
    },
    {
      name: "pr merge",
      desc: "Merge a PR",
      write: true,
      allowed: false,
      cmd: ["pr", "merge"],
    },
    {
      name: "pr view",
      desc: "View a PR",
      write: false,
      allowed: true,
      // no cmd — call should fail invalid_params
    },
  ],
}

function stack(seed: ConnectorFile = github) {
  const docs = createFakeDocumentStore()
  docs.write(connectorPath(seed.id), connectorToYaml(seed))
  const connectors = createConnectorService({ docs })
  const runner = createFakeProcessRunner()
  runner.on("gh-stub", (spec) => ({
    stdout: `ok ${[spec.command, ...(spec.args ?? [])].join(" ")}\n`,
    exitCode: 0,
  }))
  const transports = createConnectorTransportRegistry([
    createCliTransport(runner),
  ])
  const runtime = createConnectorRuntime({ connectors, transports })
  return { runtime, runner }
}

describe("ConnectorRuntime + cli transport", () => {
  it("runs an allowed capability through the stub binary using cmd from the file", async () => {
    const { runtime } = stack()
    const result = await runtime.call(
      "github-cli",
      "repo clone",
      ["acme/demo"],
      new AbortController().signal
    )
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain("gh-stub repo clone acme/demo")
  })

  it("refuses a capability that is off with policy_denied", async () => {
    const { runtime } = stack()
    try {
      await runtime.call(
        "github-cli",
        "pr merge",
        ["1"],
        new AbortController().signal
      )
      expect.unreachable("expected policy_denied")
    } catch (err) {
      expect(isEngineError(err)).toBe(true)
      if (isEngineError(err)) {
        expect(err.code).toBe("policy_denied")
        expect(err.message).toContain("pr merge")
      }
    }
  })

  it("requires cmd mapping data on the capability", async () => {
    const { runtime } = stack()
    try {
      await runtime.call(
        "github-cli",
        "pr view",
        ["1"],
        new AbortController().signal
      )
      expect.unreachable("expected invalid_params")
    } catch (err) {
      expect(isEngineError(err)).toBe(true)
      if (isEngineError(err)) expect(err.code).toBe("invalid_params")
    }
  })

  it("checks the stub binary", async () => {
    const { runtime } = stack()
    const result = await runtime.check(
      "github-cli",
      new AbortController().signal
    )
    expect(result.ok).toBe(true)
    expect(result.detail).toContain("gh-stub")
  })
})
