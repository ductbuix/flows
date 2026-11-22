import { describe, expect, it } from "vitest"
import { NODE_KINDS, PORT_TABLE, workflowSchema } from "./index.ts"

const sample = {
  id: "story-fix",
  name: "Fix a story",
  goal: "Draft a fix",
  limits: { concurrency: 3, agents: 2, maxConcurrentRuns: 1, loopPasses: 5 },
  timeout: 900,
  agent: { cursor: { model: "gpt-5", effort: "high" } },
  nodes: [
    {
      id: "node-1a2b3c4d",
      kind: "trigger",
      name: "Start",
      type: "manual",
      inputs: [{ name: "story", type: "markdown", required: true }],
    },
    { id: "node-3c4d5e6f", kind: "prompt", name: "House rules" },
    {
      id: "node-4d5e6f70",
      kind: "agent",
      name: "Draft fix",
      cli: "cursor",
      memory: ["memory/style.md"],
      answers: [{ name: "risk", type: "choice", labels: ["low", "high"] }],
      retry: { max: 1 },
    },
    { id: "node-5a", kind: "command", run: "pnpm test" },
    { id: "node-8192a3b4", kind: "output", name: "Notes", target: "folder" },
  ],
  edges: [
    { from: "node-1a2b3c4d", to: "node-4d5e6f70" },
    { from: "node-3c4d5e6f", to: "node-4d5e6f70" },
    { from: "node-4d5e6f70", to: "node-5a", port: "file" },
    { from: "node-5a", to: "node-4d5e6f70" }, // cycle is allowed
    { from: "node-4d5e6f70", to: "node-8192a3b4", port: "file" },
  ],
}

const withEdges = (edges: object[]) => ({ ...sample, edges })
const messages = (v: unknown) => {
  const r = workflowSchema.safeParse(v)
  return r.success ? [] : r.error.issues.map((i) => i.message)
}

describe("node workflow schema", () => {
  it("parses the sample and defaults loopPasses", () => {
    const r = workflowSchema.parse(sample)
    expect(r.nodes).toHaveLength(5)
    const { limits: _l, ...rest } = sample
    expect(workflowSchema.parse(rest).limits).toBeUndefined()
    expect(
      workflowSchema.parse({ ...rest, limits: { agents: 1 } }).limits
        ?.loopPasses
    ).toBe(5)
  })

  it("has one port table row per kind", () => {
    expect(Object.keys(PORT_TABLE)).toEqual(NODE_KINDS.map((k) => k.kind))
  })

  it("rejects strict-setting typos and unknown kinds", () => {
    const bad = (n: object) => ({ ...sample, nodes: [n] , edges: [] })
    expect(
      messages(bad({ id: "a", kind: "agent", cli: "claude", mdoel: "x" }))
    ).not.toEqual([])
    expect(messages(bad({ id: "a", kind: "judge" }))).not.toEqual([])
    expect(
      messages(bad({ id: "a", kind: "output", target: "publish" }))
    ).not.toEqual([])
  })

  it("rejects bad edges", () => {
    const m = (e: object[]) => messages(withEdges(e)).join("|")
    expect(m([{ from: "node-1a2b3c4d", to: "nope" }])).toContain("unknown node")
    expect(m([{ from: "node-3c4d5e6f", to: "node-5a", port: "file" }])).toContain(
      "no out port file"
    )
    expect(m([{ from: "node-4d5e6f70", to: "node-1a2b3c4d" }])).toContain(
      "no in port text"
    )
    expect(m([{ from: "node-8192a3b4", to: "node-5a" }])).toContain(
      "no out port"
    )
    expect(
      m([{ from: "node-4d5e6f70", to: "node-5a", branch: "yes" }])
    ).toContain("branch is not allowed")
    expect(
      m([
        { from: "node-4d5e6f70", to: "node-5a" },
        { from: "node-4d5e6f70", to: "node-5a" },
      ])
    ).toContain("duplicate edge")
  })

  it("rejects duplicate node ids", () => {
    expect(
      messages({ ...sample, nodes: [sample.nodes[1], sample.nodes[1]], edges: [] })
        .join("|")
    ).toContain("duplicate node id")
  })

  it.each(["tasks", "needs", "when", "repeat", "approval", "spawn", "uses"])(
    "rejects old key %s",
    (key) => {
      const msgs = messages({ ...sample, [key]: [] })
      expect(msgs).toHaveLength(1)
      expect(msgs[0]).toContain(`"${key}"`)
    }
  )

  it("names the first old key when several are present", () => {
    const msgs = messages({ ...sample, uses: [], tasks: [] })
    expect(msgs[0]).toContain('"tasks"')
  })
})

describe("judge kind", () => {
  const wf = (edges: unknown[]) => ({
    id: "wf",
    nodes: [
      { id: "t", kind: "trigger", type: "manual" },
      { id: "j", kind: "judge", cli: "claude", effort: "low" },
      { id: "a", kind: "command", run: "echo a" },
    ],
    edges,
  })

  it("has yes and no branches and a required rule file", () => {
    expect(PORT_TABLE.judge?.branches).toEqual(["yes", "no"])
    expect(NODE_KINDS.find((k) => k.kind === "judge")?.files).toEqual([
      { path: "rule.md", required: true },
    ])
  })

  it("accepts edges with a branch and refuses ones without", () => {
    const ok = workflowSchema.safeParse(
      wf([
        { from: "t", to: "j" },
        { from: "j", to: "a", branch: "yes" },
      ])
    )
    expect(ok.success).toBe(true)
    const bad = workflowSchema.safeParse(wf([{ from: "j", to: "a" }]))
    expect(bad.success).toBe(false)
    expect(JSON.stringify(bad.error?.issues)).toContain("needs branch yes or no")
  })
})

describe("llm kind", () => {
  it("has text out only and a required prompt with an optional system file", () => {
    expect(PORT_TABLE.llm).toMatchObject({ in: ["text", "file"], out: ["text"] })
    expect(NODE_KINDS.find((k) => k.kind === "llm")?.files).toEqual([
      { path: "prompt.md", required: true },
      { path: "system.md", required: false },
    ])
  })

  it("needs a cli and refuses a file out port", () => {
    const wf = (edge: object) => ({
      id: "wf",
      nodes: [
        { id: "l", kind: "llm", cli: "cursor", model: "auto", effort: "low" },
        { id: "o", kind: "output", target: "folder" },
      ],
      edges: [edge],
    })
    expect(workflowSchema.safeParse(wf({ from: "l", to: "o" })).success).toBe(true)
    expect(
      workflowSchema.safeParse(wf({ from: "l", to: "o", port: "file" })).success
    ).toBe(false)
    expect(
      workflowSchema.safeParse({
        id: "wf",
        nodes: [{ id: "l", kind: "llm" }],
        edges: [],
      }).success
    ).toBe(false)
  })
})
