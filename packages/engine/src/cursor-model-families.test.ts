import { describe, expect, it } from "vitest"
import {
  composeCursorModelId,
  parseCursorModelId,
  parseCursorModelList,
} from "./cursor-model-families.ts"
import { parseCursorListOutput } from "./cli-models.ts"

const FIXTURE = `Available models

auto - Auto (current, default)
gpt-5.3-codex-low - Codex 5.3 Low
gpt-5.3-codex-low-fast - Codex 5.3 Low Fast
gpt-5.3-codex - Codex 5.3
gpt-5.3-codex-fast - Codex 5.3 Fast
gpt-5.3-codex-high - Codex 5.3 High
gpt-5.3-codex-high-fast - Codex 5.3 High Fast
gpt-5.3-codex-xhigh - Codex 5.3 Extra High
gpt-5.3-codex-xhigh-fast - Codex 5.3 Extra High Fast
gpt-5.2 - GPT-5.2
composer-2.5 - Composer 2.5
composer-2.5-fast - Composer 2.5 Fast
claude-opus-5-thinking-high - Claude Opus 5 Thinking High
claude-opus-5-thinking-high-fast - Claude Opus 5 Thinking High Fast
claude-opus-5-5-max - Claude Opus 5.5 Max
`

describe("cursor model families", () => {
  it("parses list output into families and non-fast efforts", () => {
    const listed = parseCursorListOutput(FIXTURE)
    const families = parseCursorModelList(listed)
    const byId = Object.fromEntries(families.map((f) => [f.id, f]))

    expect(byId.auto?.efforts).toEqual([])
    expect(byId["gpt-5.2"]?.efforts).toEqual([])
    expect(byId["composer-2.5"]?.efforts).toEqual([])
    expect(byId["gpt-5.3-codex"]?.efforts).toEqual(["low", "high", "xhigh"])
    expect(byId["claude-opus-5-thinking"]?.efforts).toEqual(["high"])
    expect(byId["claude-opus-5-5"]?.efforts).toEqual(["max"])
    expect(byId["gpt-5.3-codex"]?.label).toMatch(/Codex 5\.3/)
  })

  it("strips effort and fast suffixes from ids", () => {
    expect(parseCursorModelId("grok-4.7-high")).toEqual({
      familyId: "grok-4.7",
      id: "grok-4.7-high",
      effort: "high",
      fast: false,
    })
    expect(parseCursorModelId("gpt-5.3-codex-low-fast")).toEqual({
      familyId: "gpt-5.3-codex",
      id: "gpt-5.3-codex-low-fast",
      effort: "low",
      fast: true,
    })
  })

  it("composes preferring non-fast ids", () => {
    const ids = [
      "gpt-5.3-codex",
      "gpt-5.3-codex-high",
      "gpt-5.3-codex-high-fast",
      "only-fast-low-fast",
    ]
    expect(composeCursorModelId("gpt-5.3-codex", "high", ids)).toBe(
      "gpt-5.3-codex-high"
    )
    expect(composeCursorModelId("gpt-5.3-codex", undefined, ids)).toBe(
      "gpt-5.3-codex"
    )
    expect(composeCursorModelId("only-fast", "low", ids)).toBe(
      "only-fast-low-fast"
    )
  })
})
