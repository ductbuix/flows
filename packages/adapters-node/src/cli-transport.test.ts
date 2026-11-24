import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { connectorToYaml, type ConnectorFile } from "@workspace/contracts"
import {
  createCliTransport,
  createConnectorRuntime,
  createConnectorService,
  createConnectorTransportRegistry,
  connectorPath,
} from "@workspace/core"
import { createFakeDocumentStore } from "@workspace/core/testing"
import { afterEach, describe, expect, it } from "vitest"
import { createNodeProcessRunner } from "./process-runner.ts"

const temps: string[] = []

afterEach(() => {
  while (temps.length > 0) {
    rmSync(temps.pop()!, { recursive: true, force: true })
  }
})

function stubBinary(): string {
  const dir = mkdtempSync(join(tmpdir(), "flowapp-cli-stub-"))
  temps.push(dir)
  const path = join(dir, "gh-stub")
  writeFileSync(path, `#!/bin/sh\nprintf 'args:%s\\n' "$*"\nexit 0\n`, {
    mode: 0o755,
  })
  chmodSync(path, 0o755)
  return path
}

describe("Node CLI connector transport", () => {
  it("runs an allowed capability through a stub binary", async () => {
    const binary = stubBinary()
    const connector: ConnectorFile = {
      id: "github-cli",
      name: "GitHub",
      transport: "cli",
      how: binary,
      auth: "cli-login",
      capabilities: [
        {
          name: "repo clone",
          desc: "Clone",
          write: false,
          allowed: true,
          cmd: ["repo", "clone"],
        },
      ],
    }
    const docs = createFakeDocumentStore()
    docs.write(connectorPath(connector.id), connectorToYaml(connector))
    const runtime = createConnectorRuntime({
      connectors: createConnectorService({ docs }),
      transports: createConnectorTransportRegistry([
        createCliTransport(createNodeProcessRunner()),
      ]),
    })

    const result = await runtime.call(
      "github-cli",
      "repo clone",
      ["acme/demo"],
      new AbortController().signal
    )
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain("args:repo clone acme/demo")
  })
})
