import { describe, expect, it } from "vitest"
import { parseArgs } from "./args.ts"

describe("parseArgs", () => {
  it("parses engine --stdio, inbox, and run with optional card", () => {
    expect(parseArgs(["engine", "--stdio"])).toEqual({
      name: "engine",
      stdio: true,
    })
    expect(parseArgs(["inbox"])).toEqual({ name: "inbox" })
    expect(parseArgs(["run", "demo"])).toEqual({
      name: "run",
      workflowId: "demo",
      cardId: undefined,
    })
    expect(parseArgs(["run", "demo", "--card", "my-card"])).toEqual({
      name: "run",
      workflowId: "demo",
      cardId: "my-card",
    })
  })

  it("rejects unknown commands and bad run usage", () => {
    expect(() => parseArgs(["engine"])).toThrow(/stdio/)
    expect(() => parseArgs(["run"])).toThrow(/usage/)
    expect(() => parseArgs(["nope"])).toThrow(/unknown/)
  })
})
