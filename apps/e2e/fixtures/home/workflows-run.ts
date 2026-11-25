import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { nodeRunYaml } from "./template-run"

const nodeStartYaml = (id: string) => `id: ${id}
goal: e2e node start inputs
nodes:
  - id: start
    kind: trigger
    type: manual
    inputs:
      - { name: ticket, type: text, required: true }
  - id: build
    kind: command
    run: 'cat "$RUN_INPUT/ticket.txt"'
  - id: review
    kind: agent
    cli: claude
  - id: done
    kind: output
    target: folder
edges:
  - { from: start, to: build }
  - { from: build, to: done }
`

/** Run, preview, step, history, start, and view workflows for node run specs. */
export function seedRunWorkflows(home: string): void {
  for (const theme of ["light", "dark"]) {
    const okId = `node-run-ok-${theme}`
    const okDir = join(home, "workflows", okId)
    mkdirSync(okDir, { recursive: true })
    writeFileSync(join(okDir, "workflow.yaml"), nodeRunYaml(okId, "echo built"))
    const id = `node-run-fail-${theme}`
    const dir = join(home, "workflows", id)
    mkdirSync(dir, { recursive: true })
    // Pure command fail on core (no LLM); Retry on the failed build node.
    writeFileSync(
      join(dir, "workflow.yaml"),
      nodeRunYaml(id, "echo broken >&2; exit 1")
    )
  }
  // Out-file preview for node-out-preview.spec.ts.
  {
    const id = "node-out-preview"
    const dir = join(home, "workflows", id)
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, "workflow.yaml"),
      nodeRunYaml(id, 'printf "hello out\\n" > "$NODE_OUT/text.md"')
    )
  }
  // Partial runs for node-run-step.spec.ts (BL-102); each test owns one.
  for (const id of ["node-step-light", "node-step-dark"]) {
    const dir = join(home, "workflows", id)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "workflow.yaml"), nodeRunYaml(id, "echo stepped"))
  }
  // Run history for node-run-history.spec.ts (BL-103); each test owns one.
  for (const id of ["node-history-light", "node-history-dark"]) {
    const dir = join(home, "workflows", id)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "workflow.yaml"), nodeRunYaml(id, "echo history"))
  }
  // Trigger inputs for node-start.spec.ts (BL-104); each test owns one.
  for (const id of ["node-start-light", "node-start-dark", "node-start-run"]) {
    const dir = join(home, "workflows", id)
    mkdirSync(join(dir, "nodes", "review"), { recursive: true })
    writeFileSync(join(dir, "workflow.yaml"), nodeStartYaml(id))
    writeFileSync(join(dir, "nodes", "review", "prompt.md"), "Review it.\n")
  }
  // Finished failing node runs for node-run-view.spec.ts (BL-087).
  for (const theme of ["light", "dark"]) {
    const dir = join(home, "workflows", `node-view-${theme}`)
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, "workflow.yaml"),
      nodeRunYaml(`node-view-${theme}`, "echo broken >&2; exit 1")
    )
    writeFileSync(
      join(dir, "workflow.layout.json"),
      JSON.stringify({
        version: 1,
        nodes: {
          start: { x: 0, y: 0 },
          build: { x: 400, y: 120 },
          done: { x: 800, y: 0 },
        },
      })
    )
  }
}

/** Dedicated fast workflow for RunSheet delete e2e (avoid diamond concurrency). */
export function seedSheetDelete(home: string): void {
  const id = "sheet-delete-demo"
  const dir = join(home, "workflows", id)
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, "workflow.yaml"),
    nodeRunYaml(id, "echo sheet-delete")
  )
}

/** Run-able workflow with no manual trigger (run-none e2e). */
export function seedNoTriggerRun(home: string): void {
  const noTrigger = join(home, "workflows", "node-run-none")
  mkdirSync(noTrigger, { recursive: true })
  writeFileSync(
    join(noTrigger, "workflow.yaml"),
    nodeRunYaml("node-run-none", "echo built", false)
  )
}
