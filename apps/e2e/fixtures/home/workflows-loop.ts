import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

/** Judge loop: draft, check, and No goes back to draft (BL-081). */
const nodeLoopYaml = (id: string, limits = "") => `id: ${id}
goal: e2e loop
${limits}nodes:
  - id: start
    kind: trigger
    type: manual
  - id: draft
    kind: command
    run: 'echo drafted'
  - id: check
    kind: judge
    cli: claude
  - id: ship
    kind: command
    run: 'echo shipped'
edges:
  - { from: start, to: draft }
  - { from: draft, to: check }
  - { from: check, to: draft, branch: no }
  - { from: check, to: ship, branch: yes }
`

const nodeLoopWarnYaml = `id: node-loop-warn
goal: e2e loop with no judge
nodes:
  - id: start
    kind: trigger
    type: manual
  - id: one
    kind: command
    run: 'echo one'
  - id: two
    kind: command
    run: 'echo two'
edges:
  - { from: start, to: one }
  - { from: one, to: two }
  - { from: two, to: one }
`

/** Loop workflows for node-loop.spec.ts (BL-081); each test owns one. */
export function seedLoopWorkflows(home: string): void {
  // The rule `until-pass 3` makes the stub Judge say No until the third pass.
  for (const [id, limits, until] of [
    ["node-loop-light", "", 3],
    ["node-loop-dark", "", 3],
    ["node-loop-view-light", "", 3],
    ["node-loop-view-dark", "", 3],
    ["node-loop-limit", "limits: { loopPasses: 2 }\n", 99],
  ] as const) {
    const dir = join(home, "workflows", id)
    mkdirSync(join(dir, "nodes", "check"), { recursive: true })
    writeFileSync(join(dir, "workflow.yaml"), nodeLoopYaml(id, limits))
    writeFileSync(
      join(dir, "nodes", "check", "rule.md"),
      `until-pass ${until}\nIs the draft good?\n`
    )
  }
  const loopWarn = join(home, "workflows", "node-loop-warn")
  mkdirSync(loopWarn, { recursive: true })
  writeFileSync(join(loopWarn, "workflow.yaml"), nodeLoopWarnYaml)
}
