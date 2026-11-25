import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const nodeLlmYaml = (
  id: string,
  cli: "claude" | "cursor" = "claude"
) => `id: ${id}
goal: e2e llm node
nodes:
  - id: start
    kind: trigger
    type: manual
  - id: write
    kind: llm
    cli: ${cli}
  - id: show
    kind: command
    run: 'cat $NODE_IN/text.md'
edges:
  - { from: start, to: write }
  - { from: write, to: show }
`

const nodeAnswersYaml = (id: string) => `id: ${id}
goal: e2e named answers
nodes:
  - id: start
    kind: trigger
    type: manual
  - id: assess
    kind: llm
    cli: claude
    answers:
      - { name: risk, type: choice, labels: [low, high] }
      - { name: score, type: number }
  - id: note
    kind: llm
    cli: claude
  - id: show
    kind: command
    run: 'cat $NODE_IN/text.md'
edges:
  - { from: start, to: assess }
  - { from: assess, to: note }
  - { from: note, to: show }
`

/** LLM workflows for node-llm.spec.ts (BL-083) and the ACP llm workflow (BL-142). */
export function seedLlmWorkflows(home: string): void {
  // LLM workflows for node-llm.spec.ts (BL-083); each test owns one.
  for (const id of [
    "node-llm-light",
    "node-llm-dark",
    "node-llm-light-view",
    "node-llm-dark-view",
  ]) {
    const dir = join(home, "workflows", id)
    mkdirSync(join(dir, "nodes", "write"), { recursive: true })
    writeFileSync(join(dir, "workflow.yaml"), nodeLlmYaml(id))
    writeFileSync(
      join(dir, "nodes", "write", "prompt.md"),
      "Write one line about the weather.\n"
    )
  }
  // ACP llm workflow (BL-142); agents.runtime toggled in the spec.
  {
    const id = "node-llm-acp"
    const dir = join(home, "workflows", id)
    mkdirSync(join(dir, "nodes", "write"), { recursive: true })
    writeFileSync(join(dir, "workflow.yaml"), nodeLlmYaml(id, "cursor"))
    writeFileSync(
      join(dir, "nodes", "write", "prompt.md"),
      "Write one line about the weather.\n"
    )
  }
}

/** Named answers for node-answers.spec.ts (BL-085), plus the add-an-llm fixture. */
export function seedAnswersWorkflows(home: string): void {
  // Named answers for node-answers.spec.ts (BL-085); each test owns one.
  for (const id of [
    "node-answers-light",
    "node-answers-dark",
    "node-answers-sheet-light",
    "node-answers-sheet-dark",
  ]) {
    const dir = join(home, "workflows", id)
    mkdirSync(join(dir, "nodes", "assess"), { recursive: true })
    mkdirSync(join(dir, "nodes", "note"), { recursive: true })
    writeFileSync(join(dir, "workflow.yaml"), nodeAnswersYaml(id))
    writeFileSync(
      join(dir, "nodes", "assess", "prompt.md"),
      "Assess the weather.\n"
    )
    writeFileSync(
      join(dir, "nodes", "note", "prompt.md"),
      "Risk is {{risk}}, score {{score}}.\n"
    )
  }
  const llmAdd = join(home, "workflows", "node-llm-add")
  mkdirSync(llmAdd, { recursive: true })
  writeFileSync(
    join(llmAdd, "workflow.yaml"),
    "id: node-llm-add\ngoal: e2e add an llm\nnodes: []\nedges: []\n"
  )
}
