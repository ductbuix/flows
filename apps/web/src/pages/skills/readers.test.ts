import { describe, expect, it } from "vitest"
import type { WireSkillSummary } from "@workspace/contracts"
import { readers } from "./readers"

const base = (
  partial: Partial<WireSkillSummary> & Pick<WireSkillSummary, "slug" | "scope">
): WireSkillSummary => ({
  name: partial.slug,
  description: "desc",
  dirs: [".agents"],
  ...partial,
})

describe("readers", () => {
  it("marks invalid skills as unread", () => {
    const skill = base({
      slug: "broken",
      scope: "workspace",
      dirs: [".claude"],
      problem: "no description",
    })
    expect(readers(skill, [skill])).toEqual({
      cursor: false,
      claude: null,
      note: "Not offered: it breaks the spec.",
    })
  })

  it("workspace .claude is read by both", () => {
    const skill = base({
      slug: "write-tests",
      scope: "workspace",
      dirs: [".agents", ".claude"],
    })
    expect(readers(skill, [skill]).claude).toBe("write-tests")
  })

  it("home .agents alone uses the agents plugin for Claude", () => {
    const skill = base({
      slug: "summarize-pr",
      scope: "home",
      dirs: [".agents"],
    })
    expect(readers(skill, [skill]).claude).toBe("agents:summarize-pr")
  })
})
