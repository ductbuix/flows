import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { parse as parseYaml } from "yaml"
import {
  taskSchema,
  taskSpawnDepth,
  type AgentTask,
  type Task,
  type Workflow,
} from "@workspace/shared"
import { effectiveLimit } from "./config.ts"
import { assertValidGraph } from "./workflow.ts"

export type SpawnRejection = { file: string; reason: string }

type Candidate = { file: string; task: Task }

/** Read, validate and accept or reject out/spawn/*.yaml (DES-005). */
export function processSpawnDir(
  parent: AgentTask,
  attemptRoot: string,
  graph: Workflow,
  globalLimits: Workflow["limits"] | undefined
): { accepted: Task[]; rejections: SpawnRejection[] } {
  const spawnDir = join(attemptRoot, "out", "spawn")
  if (!existsSync(spawnDir)) return { accepted: [], rejections: [] }

  const files = readdirSync(spawnDir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .sort()

  const rejections: SpawnRejection[] = []
  const childDepth = taskSpawnDepth(parent) + 1
  const maxDepth = effectiveLimit(globalLimits, graph.limits, "maxSpawnDepth")
  const maxTasks = effectiveLimit(globalLimits, graph.limits, "maxTasks")

  if (maxDepth !== undefined && childDepth > maxDepth) {
    return {
      accepted: [],
      rejections: files.map((file) => ({
        file,
        reason: `maxSpawnDepth ${maxDepth} exceeded (would be ${childDepth})`,
      })),
    }
  }

  const parsed: Candidate[] = []
  for (const file of files) {
    const candidate = parseSpawnFile(spawnDir, file, parent.id, childDepth)
    if ("reason" in candidate) {
      rejections.push({ file, reason: candidate.reason })
    } else {
      parsed.push(candidate)
    }
  }

  return acceptBatch(parsed, graph, maxTasks, rejections)
}

function acceptBatch(
  parsed: Candidate[],
  graph: Workflow,
  maxTasks: number | undefined,
  rejections: SpawnRejection[]
): { accepted: Task[]; rejections: SpawnRejection[] } {
  const existingIds = new Set(graph.tasks.map((t) => t.id))
  const batchIds = new Set<string>()
  const unique: Candidate[] = []
  for (const c of parsed) {
    if (existingIds.has(c.task.id) || batchIds.has(c.task.id)) {
      rejections.push({
        file: c.file,
        reason: `duplicate task id ${c.task.id}`,
      })
      continue
    }
    batchIds.add(c.task.id)
    unique.push(c)
  }

  if (unique.length === 0) return { accepted: [], rejections }

  if (
    maxTasks !== undefined &&
    graph.tasks.length + unique.length > maxTasks
  ) {
    for (const c of unique) {
      rejections.push({
        file: c.file,
        reason: `maxTasks ${maxTasks} would be exceeded`,
      })
    }
    return { accepted: [], rejections }
  }

  const acceptedTasks = unique.map((c) => c.task)
  try {
    assertValidGraph({ ...graph, tasks: [...graph.tasks, ...acceptedTasks] })
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    for (const c of unique) {
      rejections.push({ file: c.file, reason })
    }
    return { accepted: [], rejections }
  }

  return { accepted: acceptedTasks, rejections }
}

function parseSpawnFile(
  spawnDir: string,
  file: string,
  parentId: string,
  childDepth: number
): Candidate | { reason: string } {
  let raw: unknown
  try {
    raw = parseYaml(readFileSync(join(spawnDir, file), "utf8"))
  } catch (err) {
    return {
      reason: `invalid yaml: ${err instanceof Error ? err.message : err}`,
    }
  }
  const result = taskSchema.safeParse(raw)
  if (!result.success) {
    return {
      reason: `schema: ${result.error.issues[0]?.message ?? "invalid"}`,
    }
  }
  return {
    file,
    task: {
      ...result.data,
      spawnDepth: childDepth,
      spawnedBy: parentId,
    },
  }
}
