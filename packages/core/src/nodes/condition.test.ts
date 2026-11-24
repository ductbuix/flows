import { describe, expect, it } from "vitest"
import { createFakeAgentRuntime } from "../testing/fake-agent-runtime.ts"
import { createFakeDocumentStore } from "../testing/fake-document-store.ts"
import { createStepContext } from "./context.ts"
import {
  CONDITION_BRANCHES,
  conditionBranch,
  conditionKind,
} from "./kinds/condition.ts"
import { collectExecute } from "./run.ts"

const runDir = "workflows/wf/runs/r1"

async function runCondition(answer: string) {
  const docs = createFakeDocumentStore()
  docs.write(`${runDir}/nodes/c/frozen/prompt.md`, "Did tests pass?\n")
  const runtime = createFakeAgentRuntime().onPrompt(async function* () {
    yield { kind: "message_chunk", text: answer }
    yield { kind: "stop", reason: "end_turn" }
  })
  const ctx = createStepContext({
    docs,
    runDir,
    nodeId: "c",
    pass: 1,
    settings: { cli: "cursor" as const, model: "composer-1" },
    inputs: [
      {
        from: "t",
        path: `${runDir}/nodes/t/pass-1/text.md`,
        name: "text.md",
        text: "all green",
      },
    ],
    graph: { id: "wf" },
    agentRuntime: runtime,
    agentCwd: "/tmp/step",
  })
  const result = await collectExecute(conditionKind.execute(ctx))
  return { docs, runtime, result }
}

describe("condition kind (ACP)", () => {
  it.each([
    ["yes", "yes"],
    ["Yes, all passed.", "yes"],
    ["true", "yes"],
    ["no", "no"],
    ["**No**: two failed", "no"],
    ["false", "no"],
  ] as const)(
    "%s takes the %s branch and keeps the answer",
    async (answer, branch) => {
      const { docs, runtime, result } = await runCondition(answer)
      expect(result).toEqual({
        ok: true,
        outputs: ["nodes/c/pass-1/answer.md", "nodes/c/pass-1/text.md"],
        branch,
      })
      expect(docs.read(`${runDir}/nodes/c/pass-1/answer.md`)?.text).toBe(
        answer.trim()
      )
      expect(docs.read(`${runDir}/nodes/c/pass-1/text.md`)?.text).toContain(
        "all green"
      )
      expect(runtime.opens).toEqual([
        {
          profileId: "cursor",
          cwd: "/tmp/step",
          mode: "ask",
          model: "composer-1",
        },
      ])
    }
  )

  it("fails unclear and keeps the text when the answer is unparsable", async () => {
    const answer = "Maybe, it depends."
    const { docs, runtime, result } = await runCondition(answer)
    expect(result).toEqual({
      ok: false,
      reason: "unclear",
      message: answer,
    })
    expect(docs.read(`${runDir}/nodes/c/pass-1/answer.md`)?.text).toBe(answer)
    expect(docs.read(`${runDir}/nodes/c/pass-1/text.md`)).toBeNull()
    expect(runtime.opens[0]?.mode).toBe("ask")
  })

  it("fails when prompt is missing", async () => {
    const docs = createFakeDocumentStore()
    const runtime = createFakeAgentRuntime()
    const ctx = createStepContext({
      docs,
      runDir,
      nodeId: "c",
      pass: 1,
      settings: { cli: "cursor" as const },
      inputs: [],
      graph: { id: "wf" },
      agentRuntime: runtime,
    })
    await expect(collectExecute(conditionKind.execute(ctx))).resolves.toEqual({
      ok: false,
      reason: "exit",
      message: "missing_prompt",
    })
    expect(runtime.opens).toHaveLength(0)
  })
})

describe("conditionBranch", () => {
  it("reads the first word against branch names", () => {
    expect(conditionBranch("yes")).toBe("yes")
    expect(conditionBranch("  TRUE\n")).toBe("yes")
    expect(conditionBranch("No.")).toBe("no")
    expect(conditionBranch("false because")).toBe("no")
    expect(conditionBranch("I think yes")).toBeUndefined()
    expect(conditionBranch("yesterday")).toBeUndefined()
    expect(conditionBranch("")).toBeUndefined()
    expect(CONDITION_BRANCHES).toEqual(["yes", "no"])
  })
})
