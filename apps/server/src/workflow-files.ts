import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"
import { workflowDir, type Engine } from "@workspace/engine"
import {
  parseWorkflowYaml,
  stripSpawnMeta,
  upsertTask,
  workflowDetailSchema,
  type Task,
  type WorkflowDetail,
} from "@workspace/shared"
import { hashContent } from "./hash.ts"

export function workflowYamlPath(engine: Engine, workflowId: string): string {
  return join(workflowDir(engine.home, workflowId), "workflow.yaml")
}

export function readWorkflowDetail(
  engine: Engine,
  workflowId: string
): WorkflowDetail | null {
  const path = workflowYamlPath(engine, workflowId)
  if (!existsSync(path)) return null
  const yaml = readFileSync(path, "utf8")
  const parsed = parseWorkflowYaml(yaml)
  return workflowDetailSchema.parse({
    id: workflowId,
    yaml,
    hash: hashContent(yaml),
    workflow: parsed.workflow,
    errors: parsed.errors,
  })
}

export function writeWorkflowYaml(
  engine: Engine,
  workflowId: string,
  yaml: string,
  baseHash: string
):
  | { ok: true; detail: WorkflowDetail }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "conflict"; diskYaml: string; diskHash: string }
  | { ok: false; kind: "invalid"; detail: WorkflowDetail } {
  const path = workflowYamlPath(engine, workflowId)
  if (!existsSync(path)) return { ok: false, kind: "not_found" }

  const diskYaml = readFileSync(path, "utf8")
  const diskHash = hashContent(diskYaml)
  if (diskHash !== baseHash) {
    return { ok: false, kind: "conflict", diskYaml, diskHash }
  }

  const parsed = parseWorkflowYaml(yaml)
  const detail = workflowDetailSchema.parse({
    id: workflowId,
    yaml,
    hash: hashContent(yaml),
    workflow: parsed.workflow,
    errors: parsed.errors,
  })
  if (!parsed.workflow || parsed.errors.length > 0) {
    return { ok: false, kind: "invalid", detail }
  }

  writeFileSync(path, yaml, "utf8")
  const written = readWorkflowDetail(engine, workflowId)!
  return { ok: true, detail: written }
}

export function promoteSpawnedTask(
  engine: Engine,
  runId: string,
  taskId: string
):
  | { ok: true; detail: WorkflowDetail }
  | { ok: false; kind: "not_found" | "not_spawned" | "invalid" } {
  const state = engine.fold(runId)
  if (!state || state.deleted) return { ok: false, kind: "not_found" }
  const spec = state.graph.tasks.find((t) => t.id === taskId)
  if (!spec) return { ok: false, kind: "not_found" }
  if (!spec.spawnedBy) {
    return { ok: false, kind: "not_spawned" }
  }

  const workflowId = state.workflowId
  const path = workflowYamlPath(engine, workflowId)
  if (!existsSync(path)) return { ok: false, kind: "not_found" }

  if (spec.promptDir) {
    const runRoot = join(workflowDir(engine.home, workflowId), "runs", runId)
    const from = join(runRoot, spec.promptDir)
    const to = join(workflowDir(engine.home, workflowId), "tasks", taskId)
    if (existsSync(from)) {
      mkdirSync(join(workflowDir(engine.home, workflowId), "tasks"), {
        recursive: true,
      })
      rmSync(to, { recursive: true, force: true })
      cpSync(from, to, { recursive: true })
    }
  }

  const yaml = readFileSync(path, "utf8")
  const cleaned = stripSpawnMeta(spec as Task)
  const next = upsertTask(yaml, cleaned)
  const parsed = parseWorkflowYaml(next)
  if (!parsed.workflow || parsed.errors.length > 0) {
    return { ok: false, kind: "invalid" }
  }
  writeFileSync(path, next, "utf8")
  return { ok: true, detail: readWorkflowDetail(engine, workflowId)! }
}
