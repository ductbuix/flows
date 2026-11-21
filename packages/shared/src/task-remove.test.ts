import { describe, expect, it } from "vitest"
import {
  collectMentionHits,
  dependentsOf,
  removedTaskIds,
  taskLabel,
} from "./task-remove.ts"
import type { Workflow } from "./workflow.ts"

const base: Workflow = {
  id: "w",
  tasks: [
    { id: "a", kind: "command", run: "echo a", needs: [] },
    {
      id: "b",
      name: "Beta",
      kind: "command",
      run: "echo b",
      needs: ["a"],
    },
    {
      id: "c",
      kind: "command",
      run: 'printf x > "$UPSTREAM_a/out"',
      needs: [{ task: "a" }],
    },
    {
      id: "d",
      kind: "agent",
      cli: "cursor",
      needs: ["b"],
    },
  ],
}

describe("taskLabel", () => {
  it("falls back to id", () => {
    expect(taskLabel({ id: "a" })).toBe("a")
    expect(taskLabel({ id: "a", name: "Alpha" })).toBe("Alpha")
  })
})

describe("dependentsOf", () => {
  it("lists tasks that need the removed id by name or id", () => {
    expect(dependentsOf(base, "a")).toEqual([
      { id: "b", label: "Beta" },
      { id: "c", label: "c" },
    ])
    expect(dependentsOf(base, "b")).toEqual([{ id: "d", label: "d" }])
    expect(dependentsOf(base, "d")).toEqual([])
  })
})

describe("collectMentionHits", () => {
  it("finds run and prompt mentions of id and UPSTREAM_*", () => {
    const prompts = new Map([
      ["d", "Read from task a then UPSTREAM_b"],
      ["missing", "unused"],
    ])
    const hits = collectMentionHits(base, "a", prompts)
    expect(hits).toEqual([
      { taskId: "c", label: "c", where: "run" },
      { taskId: "d", label: "d", where: "prompt" },
    ])
  })

  it("skips the removed task, short-id substrings, and missing prompts", () => {
    // "echo a" must not count as mentioning task "c"
    expect(collectMentionHits(base, "c", new Map())).toEqual([])
  })
})

describe("removedTaskIds", () => {
  it("diffs task ids", () => {
    const after: Workflow = {
      ...base,
      tasks: base.tasks.filter((t) => t.id !== "a"),
    }
    expect(removedTaskIds(base, after)).toEqual(["a"])
  })
})
