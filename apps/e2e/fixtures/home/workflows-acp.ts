import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

/** Core ACP agent workflows with permission ask, question ask, and plan review (BL-195). */
export function seedAcpWorkflows(home: string): void {
  // Core ACP agent with a permission ask (BL-195); fake agent sees ASK_PERMISSION.
  {
    const id = "agent-acp-ask"
    const dir = join(home, "workflows", id)
    mkdirSync(join(dir, "nodes", "work"), { recursive: true })
    writeFileSync(
      join(dir, "workflow.yaml"),
      `id: ${id}
goal: e2e agent permission ask on core
nodes:
  - { id: start, kind: trigger, type: manual }
  - { id: work, kind: agent, cli: cursor }
edges:
  - { from: start, to: work }
`
    )
    writeFileSync(
      join(dir, "nodes", "work", "prompt.md"),
      "ASK_PERMISSION then finish.\n"
    )
  }
  {
    const id = "agent-acp-question"
    const dir = join(home, "workflows", id)
    mkdirSync(join(dir, "nodes", "work"), { recursive: true })
    writeFileSync(
      join(dir, "workflow.yaml"),
      `id: ${id}
goal: e2e agent question ask on core
nodes:
  - { id: start, kind: trigger, type: manual }
  - { id: work, kind: agent, cli: cursor }
edges:
  - { from: start, to: work }
`
    )
    writeFileSync(
      join(dir, "nodes", "work", "prompt.md"),
      "ASK_QUESTION then finish.\n"
    )
  }
  {
    const id = "agent-acp-plan"
    const dir = join(home, "workflows", id)
    mkdirSync(join(dir, "nodes", "write"), { recursive: true })
    writeFileSync(
      join(dir, "workflow.yaml"),
      `id: ${id}
goal: e2e llm plan review ask on core
nodes:
  - { id: start, kind: trigger, type: manual }
  - { id: write, kind: llm, cli: cursor, planReview: ask }
edges:
  - { from: start, to: write }
`
    )
    writeFileSync(
      join(dir, "nodes", "write", "prompt.md"),
      "ASK_PLAN_REVIEW then finish.\n"
    )
  }
}
