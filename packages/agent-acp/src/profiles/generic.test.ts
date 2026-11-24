import { describe, expect, it } from "vitest"
import {
  createFakeLogger,
  createFakeProcessRunner,
} from "@workspace/core/testing"
import { createGenericProfile, GENERIC_MODES } from "./generic.ts"

describe("createGenericProfile", () => {
  it("builds command from settings: command, args, env names, auth", () => {
    const prev = process.env.FLOWS_TEST_TOKEN
    process.env.FLOWS_TEST_TOKEN = "tok-1"
    try {
      const profile = createGenericProfile({
        command: "my-acp",
        args: ["serve", "--stdio"],
        env: ["FLOWS_TEST_TOKEN", "MISSING_ENV"],
        authMethod: "api_key",
      })
      expect(profile.id).toBe("generic")
      expect(profile.authMethod).toBe("api_key")
      expect(profile.capabilities).toEqual({
        mcpParam: true,
        setModel: false,
        modes: [...GENERIC_MODES],
      })
      expect(profile.extensions).toEqual({})
      expect(profile.command({ profileId: "generic", cwd: "/work" })).toEqual({
        cmd: "my-acp",
        args: ["serve", "--stdio"],
        env: {
          FLOWS_TEST_TOKEN: "tok-1",
          MISSING_ENV: undefined,
        },
      })
    } finally {
      if (prev === undefined) delete process.env.FLOWS_TEST_TOKEN
      else process.env.FLOWS_TEST_TOKEN = prev
    }
  })

  it("logs that extensions are ignored", () => {
    const logger = createFakeLogger()
    createGenericProfile({ command: "acp-bin", logger })
    expect(logger.entries).toContainEqual({
      level: "info",
      message: "ACP generic profile ignores extensions",
      fields: { profileId: "generic" },
    })
  })

  it("probes the configured command via FakeProcessRunner", async () => {
    const runner = createFakeProcessRunner()
    runner.on("acp-bin", (spec) => {
      expect(spec.args).toEqual(["--version"])
      return { stdout: "0.1.0\n", exitCode: 0 }
    })
    const profile = createGenericProfile({ command: "acp-bin" })
    await expect(
      profile.probe(runner, new AbortController().signal)
    ).resolves.toEqual({ found: true, version: "0.1.0" })
  })
})
