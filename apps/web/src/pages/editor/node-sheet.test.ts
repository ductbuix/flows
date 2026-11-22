import { describe, expect, it } from "vitest"
import {
  inputProblem,
  nextInputName,
  parsePositiveInt,
  settingKeys,
} from "./node-sheet"

describe("node-sheet", () => {
  it("reads which settings a kind has", () => {
    expect(settingKeys("command").has("timeout")).toBe(true)
    expect(settingKeys("agent").has("memory")).toBe(true)
    expect(settingKeys("command").has("memory")).toBe(false)
    expect(settingKeys("trigger").has("inputs")).toBe(true)
    expect(settingKeys("output").has("timeout")).toBe(false)
  })

  it("parses positive whole numbers", () => {
    expect(parsePositiveInt("30")).toBe(30)
    expect(parsePositiveInt(" ")).toBeUndefined()
    expect(parsePositiveInt("0")).toBeNull()
    expect(parsePositiveInt("1.5")).toBeNull()
    expect(parsePositiveInt("abc")).toBeNull()
  })

  it("names new inputs and checks rows", () => {
    const a = { name: "input1", type: "text" as const, required: false }
    expect(nextInputName([a])).toBe("input2")
    expect(inputProblem(a, [])).toBeNull()
    expect(inputProblem({ ...a, name: "" }, [])).toBeTruthy()
    expect(inputProblem({ ...a, name: "attach" }, [])).toBeTruthy()
    expect(inputProblem(a, [a])).toMatch(/duplicate/)
  })
})
