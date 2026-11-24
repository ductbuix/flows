import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"
import { workflowDir, type Engine } from "@workspace/adapters-node"
import {
  setWorkflowField,
  workflowIdSchema,
  type WorkflowSummary,
} from "@workspace/shared"

export type LifecycleResult =
  | { ok: true }
  | {
      ok: false
      kind: "not_found" | "conflict" | "exists" | "live" | "invalid"
    }

function starterYaml(id: string, goal: string, name?: string): string {
  const label = name ? `name: ${JSON.stringify(name)}\n` : ""
  return `id: ${id}
${label}goal: ${goal}
nodes:
  - id: start
    kind: trigger
    type: manual
edges: []
`
}

export function createWorkflow(
  engine: Engine,
  id: string,
  goal: string,
  name?: string
): LifecycleResult & { summary?: WorkflowSummary } {
  const parsed = workflowIdSchema.safeParse(id)
  if (!parsed.success) return { ok: false, kind: "invalid" }
  const dir = workflowDir(engine.home, id)
  if (existsSync(dir)) return { ok: false, kind: "exists" }

  mkdirSync(join(dir, "memory"), { recursive: true })
  mkdirSync(join(dir, "input"), { recursive: true })
  mkdirSync(join(dir, "output"), { recursive: true })
  writeFileSync(join(dir, "workflow.yaml"), starterYaml(id, goal, name), "utf8")
  return {
    ok: true,
    summary: { id, ...(name ? { name } : {}), goal, taskCount: 1 },
  }
}

export function renameWorkflow(
  engine: Engine,
  workflowId: string,
  newId: string
): LifecycleResult & { id?: string } {
  const parsed = workflowIdSchema.safeParse(newId)
  if (!parsed.success) return { ok: false, kind: "invalid" }
  if (newId === workflowId) return { ok: true, id: newId }

  const fromDir = workflowDir(engine.home, workflowId)
  const toDir = workflowDir(engine.home, newId)
  if (!existsSync(join(fromDir, "workflow.yaml"))) {
    return { ok: false, kind: "not_found" }
  }
  if (existsSync(toDir)) return { ok: false, kind: "exists" }
  if (engine.hasLiveRun(workflowId)) return { ok: false, kind: "live" }

  const yamlPath = join(fromDir, "workflow.yaml")
  const yaml = readFileSync(yamlPath, "utf8")
  const next = setWorkflowField(yaml, "id", newId)
  writeFileSync(yamlPath, next, "utf8")
  renameSync(fromDir, toDir)
  engine.rebindWorkflowId(workflowId, newId)
  return { ok: true, id: newId }
}

export function deleteWorkflow(
  engine: Engine,
  workflowId: string
): LifecycleResult {
  const dir = workflowDir(engine.home, workflowId)
  if (!existsSync(join(dir, "workflow.yaml"))) {
    return { ok: false, kind: "not_found" }
  }
  if (engine.hasLiveRun(workflowId)) return { ok: false, kind: "live" }

  engine.markWorkflowRunsDeleted(workflowId)
  rmSync(dir, { recursive: true, force: true })
  return { ok: true }
}
