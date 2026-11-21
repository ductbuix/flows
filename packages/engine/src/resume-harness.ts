/**
 * Child process entry for resume tests: start a run and wait until it
 * finishes (or until the parent kills this process mid-run).
 *
 * Usage: tsx resume-harness.ts <home> <workflowDir> <runId>
 */
import { createEngine } from "./engine.ts"

const [home, workflowDir, runId] = process.argv.slice(2)
if (!home || !workflowDir || !runId) {
  console.error("usage: resume-harness.ts <home> <workflowDir> <runId>")
  process.exit(2)
}

const engine = createEngine({ home })
const handle = await engine.startRun({ workflowDir, runId })
const state = await handle.wait()
engine.close()
process.exit(state.status === "succeeded" ? 0 : 1)
