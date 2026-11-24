import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { Workflow } from "@workspace/contracts"
import {
  frozenDir,
  materializeRunInput,
  runDir,
  workflowDir,
  type ManualItem,
} from "@workspace/adapters-node"

export type PrepareCoreRunInput = {
  home: string
  graph: Workflow
  runId: string
  inputText?: string
  inputs?: ManualItem
  cardId?: string
}

/** Freeze graph, inputs and node files under the run dir (tick parity). */
export function prepareCoreRunDir(input: PrepareCoreRunInput): string {
  const wfRoot = workflowDir(input.home, input.graph.id)
  const runRoot = runDir(wfRoot, input.runId)
  mkdirSync(runRoot, { recursive: true })
  writeFileSync(
    join(runRoot, "graph.json"),
    JSON.stringify(input.graph, null, 2)
  )

  if (input.inputs) {
    materializeRunInput(wfRoot, runRoot, input.inputs, input.cardId)
  } else {
    const inputDir = join(runRoot, "input")
    mkdirSync(inputDir, { recursive: true })
    const inputSource = join(wfRoot, "input")
    if (existsSync(inputSource)) {
      cpSync(inputSource, inputDir, { recursive: true })
    }
  }
  if (input.inputText !== undefined) {
    mkdirSync(join(runRoot, "input"), { recursive: true })
    writeFileSync(join(runRoot, "input", "text.md"), input.inputText)
  }

  for (const node of input.graph.nodes) {
    const src = join(wfRoot, "nodes", node.id)
    if (existsSync(src)) {
      cpSync(src, frozenDir(runRoot, node.id), { recursive: true })
    }
  }

  const layout = join(wfRoot, "workflow.layout.json")
  if (existsSync(layout)) cpSync(layout, join(runRoot, "layout.json"))

  return runRoot
}
