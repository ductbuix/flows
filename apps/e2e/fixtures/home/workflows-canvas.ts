import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { nodeRunYaml } from "./template-run"

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

/** Core canvas, cards, sheet, and canvas-edit workflows seeded into FLOWAPP_HOME. */
export function seedCanvasWorkflows(home: string): void {
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
}
