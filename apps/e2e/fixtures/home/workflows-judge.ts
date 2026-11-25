import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const nodeJudgeYaml = (id: string) => `id: ${id}
goal: e2e judge node
nodes:
  - id: start
    kind: trigger
    type: manual
  - id: check
    kind: judge
    cli: claude
  - id: approved
    kind: command
    run: 'echo took-yes'
  - id: rejected
    kind: command
    run: 'echo took-no'
edges:
  - { from: start, to: check }
  - { from: check, to: approved, branch: yes }
  - { from: check, to: rejected, branch: no }
`

/** Judge in check mode: an LLM answers, the Judge tests `risk` with no model (BL-101). */
const nodeJudgeCheckYaml = (id: string) => `id: ${id}
goal: e2e judge check mode
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
  - id: check
    kind: judge
    mode: check
    check: { field: risk, operator: "=", value: high }
  - id: approved
    kind: command
    run: 'echo took-yes'
  - id: rejected
    kind: command
    run: 'echo took-no'
edges:
  - { from: start, to: assess }
  - { from: assess, to: check }
  - { from: check, to: approved, branch: yes }
  - { from: check, to: rejected, branch: no }
`

/** Judge workflows for node-judge.spec.ts (BL-079) and node-judge-check.spec.ts (BL-101). */
export function seedJudgeWorkflows(home: string): void {
  // Judge workflows for node-judge.spec.ts (BL-079); each test owns one.
  for (const id of [
    "node-judge-light",
    "node-judge-dark",
    "node-judge-light-view",
    "node-judge-dark-view",
  ]) {
    const dir = join(home, "workflows", id)
    mkdirSync(join(dir, "nodes", "check"), { recursive: true })
    writeFileSync(join(dir, "workflow.yaml"), nodeJudgeYaml(id))
    writeFileSync(
      join(dir, "nodes", "check", "rule.md"),
      "Is the request reasonable?\n"
    )
  }
  const judgeAdd = join(home, "workflows", "node-judge-add")
  mkdirSync(judgeAdd, { recursive: true })
  writeFileSync(
    join(judgeAdd, "workflow.yaml"),
    "id: node-judge-add\ngoal: e2e add a judge\nnodes: []\nedges: []\n"
  )
  // Judge check mode for node-judge-check.spec.ts (BL-101); each test owns one.
  for (const id of [
    "node-judge-check-light",
    "node-judge-check-dark",
    "node-judge-check-light-view",
    "node-judge-check-dark-view",
  ]) {
    const dir = join(home, "workflows", id)
    mkdirSync(join(dir, "nodes", "assess"), { recursive: true })
    writeFileSync(join(dir, "workflow.yaml"), nodeJudgeCheckYaml(id))
    writeFileSync(
      join(dir, "nodes", "assess", "prompt.md"),
      "Assess the weather.\n"
    )
  }
}
