import { describe, expect, it } from "vitest"
import { getCliAdapter } from "./cli-adapters.ts"
import {
  composeClaudeFlags,
  composeCursorFlags,
  flagsToShell,
} from "./compose-flags.ts"
import { shellSingleQuote } from "./agent-prompt.ts"

describe("composeFlags", () => {
  it("adds Claude --model and --effort when resolved", () => {
    expect(composeClaudeFlags({ model: "opus", effort: "xhigh" })).toEqual([
      "--model",
      "opus",
      "--effort",
      "xhigh",
    ])
  })

  it("omits Claude flags when unresolved", () => {
    expect(composeClaudeFlags({})).toEqual([])
  })

  it("composes Cursor family id with effort", () => {
    expect(
      composeCursorFlags({ model: "gpt-5.3-codex", effort: "high" }, [
        "gpt-5.3-codex-high",
        "gpt-5.3-codex-high-fast",
      ])
    ).toEqual(["--model", "gpt-5.3-codex-high"])
  })

  it("passes Cursor bracket custom ids through", () => {
    const id = "claude-opus-4-8[context=1m,effort=high,fast=false]"
    expect(composeCursorFlags({ model: id, effort: "low" })).toEqual([
      "--model",
      id,
    ])
  })

  it("omits Cursor flags when model is unresolved", () => {
    expect(composeCursorFlags({ effort: "high" })).toEqual([])
  })

  it("wires adapter composeFlags for both CLIs", () => {
    expect(
      getCliAdapter("claude").composeFlags({ model: "haiku", effort: "low" })
    ).toEqual(["--model", "haiku", "--effort", "low"])
    expect(
      getCliAdapter("cursor").composeFlags({ model: "auto", effort: "high" })
    ).toEqual(["--model", "auto-high"])
  })

  it("shell-quotes flag values", () => {
    const id = "x[effort=high]"
    expect(flagsToShell(["--model", id])).toBe(
      ` --model ${shellSingleQuote(id)}`
    )
  })
})
