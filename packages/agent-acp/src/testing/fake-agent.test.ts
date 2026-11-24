import { PassThrough } from "node:stream"
import { describe, expect, it } from "vitest"
import { RpcPeer } from "@workspace/protocol"
import { ndjsonTransport } from "@workspace/protocol/node"
import { runFakeAgent, type FakeAgentScript } from "./fake-agent.ts"

const initializeParams = {
  protocolVersion: 1,
  clientCapabilities: {
    fs: { readTextFile: true, writeTextFile: true },
    terminal: false,
  },
  clientInfo: { name: "flows-test", version: "0.0.0" },
}

const initializeResult = {
  protocolVersion: 1,
  agentCapabilities: {
    loadSession: false,
    promptCapabilities: { image: false, audio: false, embeddedContext: true },
  },
  agentInfo: { name: "fake-agent", version: "0.0.0" },
  authMethods: [],
}

describe("runFakeAgent", () => {
  it("scripted initialize round trip over stdio streams", async () => {
    const toAgent = new PassThrough()
    const toClient = new PassThrough()

    const script: FakeAgentScript = {
      steps: [
        {
          expect: { method: "initialize", params: initializeParams },
          reply: { result: initializeResult },
        },
      ],
    }

    const agent = runFakeAgent(script, toAgent, toClient)
    const client = new RpcPeer(ndjsonTransport(toClient, toAgent))

    try {
      const result = await client.request("initialize", initializeParams)
      expect(result).toEqual(initializeResult)
      await expect(agent.done).resolves.toBeUndefined()
    } finally {
      client.close()
      agent.close()
    }
  })

  it("rejects when the request method does not match the script", async () => {
    const toAgent = new PassThrough()
    const toClient = new PassThrough()
    const script: FakeAgentScript = {
      steps: [
        {
          expect: { method: "initialize" },
          reply: { result: initializeResult },
        },
      ],
    }
    const agent = runFakeAgent(script, toAgent, toClient)
    const client = new RpcPeer(ndjsonTransport(toClient, toAgent))

    try {
      await expect(
        client.request("session/new", { cwd: "/" })
      ).rejects.toThrow()
      await expect(agent.done).rejects.toThrow(/expected method initialize/)
    } finally {
      client.close()
      agent.close()
    }
  })
})
