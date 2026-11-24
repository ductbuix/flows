import { describe, expect, it } from "vitest"
import { createFakeProcessRunner } from "@workspace/core/testing"
import { ACP_CLIENT_CAPABILITIES } from "./session.ts"
import { createAcpRuntime } from "./runtime.ts"
import { CURSOR_AUTH_METHOD, cursorProfile } from "./profiles/cursor.ts"
import {
  createScriptedProcessRunner,
  type ScriptedProcessRunner,
} from "./testing/scripted-runner.ts"
import type { FakeAgentScript, FakeAgentStep } from "./testing/fake-agent.ts"

const clientInfo = { name: "flows-test", version: "0.0.0" }
const cwd = "/tmp/work"
const sessionId = "sess_cursor"

const initializeParams = {
  protocolVersion: 1,
  clientCapabilities: ACP_CLIENT_CAPABILITIES,
  clientInfo,
}

function initResult(authMethods: { id: string }[]) {
  return {
    protocolVersion: 1,
    agentCapabilities: {
      loadSession: false,
      promptCapabilities: {
        image: false,
        audio: false,
        embeddedContext: true,
      },
    },
    agentInfo: { name: "fake-agent", version: "0.0.0" },
    authMethods,
  }
}

function baseSteps(extra: FakeAgentStep[] = []): FakeAgentScript["steps"] {
  return [
    {
      expect: { method: "initialize", params: initializeParams },
      reply: { result: initResult([{ id: CURSOR_AUTH_METHOD }]) },
    },
    {
      expect: {
        method: "authenticate",
        params: { methodId: CURSOR_AUTH_METHOD },
      },
      reply: { result: {} },
    },
    {
      expect: {
        method: "session/new",
        params: { cwd, mcpServers: [] },
      },
      reply: { result: { sessionId } },
    },
    ...extra,
  ]
}

describe("createAcpRuntime", () => {
  it("lists the cursor profile statically", () => {
    const runtime = createAcpRuntime({
      processRunner: createFakeProcessRunner(),
      profiles: [cursorProfile],
    })
    expect(runtime.profiles()).toEqual([
      { id: "cursor", modes: cursorProfile.capabilities.modes },
    ])
  })

  it("list() reports found or missing with version", async () => {
    const runner = createFakeProcessRunner()
    runner.on("agent", () => ({ stdout: "1.2.3\n", exitCode: 0 }))
    const runtime = createAcpRuntime({
      processRunner: runner,
      profiles: [cursorProfile],
    })
    await expect(runtime.list()).resolves.toEqual([
      {
        id: "cursor",
        modes: cursorProfile.capabilities.modes,
        found: true,
        version: "1.2.3",
      },
    ])

    const missing = createFakeProcessRunner()
    missing.on("agent", () => ({ exitCode: 1 }))
    const runtimeMissing = createAcpRuntime({
      processRunner: missing,
      profiles: [cursorProfile],
    })
    await expect(runtimeMissing.list()).resolves.toEqual([
      {
        id: "cursor",
        modes: cursorProfile.capabilities.modes,
        found: false,
        version: null,
      },
    ])
  })

  it("spawns agent [--model m] acp with cwd = step work dir", async () => {
    const runner = createScriptedProcessRunner(() => ({
      steps: baseSteps(),
    }))
    const runtime = createAcpRuntime({
      processRunner: runner,
      profiles: [cursorProfile],
      clientInfo,
    })
    const session = await runtime.open(
      { profileId: "cursor", cwd, model: "composer-1" },
      new AbortController().signal
    )
    expect(session.id).toBe(sessionId)
    expectSpawn(runner, {
      command: "agent",
      args: ["--model", "composer-1", "acp"],
      cwd,
    })
    await session.close()
  })

  it("authenticates with cursor_login when required", async () => {
    const runner = createScriptedProcessRunner(() => ({
      steps: baseSteps(),
    }))
    const runtime = createAcpRuntime({
      processRunner: runner,
      profiles: [cursorProfile],
      clientInfo,
    })
    const session = await runtime.open(
      { profileId: "cursor", cwd },
      new AbortController().signal
    )
    expect(session.id).toBe(sessionId)
    await session.close()
  })

  it("maps authenticate failure to needs_trust", async () => {
    const runner = createScriptedProcessRunner(() => ({
      steps: [
        {
          expect: { method: "initialize", params: initializeParams },
          reply: { result: initResult([{ id: CURSOR_AUTH_METHOD }]) },
        },
        {
          expect: {
            method: "authenticate",
            params: { methodId: CURSOR_AUTH_METHOD },
          },
          reply: {
            error: { code: -32000, message: "not signed in" },
          },
        },
      ],
    }))
    const runtime = createAcpRuntime({
      processRunner: runner,
      profiles: [cursorProfile],
      clientInfo,
    })
    await expect(
      runtime.open({ profileId: "cursor", cwd }, new AbortController().signal)
    ).rejects.toMatchObject({
      code: "needs_trust",
      message: expect.stringContaining("cursor_login"),
    })
  })

  it("skips authenticate when authMethods omit cursor_login", async () => {
    const runner = createScriptedProcessRunner(() => ({
      steps: [
        {
          expect: { method: "initialize", params: initializeParams },
          reply: { result: initResult([]) },
        },
        {
          expect: {
            method: "session/new",
            params: { cwd, mcpServers: [] },
          },
          reply: { result: { sessionId } },
        },
      ],
    }))
    const runtime = createAcpRuntime({
      processRunner: runner,
      profiles: [cursorProfile],
      clientInfo,
    })
    const session = await runtime.open(
      { profileId: "cursor", cwd },
      new AbortController().signal
    )
    expect(session.id).toBe(sessionId)
    await session.close()
  })
})

function expectSpawn(
  runner: ScriptedProcessRunner,
  expected: { command: string; args: string[]; cwd: string }
): void {
  expect(runner.spawns).toHaveLength(1)
  const spec = runner.spawns[0]!.spec
  expect(spec.command).toBe(expected.command)
  expect(spec.args).toEqual(expected.args)
  expect(spec.cwd).toBe(expected.cwd)
}
