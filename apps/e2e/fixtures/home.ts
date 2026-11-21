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
  return home
}
