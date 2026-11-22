import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const nodeCanvasYaml = `id: node-canvas
goal: e2e node canvas
nodes:
  - id: start
    kind: trigger
    type: manual
  - id: write
    kind: agent
    cli: claude
  - id: done
    kind: output
    target: folder
edges:
  - { from: start, to: write }
  - { from: write, to: done }
`

const nodeCardsYaml = `id: node-cards
goal: e2e node cards
nodes:
  - id: start
    kind: trigger
    type: manual
  - id: rules
    kind: prompt
  - id: plan
    kind: agent
    cli: claude
  - id: build
    kind: command
    run: echo build
  - id: done
    kind: output
    target: folder
edges:
  - { from: start, to: plan }
  - { from: rules, to: plan }
  - { from: plan, to: build }
  - { from: build, to: done }
`

const nodeSheetYaml = (id: string) => `id: ${id}
goal: e2e node sheet
nodes:
  - id: start
    kind: trigger
    type: manual
  - id: plan
    kind: agent
    cli: claude
  - id: build
    kind: command
    run: echo build
  - id: done
    kind: output
    target: folder
edges:
  - { from: start, to: plan }
  - { from: plan, to: build }
  - { from: build, to: done }
`

const nodeRunYaml = (id: string, run: string, trigger = true) => `id: ${id}
goal: e2e node run
nodes:
${trigger ? "  - id: start\n    kind: trigger\n    type: manual\n" : ""}  - id: build
    kind: command
    run: ${JSON.stringify(run)}
  - id: done
    kind: output
    target: folder
edges:
${trigger ? "  - { from: start, to: build }\n" : ""}  - { from: build, to: done }
`

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

const nodeAssetYaml = (id: string) => `id: ${id}
goal: e2e asset node
nodes:
  - id: start
    kind: trigger
    type: manual
  - id: lib
    kind: asset
    resources: []
    access: read
  - id: read
    kind: command
    run: 'cat "$RESOURCE_ASSET_DEMO/item/alpha/data.txt"'
edges:
  - { from: start, to: read }
  - { from: lib, to: read }
`

const nodeLlmYaml = (id: string) => `id: ${id}
goal: e2e llm node
nodes:
  - id: start
    kind: trigger
    type: manual
  - id: write
    kind: llm
    cli: claude
  - id: show
    kind: command
    run: 'cat $NODE_IN/text.md'
edges:
  - { from: start, to: write }
  - { from: write, to: show }
`

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

/** Temp FLOWAPP_HOME with the node workflow fixtures (DES-037, BL-096). */
export function createE2eHome(): string {
  const home = mkdtempSync(join(tmpdir(), "flowapp-e2e-nodes-"))
  const diamond = join(home, "workflows", "diamond")
  mkdirSync(diamond, { recursive: true })
  writeFileSync(join(diamond, "workflow.yaml"), nodeRunYaml("diamond", "echo diamond"))
  const dir = join(home, "workflows", "node-canvas")
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, "workflow.yaml"), nodeCanvasYaml)
  const cards = join(home, "workflows", "node-cards")
  mkdirSync(join(cards, "nodes", "rules"), { recursive: true })
  mkdirSync(join(cards, "nodes", "plan"), { recursive: true })
  writeFileSync(join(cards, "workflow.yaml"), nodeCardsYaml)
  writeFileSync(join(cards, "nodes", "rules", "text.md"), "Be brief.\n")
  writeFileSync(join(cards, "nodes", "plan", "prompt.md"), "Plan the work.\n")
  // Empty node workflows for node-add.spec.ts (BL-094); each test owns one.
  for (const id of ["node-empty-light", "node-empty-dark", "node-sample"]) {
    const empty = join(home, "workflows", id)
    mkdirSync(empty, { recursive: true })
    writeFileSync(
      join(empty, "workflow.yaml"),
      `id: ${id}\ngoal: e2e empty node workflow\nnodes: []\nedges: []\n`
    )
  }
  // Node Sheet workflows for node-sheet.spec.ts (BL-095); each test owns one.
  for (const id of ["node-sheet-light", "node-sheet-dark"]) {
    const dir = join(home, "workflows", id)
    mkdirSync(join(dir, "nodes", "plan"), { recursive: true })
    mkdirSync(join(dir, "memory"), { recursive: true })
    writeFileSync(join(dir, "workflow.yaml"), nodeSheetYaml(id))
    writeFileSync(join(dir, "nodes", "plan", "prompt.md"), "Plan it.\n")
    writeFileSync(join(dir, "memory", "style.md"), "Be brief.\n")
  }
  // Node run workflows for node-run.spec.ts (BL-086); each test owns one.
  for (const theme of ["light", "dark"]) {
    for (const [id, run] of [
      [`node-run-ok-${theme}`, "echo built"],
      [`node-run-fail-${theme}`, "echo broken >&2; exit 1"],
    ] as const) {
      const dir = join(home, "workflows", id)
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, "workflow.yaml"), nodeRunYaml(id, run))
    }
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
  // Judge workflows for node-judge.spec.ts (BL-079); each test owns one.
  for (const id of ["node-judge-light", "node-judge-dark", "node-judge-light-view", "node-judge-dark-view"]) {
    const dir = join(home, "workflows", id)
    mkdirSync(join(dir, "nodes", "check"), { recursive: true })
    writeFileSync(join(dir, "workflow.yaml"), nodeJudgeYaml(id))
    writeFileSync(join(dir, "nodes", "check", "rule.md"), "Is the request reasonable?\n")
  }
  const judgeAdd = join(home, "workflows", "node-judge-add")
  mkdirSync(judgeAdd, { recursive: true })
  writeFileSync(
    join(judgeAdd, "workflow.yaml"),
    "id: node-judge-add\ngoal: e2e add a judge\nnodes: []\nedges: []\n"
  )
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
  // Asset workflows for node-asset.spec.ts (BL-082); each test owns one.
  for (const id of ["node-asset-light", "node-asset-dark"]) {
    const dir = join(home, "workflows", id)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "workflow.yaml"), nodeAssetYaml(id))
  }
  // Loop workflows for node-loop.spec.ts (BL-081); each test owns one. The
  // rule `until-pass 3` makes the stub Judge say No until the third pass.
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
  // A `claude` on PATH that answers yes, so Judge runs need no real CLI. A
  // rule that starts `until-pass N` answers No while the step is before pass N.
  const bin = join(home, "bin")
  mkdirSync(bin, { recursive: true })
  writeFileSync(
    join(bin, "claude"),
    [
      "#!/bin/sh",
      // An LLM call (tools off) prints a line made from the first prompt line.
      'case "$*" in *--tools*) p=$(cat); echo "Summary: $(printf %s "$p" | head -1)"; exit 0;; esac',
      "n=$(sed -n 's/^until-pass \\([0-9]*\\)$/\\1/p' input/rule.md 2>/dev/null | head -1)",
      'p=$(printf %s "$PWD" | sed -n \'s/.*pass-\\([0-9]*\\)\\/attempt.*/\\1/p\')',
      'if [ -n "$n" ] && [ -n "$p" ] && [ "$p" -lt "$n" ]; then echo no; else echo yes; fi',
      "",
    ].join("\n"),
    { mode: 0o755 }
  )
  // LLM workflows for node-llm.spec.ts (BL-083); each test owns one.
  for (const id of ["node-llm-light", "node-llm-dark", "node-llm-light-view", "node-llm-dark-view"]) {
    const dir = join(home, "workflows", id)
    mkdirSync(join(dir, "nodes", "write"), { recursive: true })
    writeFileSync(join(dir, "workflow.yaml"), nodeLlmYaml(id))
    writeFileSync(join(dir, "nodes", "write", "prompt.md"), "Write one line about the weather.\n")
  }
  const llmAdd = join(home, "workflows", "node-llm-add")
  mkdirSync(llmAdd, { recursive: true })
  writeFileSync(
    join(llmAdd, "workflow.yaml"),
    "id: node-llm-add\ngoal: e2e add an llm\nnodes: []\nedges: []\n"
  )
  const noTrigger = join(home, "workflows", "node-run-none")
  mkdirSync(noTrigger, { recursive: true })
  writeFileSync(
    join(noTrigger, "workflow.yaml"),
    nodeRunYaml("node-run-none", "echo built", false)
  )
  return home
}
