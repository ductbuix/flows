import { describe, expect, it } from "vitest"
import { workflowSchema } from "./index.ts"
import {
  answerText,
  fillTemplate,
  parseAnswer,
  parseAnswerText,
  resolveAnswerValues,
  templateNames,
  templateProblems,
  type AnswerDecl,
} from "./answers.ts"

const decls: AnswerDecl[] = [
  { name: "title", type: "text" },
  { name: "score", type: "number" },
  { name: "ready", type: "yesno" },
  { name: "tags", type: "list" },
  { name: "risk", type: "choice", labels: ["low", "high"] },
]
const good = { title: "T", score: 3, ready: true, tags: ["a"], risk: "low" }

describe("parseAnswer", () => {
  it("accepts a match and drops extra keys", () => {
    const r = parseAnswer(decls, { ...good, extra: 1 })
    expect(r).toEqual({ ok: true, value: good })
  })

  it("names every field that is missing or the wrong type", () => {
    const r = parseAnswer(decls, { title: 1, ready: "yes", tags: [1], risk: "mid" })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain("title: must be a string")
    expect(r.error).toContain("score: missing")
    expect(r.error).toContain("ready: must be true or false")
    expect(r.error).toContain("tags: must be an array of strings")
    expect(r.error).toContain("risk: must be one of low, high")
  })

  it("rejects non-objects and NaN", () => {
    expect(parseAnswer(decls, []).ok).toBe(false)
    expect(parseAnswer(decls, null).ok).toBe(false)
    expect(parseAnswer(decls, { ...good, score: Number.NaN }).ok).toBe(false)
  })
})

describe("parseAnswerText", () => {
  const json = JSON.stringify(good)
  it("reads a bare object, a fenced block, and the last of several", () => {
    expect(parseAnswerText(decls, json).ok).toBe(true)
    expect(parseAnswerText(decls, `Here you go\n\`\`\`json\n${json}\n\`\`\`\n`).ok).toBe(true)
    const two = `\`\`\`json\n{"title":1}\n\`\`\`\nfixed:\n\`\`\`json\n${json}\n\`\`\``
    expect(parseAnswerText(decls, two).ok).toBe(true)
    expect(parseAnswerText(decls, `Summary text\n${json}`).ok).toBe(true)
  })
  it("fails with a reason when there is no JSON", () => {
    expect(parseAnswerText(decls, "no json here")).toEqual({
      ok: false,
      error: "no JSON answer found",
    })
  })
})

describe("templates", () => {
  it("finds names and fills the ones with a value", () => {
    expect(templateNames("a {{x}} b {{ y }} {{x}} {{1no}}")).toEqual(["x", "y"])
    expect(
      fillTemplate("{{risk}}, {{ready}}, {{tags}}, {{score}}, {{gone}}", {
        risk: "low",
        ready: false,
        tags: ["a", "b"],
        score: 2,
      })
    ).toBe("low, no, a, b, 2, {{gone}}")
  })

  it("writes the step text as name: value lines", () => {
    expect(answerText(decls.slice(0, 3), good)).toBe(
      "title: T\nscore: 3\nready: yes\n"
    )
  })
})

const nodes = [
  { id: "a", kind: "agent", answers: [{ name: "risk", type: "text" }] },
  { id: "b", kind: "llm", answers: [{ name: "risk", type: "text" }, { name: "n", type: "number" }] },
  { id: "c", kind: "agent" },
] as unknown as Parameters<typeof templateProblems>[0]

describe("ambiguity", () => {
  const edges = [
    { from: "a", to: "c" },
    { from: "b", to: "c" },
  ]
  it("flags a name two upstream nodes declare", () => {
    const p = templateProblems(nodes, edges, [
      { nodeId: "c", label: "prompt.md", text: "{{risk}} and {{n}} and {{none}}" },
    ])
    expect(p).toHaveLength(1)
    expect(p[0]!.message).toBe("{{risk}} is ambiguous: a and b both declare it")
  })

  it("passes when only one upstream node declares the name", () => {
    expect(
      templateProblems(nodes, [{ from: "a", to: "c" }], [
        { nodeId: "c", label: "prompt.md", text: "{{risk}}" },
      ])
    ).toEqual([])
  })

  it("does not count a node's own answers", () => {
    const loop = [
      { from: "a", to: "c" },
      { from: "c", to: "a" },
    ]
    expect(
      templateProblems(nodes, loop, [{ nodeId: "a", label: "prompt.md", text: "{{risk}}" }])
    ).toEqual([])
  })

  it("resolves each unambiguous name from the node that declares it", () => {
    const v = resolveAnswerValues(nodes, edges, "c", (id) =>
      id === "b" ? { risk: "high", n: 4 } : { risk: "low" }
    )
    expect(v).toEqual({ n: 4 })
  })
})

describe("answers in the workflow schema", () => {
  const wf = (nodesIn: object[], edges: object[]) => ({
    id: "w",
    nodes: nodesIn,
    edges,
  })
  const issues = (v: unknown) => {
    const r = workflowSchema.safeParse(v)
    return r.success ? [] : r.error.issues.map((i) => i.message)
  }
  it("accepts answers on an LLM node and fills the approval question", () => {
    expect(
      issues(
        wf(
          [
            { id: "t", kind: "trigger", type: "manual" },
            { id: "l", kind: "llm", cli: "claude", answers: [{ name: "risk", type: "choice", labels: ["low"] }] },
            { id: "p", kind: "approval", question: "Risk is {{risk}}?" },
          ],
          [
            { from: "t", to: "l" },
            { from: "l", to: "p" },
          ]
        )
      )
    ).toEqual([])
  })

  it("fails an approval question that names an ambiguous answer", () => {
    const msgs = issues(
      wf(
        [
          { id: "t", kind: "trigger", type: "manual" },
          { id: "a", kind: "llm", cli: "claude", answers: [{ name: "x", type: "text" }] },
          { id: "b", kind: "agent", cli: "claude", answers: [{ name: "x", type: "text" }] },
          { id: "p", kind: "approval", question: "{{x}}?" },
        ],
        [
          { from: "t", to: "a" },
          { from: "t", to: "b" },
          { from: "a", to: "p" },
          { from: "b", to: "p" },
        ]
      )
    )
    expect(msgs).toEqual(["question: {{x}} is ambiguous: a and b both declare it"])
  })

  it("rejects bad declarations", () => {
    const one = (answers: object[]) =>
      issues(
        wf([{ id: "l", kind: "llm", cli: "claude", answers }], [])
      )
    expect(one([{ name: "1x", type: "text" }]).length).toBeGreaterThan(0)
    expect(one([{ name: "x", type: "choice" }])).toContain("choice needs labels")
    expect(one([{ name: "x", type: "text", labels: ["a"] }])).toContain(
      "labels are only for choice"
    )
    expect(
      one([{ name: "x", type: "text" }, { name: "x", type: "number" }])
    ).toContain("duplicate answer name")
    const many = Array.from({ length: 21 }, (_, i) => ({ name: `n${i}`, type: "text" }))
    expect(one(many).length).toBeGreaterThan(0)
  })
})
