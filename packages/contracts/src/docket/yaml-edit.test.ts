import { describe, expect, it } from "vitest"
import {
  joinCardMd,
  patchCardMd,
  patchYamlMapping,
  splitCardMd,
} from "./yaml-edit.ts"

const cardFixture = `---
id: fix-flaky-login
title: Fix flaky login test
status: doing
created: 2026-11-20T09:12:00Z
updated: 2026-11-23T08:00:00Z
# sprint note
x-custom: kept
---

The login test flakes on CI.
`

describe("docket yaml edit", () => {
  it("patches card frontmatter keeping comments and unknown keys", () => {
    const next = patchCardMd(cardFixture, {
      title: "Fix login flake",
      updated: "2026-11-24T01:00:00Z",
    })
    expect(next).toContain("# sprint note")
    expect(next).toContain("x-custom: kept")
    expect(next).toContain("title: Fix login flake")
    expect(next).toContain("The login test flakes on CI.")
    const split = splitCardMd(next)
    expect(split?.body).toContain("The login test flakes on CI.")
  })

  it("patches board yaml keeping comments and unknown keys", () => {
    const board = `# columns
version: 1
columns:
  - { id: todo, label: Todo }
x-board: meta
face: [due]
`
    const next = patchYamlMapping(board, {
      face: ["due", "fields.assignee"],
    })
    expect(next).toContain("# columns")
    expect(next).toContain("x-board: meta")
    expect(next).toContain("fields.assignee")
  })

  it("round-trips card md fences", () => {
    const split = splitCardMd(cardFixture)
    expect(split).not.toBeNull()
    const round = joinCardMd(split!.frontmatter, split!.body)
    expect(round).toBe(cardFixture)
  })
})
