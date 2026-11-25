import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const nodeApprovalYaml = (id: string) => `id: ${id}
goal: e2e approval node
nodes:
  - id: start
    kind: trigger
    type: manual
  - id: gate
    kind: approval
    question: Ship the change?
  - id: after
    kind: command
    run: 'echo shipped'
edges:
  - { from: start, to: gate }
  - { from: gate, to: after }
`

const nodeNotifyYaml = (id: string, target = "notify") => `id: ${id}
goal: e2e notify output
nodes:
  - id: start
    kind: trigger
    type: manual
  - id: build
    kind: command
    run: 'echo build is green'
  - id: tell
    kind: output
    target: ${target}${target === "notify" ? "\n    title: Build finished" : ""}
edges:
  - { from: start, to: build }
  - { from: build, to: tell }
`

/** Approval and output notify workflows (BL-080, BL-100). */
export function seedGateWorkflows(home: string): void {
  // Approval workflows for node-approval.spec.ts (BL-080); each test owns one.
  for (const id of [
    "node-approval-light",
    "node-approval-dark",
    "node-approval-reject",
    "node-approval-home",
  ]) {
    const dir = join(home, "workflows", id)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "workflow.yaml"), nodeApprovalYaml(id))
  }
  // Output notify workflows for node-notify.spec.ts (BL-100).
  for (const [id, target] of [
    ["node-notify-light", "notify"],
    ["node-notify-dark", "notify"],
    ["node-notify-sheet", "folder"],
  ] as const) {
    const dir = join(home, "workflows", id)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "workflow.yaml"), nodeNotifyYaml(id, target))
  }
}
