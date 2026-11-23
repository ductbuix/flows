import { describe, expect, it } from "vitest"
import { parseTopic, updateMatchesTopic } from "./topics.ts"

describe("update topic matching", () => {
  it("parses namespace and scoped topics", () => {
    expect(parseTopic("docket")).toEqual({
      kind: "namespace",
      namespace: "docket",
    })
    expect(parseTopic("run:r-1")).toEqual({
      kind: "scoped",
      namespace: "run",
      id: "r-1",
    })
  })

  it("matches namespace notifications", () => {
    expect(
      updateMatchesTopic("docket", "docket/update", {
        kind: "card_changed",
      })
    ).toBe(true)
    expect(
      updateMatchesTopic("inbox", "docket/update", { kind: "card_changed" })
    ).toBe(false)
  })

  it("filters run heavy kinds on the run topic", () => {
    expect(
      updateMatchesTopic("run", "run/update", {
        kind: "run_changed",
        runId: "r-1",
      })
    ).toBe(true)
    expect(
      updateMatchesTopic("run", "run/update", {
        kind: "log_chunk",
        runId: "r-1",
      })
    ).toBe(false)
  })

  it("scopes run updates by id", () => {
    expect(
      updateMatchesTopic("run:r-1", "run/update", {
        kind: "log_chunk",
        runId: "r-1",
      })
    ).toBe(true)
    expect(
      updateMatchesTopic("run:r-1", "run/update", {
        kind: "log_chunk",
        runId: "r-2",
      })
    ).toBe(false)
  })
})
