import { describe, expect, it } from "vitest"
import type { WireSkillSummary } from "@workspace/contracts"
import { statusOf, whereLabel } from "./status"

const skill = (
  partial: Partial<WireSkillSummary> & Pick<WireSkillSummary, "slug">
): WireSkillSummary => ({
  name: partial.slug,
  description: "d",
  scope: "workspace",
  dirs: [".agents", ".claude"],
  ...partial,
})

describe("statusOf", () => {
  it("flags invalid, read-only, installed and stale", () => {
    expect(statusOf(skill({ slug: "a", problem: "x" })).label).toBe("Invalid")
    expect(statusOf(skill({ slug: "b" })).label).toBe("Read-only")
    expect(
      statusOf(skill({ slug: "c", from: { sourceId: "repo", version: 2 } }))
        .label
    ).toBe("Installed v2")
    expect(
      statusOf(skill({ slug: "d", from: { sourceId: "repo", version: 1 } }), 3)
        .label
    ).toBe("Update available")
  })
})

describe("whereLabel", () => {
  it("prefixes home with ~", () => {
    expect(
      whereLabel(skill({ slug: "x", scope: "home", dirs: [".agents"] }))
    ).toBe("~/.agents/skills")
  })
})
