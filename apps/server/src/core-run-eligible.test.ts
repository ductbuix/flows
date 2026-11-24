import { describe, expect, it } from "vitest"
import { parseNodeWorkflowYaml } from "@workspace/contracts"
import { isCoreRunEligible } from "./core-run-eligible.ts"

describe("isCoreRunEligible", () => {
  it("accepts ported kinds including llm/agent/publish; rejects loops", () => {
    const ok = parseNodeWorkflowYaml(`
id: demo
nodes:
  - { id: t, kind: trigger, type: manual }
  - { id: a, kind: command, run: "true" }
edges:
  - { from: t, to: a }
`).workflow!
    expect(isCoreRunEligible(ok)).toBe(true)

    // Prompt/asset have no in-ports; they run as sources beside the trigger.
    const prompt = parseNodeWorkflowYaml(`
id: prompt-demo
nodes:
  - { id: t, kind: trigger, type: manual }
  - { id: p, kind: prompt }
`).workflow!
    expect(isCoreRunEligible(prompt)).toBe(true)

    const asset = parseNodeWorkflowYaml(`
id: asset-demo
nodes:
  - { id: t, kind: trigger, type: manual }
  - id: a
    kind: asset
    resources:
      - { connection: demo, entity: item, id: alpha }
`).workflow!
    expect(isCoreRunEligible(asset)).toBe(true)

    const approval = parseNodeWorkflowYaml(`
id: other
nodes:
  - { id: t, kind: trigger, type: manual }
  - { id: a, kind: approval, question: "Go?" }
edges:
  - { from: t, to: a }
`).workflow!
    expect(isCoreRunEligible(approval)).toBe(true)

    const notify = parseNodeWorkflowYaml(`
id: notify-demo
nodes:
  - { id: t, kind: trigger, type: manual }
  - { id: n, kind: output, target: notify, title: Hi }
edges:
  - { from: t, to: n }
`).workflow!
    expect(isCoreRunEligible(notify)).toBe(true)

    const folder = parseNodeWorkflowYaml(`
id: folder-demo
nodes:
  - { id: t, kind: trigger, type: manual }
  - { id: o, kind: output, target: folder }
edges:
  - { from: t, to: o }
`).workflow!
    expect(isCoreRunEligible(folder)).toBe(true)

    const llm = parseNodeWorkflowYaml(`
id: llm-demo
nodes:
  - { id: t, kind: trigger, type: manual }
  - { id: l, kind: llm, cli: cursor }
edges:
  - { from: t, to: l }
`).workflow!
    expect(isCoreRunEligible(llm)).toBe(true)

    const judgeRule = parseNodeWorkflowYaml(`
id: judge-rule
nodes:
  - { id: t, kind: trigger, type: manual }
  - { id: j, kind: judge, cli: cursor }
edges:
  - { from: t, to: j }
`).workflow!
    expect(isCoreRunEligible(judgeRule)).toBe(true)

    const agent = parseNodeWorkflowYaml(`
id: agent-demo
nodes:
  - { id: t, kind: trigger, type: manual }
  - { id: a, kind: agent, cli: cursor }
edges:
  - { from: t, to: a }
`).workflow!
    expect(isCoreRunEligible(agent)).toBe(true)

    expect(
      isCoreRunEligible({
        id: "publish-demo",
        nodes: [
          { id: "t", kind: "trigger", type: "manual" },
          { id: "p", kind: "output", target: "publish", connection: "demo" },
        ],
        edges: [{ from: "t", to: "p" }],
      })
    ).toBe(true)

    const loop = parseNodeWorkflowYaml(`
id: loop-demo
nodes:
  - { id: t, kind: trigger, type: manual }
  - { id: a, kind: command, run: "true" }
  - { id: b, kind: command, run: "true" }
edges:
  - { from: t, to: a }
  - { from: a, to: b }
  - { from: b, to: a }
`).workflow!
    expect(isCoreRunEligible(loop)).toBe(false)
  })
})

