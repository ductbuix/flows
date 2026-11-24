import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { PassThrough } from "node:stream"
import { afterEach, describe, expect, it } from "vitest"
import { JSONRPC_INVALID_PARAMS, RpcPeer } from "@workspace/protocol"
import { ndjsonTransport } from "@workspace/protocol/node"
import {
  runFakeAgent,
  type FakeAgentHandle,
  type FakeAgentScript,
} from "./testing/fake-agent.ts"
import { ACP_CLIENT_CAPABILITIES, openAcpSession } from "./session.ts"

const clientInfo = { name: "flows-test", version: "0.0.0" }
const sessionId = "sess_fs"

const initializeParams = {
  protocolVersion: 1,
  clientCapabilities: ACP_CLIENT_CAPABILITIES,
  clientInfo,
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

const tempDirs: string[] = []

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) await rm(dir, { recursive: true, force: true })
  }
})

async function makeWorkDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "acp-fs-"))
  tempDirs.push(dir)
  return dir
}

function handshake(cwd: string): FakeAgentScript {
  return {
    waitForClose: true,
    steps: [
      {
        expect: { method: "initialize", params: initializeParams },
        reply: { result: initializeResult },
      },
      {
        expect: {
          method: "session/new",
          params: { cwd, mcpServers: [] },
        },
        reply: { result: { sessionId } },
      },
    ],
  }
}

async function withFsSession(
  cwd: string,
  run: (agent: FakeAgentHandle) => Promise<void>
): Promise<void> {
  const toAgent = new PassThrough()
  const toClient = new PassThrough()
  const agent = runFakeAgent(handshake(cwd), toAgent, toClient)
  const peer = new RpcPeer(ndjsonTransport(toClient, toAgent))

  try {
    const session = await openAcpSession(peer, { cwd, clientInfo })
    expect(session.id).toBe(sessionId)
    await run(agent)
    agent.close()
    await expect(agent.done).resolves.toBeUndefined()
    await session.close()
  } finally {
    peer.close()
    agent.close()
  }
}

describe("ACP fs path policy", () => {
  it("reads and writes inside the allowed work dir (atomic)", async () => {
    const cwd = await makeWorkDir()
    const target = join(cwd, "note.txt")
    await writeFile(target, "hello\n", "utf8")
    const out = join(cwd, "out.txt")

    await withFsSession(cwd, async (agent) => {
      await agent.requestClient({
        method: "fs/read_text_file",
        params: { sessionId, path: target },
        expectResult: { content: "hello\n" },
      })
      await agent.requestClient({
        method: "fs/write_text_file",
        params: { sessionId, path: out, content: "written" },
        expectResult: {},
      })
    })

    await expect(readFile(out, "utf8")).resolves.toBe("written")
  })

  it("rejects .. escape with a JSON-RPC error", async () => {
    const cwd = await makeWorkDir()
    const outside = join(cwd, "..", "escape-target.txt")

    await withFsSession(cwd, async (agent) => {
      await agent.requestClient({
        method: "fs/read_text_file",
        params: { sessionId, path: outside },
        expectError: {
          code: JSONRPC_INVALID_PARAMS,
          messageIncludes: "outside allowed roots",
        },
      })
      await agent.requestClient({
        method: "fs/write_text_file",
        params: { sessionId, path: outside, content: "nope" },
        expectError: {
          code: JSONRPC_INVALID_PARAMS,
          messageIncludes: "outside allowed roots",
        },
      })
    })
  })

  it("rejects symlink escape with a JSON-RPC error", async () => {
    const cwd = await makeWorkDir()
    const outsideDir = await makeWorkDir()
    await writeFile(join(outsideDir, "secret.txt"), "secret", "utf8")
    const link = join(cwd, "escape")
    await symlink(outsideDir, link)

    await withFsSession(cwd, async (agent) => {
      await agent.requestClient({
        method: "fs/read_text_file",
        params: { sessionId, path: join(link, "secret.txt") },
        expectError: {
          code: JSONRPC_INVALID_PARAMS,
          messageIncludes: "outside allowed roots",
        },
      })
      await agent.requestClient({
        method: "fs/write_text_file",
        params: {
          sessionId,
          path: join(link, "planted.txt"),
          content: "nope",
        },
        expectError: {
          code: JSONRPC_INVALID_PARAMS,
          messageIncludes: "outside allowed roots",
        },
      })
    })
  })

  it("creates nested files under the work dir", async () => {
    const cwd = await makeWorkDir()
    await mkdir(join(cwd, "sub"), { recursive: true })
    const nested = join(cwd, "sub", "deep.txt")

    await withFsSession(cwd, async (agent) => {
      await agent.requestClient({
        method: "fs/write_text_file",
        params: { sessionId, path: nested, content: "nested" },
        expectResult: {},
      })
    })

    await expect(readFile(nested, "utf8")).resolves.toBe("nested")
  })
})
