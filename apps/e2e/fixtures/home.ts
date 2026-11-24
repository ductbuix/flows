import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

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

/** Canvas inline editing and drag-to-connect (no edges on purpose). */
const canvasEditYaml = `id: canvas-edit-e2e
goal: e2e canvas edit
nodes:
  - id: start
    kind: trigger
    type: manual
  - id: plan
    kind: llm
    cli: claude
  - id: done
    kind: output
    target: notify
    title: Done
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
    run: 'cat "$RESOURCE_ASSET_DEMO/repo/alpha/data.txt"'
edges:
  - { from: start, to: read }
  - { from: lib, to: read }
`

const nodePublishYaml = (
  id: string,
  access = "propose",
  target = "publish"
) => `id: ${id}
goal: e2e output publish
nodes:
  - id: start
    kind: trigger
    type: manual
  - id: lib
    kind: asset
    access: ${access}
    resources:
      - { connection: pub-demo, entity: item, id: alpha }
  - id: edit
    kind: command
    run: 'echo changed > "$RESOURCE_PUB_DEMO/item/alpha/data.txt"'
  - id: ship
    kind: output
    target: ${target}${target === "publish" ? "\n    connection: pub-demo" : ""}
edges:
  - { from: start, to: edit }
  - { from: lib, to: edit }
  - { from: edit, to: ship }
`

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
  writeFileSync(
    join(diamond, "workflow.yaml"),
    nodeRunYaml("diamond", "echo diamond")
  )
  // Long-lived run so card cancel e2e can hit Cancel while live (BL-200).
  const cardSlow = join(home, "workflows", "card-slow")
  mkdirSync(cardSlow, { recursive: true })
  writeFileSync(
    join(cardSlow, "workflow.yaml"),
    nodeRunYaml("card-slow", "sleep 60")
  )
  writeFileSync(
    join(diamond, "workflow.layout.json"),
    JSON.stringify({
      version: 1,
      nodes: {
        start: { x: 40, y: 80 },
        build: { x: 420, y: 80 },
        done: { x: 800, y: 80 },
      },
      viewport: { x: 0, y: 0, zoom: 0.75 },
    })
  )
  // Isolated copy for WF-12 settings edits (other specs mutate diamond).
  {
    const id = "node-settings-e2e"
    const dir = join(home, "workflows", id)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "workflow.yaml"), nodeRunYaml(id, "echo settings"))
    writeFileSync(
      join(dir, "workflow.layout.json"),
      JSON.stringify({
        version: 1,
        nodes: {
          start: { x: 40, y: 80 },
          build: { x: 420, y: 80 },
          done: { x: 800, y: 80 },
        },
        viewport: { x: 0, y: 0, zoom: 0.75 },
      })
    )
  }
  const edit = join(home, "workflows", "canvas-edit-e2e")
  mkdirSync(join(edit, "nodes", "plan"), { recursive: true })
  writeFileSync(join(edit, "workflow.yaml"), canvasEditYaml)
  writeFileSync(join(edit, "nodes", "plan", "prompt.md"), "Plan it.\n")
  writeFileSync(
    join(edit, "workflow.layout.json"),
    JSON.stringify({
      version: 1,
      nodes: {
        start: { x: 0, y: 0 },
        plan: { x: 380, y: 0 },
        done: { x: 900, y: 0 },
      },
      viewport: { x: 40, y: 120, zoom: 1 },
    })
  )
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
  // Asset workflows for node-asset.spec.ts (BL-082); each test owns one.
  for (const id of ["node-asset-light", "node-asset-dark"]) {
    const dir = join(home, "workflows", id)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "workflow.yaml"), nodeAssetYaml(id))
  }
  // Output publish workflows for node-output-publish.spec.ts (BL-084).
  for (const id of [
    "node-publish-light",
    "node-publish-dark",
    "node-publish-reject",
    "node-publish-ledger",
  ]) {
    const dir = join(home, "workflows", id)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "workflow.yaml"), nodePublishYaml(id))
  }
  const publishSheet = join(home, "workflows", "node-publish-sheet")
  mkdirSync(publishSheet, { recursive: true })
  writeFileSync(
    join(publishSheet, "workflow.yaml"),
    nodePublishYaml("node-publish-sheet", "read", "folder")
  )
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
      // An LLM call that asks for answers gets a fixed JSON block back (BL-085).
      'case "$*" in *--tools*) p=$(cat); case "$p" in *"## Answer"*) printf \'```json\\n{"risk":"high","score":3}\\n```\\n\'; exit 0;; esac; echo "Summary: $(printf %s "$p" | head -1)"; exit 0;; esac',
      "n=$(sed -n 's/^until-pass \\([0-9]*\\)$/\\1/p' input/rule.md 2>/dev/null | head -1)",
      "p=$(printf %s \"$PWD\" | sed -n 's/.*pass-\\([0-9]*\\)\\/attempt.*/\\1/p')",
      'if [ -n "$n" ] && [ -n "$p" ] && [ "$p" -lt "$n" ]; then echo no; else echo yes; fi',
      "",
    ].join("\n"),
    { mode: 0o755 }
  )
  // Fake Cursor ACP agent on PATH (BL-142); used when agents.runtime=acp.
  const agentBin = join(bin, "agent")
  copyFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "fake-acp-agent.mjs"),
    agentBin
  )
  chmodSync(agentBin, 0o755)
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
  // Dedicated fast workflow for RunSheet delete e2e (avoid diamond concurrency).
  {
    const id = "sheet-delete-demo"
    const dir = join(home, "workflows", id)
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, "workflow.yaml"),
      nodeRunYaml(id, "echo sheet-delete")
    )
  }
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
  const noTrigger = join(home, "workflows", "node-run-none")
  mkdirSync(noTrigger, { recursive: true })
  writeFileSync(
    join(noTrigger, "workflow.yaml"),
    nodeRunYaml("node-run-none", "echo built", false)
  )
  // Docket board + sample card for BL-177 e2e.
  const docket = join(home, "docket")
  mkdirSync(join(docket, "cards", "fix-login"), { recursive: true })
  writeFileSync(
    join(docket, "board.yaml"),
    [
      "version: 1",
      "columns:",
      "  - { id: todo, label: Todo, tone: idle }",
      "  - { id: doing, label: Doing, tone: working }",
      "  - { id: review, label: Review, tone: attention }",
      "  - { id: done, label: Done, tone: done, done: true }",
      "face: []",
      "",
    ].join("\n")
  )
  mkdirSync(join(docket, "cards", "fix-login", "assets"), { recursive: true })
  writeFileSync(
    join(docket, "cards", "fix-login", "assets", "acceptance.md"),
    "# Acceptance\n\nLogin stays green for 20 runs.\n"
  )
  writeFileSync(
    join(docket, "cards", "fix-login", "card.md"),
    [
      "---",
      "id: fix-login",
      "title: Fix flaky login",
      "status: doing",
      "rank: m",
      "created: 2026-11-20T09:12:00Z",
      "updated: 2026-11-23T10:00:00Z",
      "due: 2026-11-28",
      "refs:",
      "  - system: rally",
      "    id: US1234",
      "    label: Login flake on CI",
      "    syncedAt: 2026-11-23T10:00:00Z",
      "    data:",
      "      State: In progress",
      "      Iteration: Sprint 42",
      "      Owner: flows",
      "assets:",
      "  - path: assets/acceptance.md",
      "    label: Acceptance criteria",
      "---",
      "",
      "Stabilize the login e2e.",
      "",
    ].join("\n")
  )
  mkdirSync(join(docket, "cards", "refactor-auth"), { recursive: true })
  writeFileSync(
    join(docket, "cards", "refactor-auth", "card.md"),
    [
      "---",
      "id: refactor-auth",
      "title: Refactor auth session",
      "status: todo",
      "rank: m",
      "created: 2026-11-21T09:00:00Z",
      "updated: 2026-11-23T10:00:00Z",
      "---",
      "",
      "Pull session handling into one module.",
      "",
    ].join("\n")
  )
  // Connectors for BL-181 e2e.
  const connectorsDir = join(home, "connectors")
  mkdirSync(connectorsDir, { recursive: true })
  writeFileSync(
    join(connectorsDir, "github-cli.yaml"),
    [
      "id: github-cli",
      "name: GitHub",
      "transport: cli",
      "how: gh",
      "auth: cli-login",
      "providerId: github",
      "capabilities:",
      "  - name: repo clone",
      "    desc: Read repositories",
      "    write: false",
      "    allowed: true",
      "    cmd: [repo, clone]",
      "  - name: repo push",
      "    desc: Push local changes",
      "    write: true",
      "    allowed: true",
      "    cmd: [repo, push]",
      "  - name: pr merge",
      "    desc: Merge a pull request",
      "    write: true",
      "    allowed: false",
      "    cmd: [pr, merge]",
      "",
    ].join("\n")
  )
  writeFileSync(
    join(connectorsDir, "rally.yaml"),
    [
      "id: rally",
      "name: Rally",
      "transport: api",
      "how: https://rally.example/api",
      "auth: cookies",
      "capabilities:",
      "  - name: artifact read",
      "    desc: Read stories and defects",
      "    write: false",
      "    allowed: true",
      "",
    ].join("\n")
  )
  // Stub `gh` for library pull/push (BL-204 / BL-205).
  writeFileSync(
    join(bin, "gh"),
    [
      "#!/bin/sh",
      'if [ "$1" = "--version" ]; then echo "gh stub 0.0.0"; exit 0; fi',
      'if [ "$1" = "repo" ] && [ "$2" = "push" ]; then',
      '  printf \'{"note":"Stub push"}\\n\'',
      "  exit 0",
      "fi",
      'n=$(($(cat "$FLOWAPP_HOME/.gh-pull-n" 2>/dev/null || echo 0) + 1))',
      'echo "$n" > "$FLOWAPP_HOME/.gh-pull-n"',
      'printf \'{"files":{"README.md":"pull-%s"},"note":"Stub fetch %s"}\\n\' "$n" "$n"',
      "exit 0",
      "",
    ].join("\n"),
    { mode: 0o755 }
  )
  // Library items for BL-204 e2e (list, sheet, pin, pull, remove).
  {
    const id = "github-acme-demo"
    const dir = join(home, "library", id)
    mkdirSync(join(dir, "v1"), { recursive: true })
    mkdirSync(join(dir, "v2"), { recursive: true })
    writeFileSync(
      join(dir, "item.yaml"),
      [
        `id: ${id}`,
        "kind: repo",
        "title: acme/demo",
        "source: github",
        "remoteId: acme/demo",
        "remoteUrl: https://github.com/acme/demo",
        "tags:",
        "  - repo:acme/demo",
        "  - project:e2e",
        "current: 2",
        "",
      ].join("\n")
    )
    writeFileSync(
      join(dir, "v1", ".version.yaml"),
      [
        "n: 1",
        "at: 2026-11-20T10:00:00.000Z",
        "note: First fetch",
        "contentHash: hash-v1",
        "",
      ].join("\n")
    )
    writeFileSync(join(dir, "v1", "README.md"), "version one\n")
    writeFileSync(
      join(dir, "v2", ".version.yaml"),
      [
        "n: 2",
        "at: 2026-11-22T12:00:00.000Z",
        "note: Second fetch",
        "contentHash: hash-v2",
        "",
      ].join("\n")
    )
    writeFileSync(join(dir, "v2", "README.md"), "version two\n")
  }
  {
    const id = "local-notes"
    const dir = join(home, "library", id)
    mkdirSync(join(dir, "v1"), { recursive: true })
    writeFileSync(
      join(dir, "item.yaml"),
      [
        `id: ${id}`,
        "kind: other",
        "title: Scratch notes",
        "source: local",
        "tags:",
        "  - type:notes",
        "current: 1",
        "",
      ].join("\n")
    )
    writeFileSync(
      join(dir, "v1", ".version.yaml"),
      [
        "n: 1",
        "at: 2026-11-18T09:00:00.000Z",
        "note: Imported",
        "contentHash: hash-notes",
        "",
      ].join("\n")
    )
    writeFileSync(join(dir, "v1", "notes.md"), "# Notes\n")
  }
  // Workspace skills for BL-183 / BL-206 e2e (installed at v1; source current is v2).
  for (const dir of [".agents", ".claude"] as const) {
    const skillDir = join(home, dir, "skills", "write-tests")
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(
      join(skillDir, "SKILL.md"),
      [
        "---",
        "name: write-tests",
        "description: Write focused unit tests for a changed file.",
        "from:",
        "  sourceId: repo-team-skills",
        "  version: 1",
        "---",
        "",
        "# write-tests",
        "",
        "- Read the diff first",
        "- One behaviour per test",
        "",
      ].join("\n")
    )
  }
  const commitStyle = join(home, ".cursor", "skills", "commit-style")
  mkdirSync(commitStyle, { recursive: true })
  writeFileSync(
    join(commitStyle, "SKILL.md"),
    [
      "---",
      "name: commit-style",
      "description: Write commit messages in this repo's style.",
      "---",
      "",
      "# commit-style",
      "",
      "- Imperative mood",
      "",
    ].join("\n")
  )
  // Skill source Library item (BL-206): v1/v2 with skills under skills/.
  {
    const id = "repo-team-skills"
    const dir = join(home, "library", id)
    mkdirSync(join(dir, "v1", "skills", "write-tests"), { recursive: true })
    mkdirSync(join(dir, "v1", "skills", "review-pr"), { recursive: true })
    mkdirSync(join(dir, "v2", "skills", "write-tests"), { recursive: true })
    mkdirSync(join(dir, "v2", "skills", "review-pr"), { recursive: true })
    writeFileSync(
      join(dir, "item.yaml"),
      [
        `id: ${id}`,
        "kind: repo",
        "title: team/skills",
        "source: github",
        "remoteId: team/skills",
        "remoteUrl: https://github.com/team/skills",
        "tags:",
        "  - repo:team/skills",
        "current: 2",
        "",
      ].join("\n")
    )
    const skillMd = (
      slug: string,
      desc: string,
      rules: string[],
      tag: string
    ) =>
      [
        "---",
        `name: ${slug}`,
        `description: ${desc}`,
        "---",
        "",
        `# ${slug}`,
        "",
        ...rules.map((r) => `- ${r}`),
        "",
        `<!-- ${tag} -->`,
        "",
      ].join("\n")
    writeFileSync(
      join(dir, "v1", ".version.yaml"),
      [
        "n: 1",
        "at: 2026-11-20T10:00:00.000Z",
        "note: First fetch",
        "contentHash: skills-v1",
        "",
      ].join("\n")
    )
    writeFileSync(
      join(dir, "v1", "skills", "write-tests", "SKILL.md"),
      skillMd(
        "write-tests",
        "Write focused unit tests for a changed file.",
        ["Read the diff first", "One behaviour per test"],
        "v1"
      )
    )
    writeFileSync(
      join(dir, "v1", "skills", "review-pr", "SKILL.md"),
      skillMd(
        "review-pr",
        "Review a pull request for correctness and risk.",
        ["Start with the riskiest file"],
        "v1"
      )
    )
    writeFileSync(
      join(dir, "v2", ".version.yaml"),
      [
        "n: 2",
        "at: 2026-11-22T12:00:00.000Z",
        "note: Second fetch",
        "contentHash: skills-v2",
        "",
      ].join("\n")
    )
    writeFileSync(
      join(dir, "v2", "skills", "write-tests", "SKILL.md"),
      skillMd(
        "write-tests",
        "Write focused unit tests for a changed file.",
        ["Read the diff first", "One behaviour per test", "Cover the edge"],
        "v2"
      )
    )
    writeFileSync(
      join(dir, "v2", "skills", "review-pr", "SKILL.md"),
      skillMd(
        "review-pr",
        "Review a pull request for correctness and risk.",
        ["Start with the riskiest file", "Separate must-fix from nits"],
        "v2"
      )
    )
  }
  mkdirSync(join(home, "skills"), { recursive: true })
  writeFileSync(
    join(home, "skills", "sources.json"),
    `${JSON.stringify({ sources: ["repo-team-skills"] }, null, 2)}\n`
  )
  // Workflow that references write-tests (SK-07 used-by).
  {
    const id = "skill-uses-write-tests"
    const dir = join(home, "workflows", id)
    mkdirSync(join(dir, "nodes", "draft"), { recursive: true })
    writeFileSync(
      join(dir, "workflow.yaml"),
      [
        `id: ${id}`,
        "goal: e2e skill used-by",
        "nodes:",
        "  - id: start",
        "    kind: trigger",
        "    type: manual",
        "  - id: draft",
        "    kind: llm",
        "    cli: claude",
        "    name: Draft with tests skill",
        "    skills:",
        "      - write-tests",
        "  - id: done",
        "    kind: output",
        "    target: folder",
        "edges:",
        "  - { from: start, to: draft }",
        "  - { from: draft, to: done }",
        "",
      ].join("\n")
    )
    writeFileSync(join(dir, "nodes", "draft", "prompt.md"), "Draft it.\n")
  }
  return home
}
