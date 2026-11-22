import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const diamondYaml = `id: diamond
goal: e2e diamond fixture
tasks:
  - id: a
    kind: command
    run: >-
      printf 'HELLO_STDOUT\\n' &&
      printf '# Report\\n\\n| col |\\n| --- |\\n| x |\\n' > "$(dirname "$TASK_OUT")/SUMMARY.md" &&
      printf a > "$TASK_OUT/letter.txt"
  - id: b
    kind: command
    run: "printf b > \\"$TASK_OUT/letter.txt\\""
    needs: [a]
  - id: c
    kind: command
    run: "printf c > \\"$TASK_OUT/letter.txt\\""
    needs: [a]
  - id: d
    kind: command
    run: "printf done > \\"$TASK_OUT/out.txt\\""
    needs: [b, c]
`

const failRetryYaml = `id: fail-retry
goal: e2e retry badge
tasks:
  - id: flaky
    kind: command
    run: "exit 1"
    retry: { max: 2 }
`

const slowCancelYaml = `id: slow-cancel
goal: e2e cancel while running
tasks:
  - id: slow
    kind: command
    run: "sleep 60"
`

const timeoutShortYaml = `id: timeout-short
goal: e2e attempt timeout reason
tasks:
  - id: slow
    kind: command
    timeout: 1
    run: "sleep 30"
`

const failManualYaml = `id: fail-manual
goal: e2e manual retry
tasks:
  - id: boom
    kind: command
    run: "exit 1"
`

const gateYaml = `id: gate
goal: e2e approval gate
tasks:
  - id: hold
    kind: command
    run: "printf ok > \\"$TASK_OUT/out.txt\\""
    approval: true
  - id: after
    kind: command
    run: "printf next > \\"$TASK_OUT/out.txt\\""
    needs: [hold]
`

const gateRejectYaml = `id: gate-reject
goal: e2e reject gate
tasks:
  - id: hold
    kind: command
    run: "printf ok > \\"$TASK_OUT/out.txt\\""
    approval: true
`

const agentTrustYaml = `id: agent-trust
goal: e2e trust dialog
tasks:
  - id: hello
    kind: agent
    cli: cursor
    timeout: 5
`

const judgeModelYaml = `id: judge-model
goal: e2e lone agent judge model
tasks:
  - id: gated
    kind: command
    run: "printf ok > \\"$TASK_OUT/out.txt\\""
    when:
      agent:
        cli: claude
`

const agentModelYaml = `id: agent-model
goal: e2e attempt model row
tasks:
  - id: hello
    kind: agent
    cli: claude
    model: haiku
    effort: low
    timeout: 3
`

const runInputsYaml = `id: run-inputs
goal: e2e start form and inputs editor
limits:
  maxConcurrentRuns: 1
inputs:
  - name: ticket
    type: text
    required: true
    description: Ticket key
  - name: brief
    type: markdown
    required: false
tasks:
  - id: echo
    kind: command
    run: "printf done > \\"$TASK_OUT/out.txt\\""
`

const runInputsSlowYaml = `id: run-inputs-slow
goal: e2e queued run cancel
limits:
  maxConcurrentRuns: 1
inputs:
  - name: ticket
    type: text
    required: true
tasks:
  - id: slow
    kind: command
    run: "sleep 60"
`

/** Create a temp FLOWAPP_HOME with e2e workflow fixtures. */
export function createE2eHome(): string {
  const home = mkdtempSync(join(tmpdir(), "flowapp-e2e-"))
  for (const [id, yaml] of [
    ["diamond", diamondYaml],
    ["fail-retry", failRetryYaml],
    ["slow-cancel", slowCancelYaml],
    ["timeout-short", timeoutShortYaml],
    ["fail-manual", failManualYaml],
    ["gate", gateYaml],
    ["gate-reject", gateRejectYaml],
    ["agent-trust", agentTrustYaml],
    ["judge-model", judgeModelYaml],
    ["agent-model", agentModelYaml],
    ["run-inputs", runInputsYaml],
    ["run-inputs-slow", runInputsSlowYaml],
  ] as const) {
    const dir = join(home, "workflows", id)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "workflow.yaml"), yaml)
  }
  const agentTasks = join(home, "workflows", "agent-trust", "tasks", "hello")
  mkdirSync(agentTasks, { recursive: true })
  writeFileSync(
    join(agentTasks, "prompt.md"),
    "Write ok to out/done.txt and exit.\n"
  )
  const judgeWhen = join(home, "workflows", "judge-model", "tasks", "gated")
  mkdirSync(judgeWhen, { recursive: true })
  writeFileSync(join(judgeWhen, "when.md"), "Exit 0 if the output is ok.\n")
  const agentModelTasks = join(
    home,
    "workflows",
    "agent-model",
    "tasks",
    "hello"
  )
  mkdirSync(agentModelTasks, { recursive: true })
  writeFileSync(
    join(agentModelTasks, "prompt.md"),
    "Write ok to out/done.txt and exit.\n"
  )
  return home
}

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

/** Temp FLOWAPP_HOME for the FLOWS_NODES=1 server (node workflow fixtures). */
export function createNodesE2eHome(): string {
  const home = mkdtempSync(join(tmpdir(), "flowapp-e2e-nodes-"))
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
  const noTrigger = join(home, "workflows", "node-run-none")
  mkdirSync(noTrigger, { recursive: true })
  writeFileSync(
    join(noTrigger, "workflow.yaml"),
    nodeRunYaml("node-run-none", "echo built", false)
  )
  return home
}
