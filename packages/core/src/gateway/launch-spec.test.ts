import { describe, expect, it } from "vitest"
import { GATEWAY_TOKEN_ENV } from "../ports/gateway-socket.ts"
import { buildGatewayLaunchSpec, gatewayToolsJson } from "./launch-spec.ts"

describe("buildGatewayLaunchSpec", () => {
  it("builds command, args and token env for mcp-gateway", () => {
    expect(
      buildGatewayLaunchSpec({
        command: "flows-mcp-gateway",
        toolsPath: "/t.json",
        socketPath: "/e.sock",
        token: "secret",
      })
    ).toEqual({
      command: "flows-mcp-gateway",
      args: ["--tools", "/t.json", "--socket", "/e.sock"],
      env: { [GATEWAY_TOKEN_ENV]: "secret" },
    })
  })

  it("prepends prefixArgs when given", () => {
    const spec = buildGatewayLaunchSpec({
      command: "npx",
      prefixArgs: ["tsx", "cli.ts"],
      toolsPath: "/t.json",
      socketPath: "/e.sock",
      token: "t",
    })
    expect(spec.args.slice(0, 4)).toEqual([
      "tsx",
      "cli.ts",
      "--tools",
      "/t.json",
    ])
  })
})

describe("gatewayToolsJson", () => {
  it("serializes tools for the gateway launch file", () => {
    const json = gatewayToolsJson([
      { name: "github.pr_create", description: "Create a PR" },
    ])
    expect(JSON.parse(json)).toEqual({
      tools: [
        {
          name: "github.pr_create",
          description: "Create a PR",
          inputSchema: { type: "object" },
        },
      ],
    })
  })
})
