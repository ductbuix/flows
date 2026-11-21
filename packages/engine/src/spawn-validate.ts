import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"
import {
  newTaskId,
  taskSpawnDepth,
  type AgentTask,
  type Need,
  type Task,
  type Workflow,
} from "@workspace/shared"
import { effectiveLimit } from "./config.ts"
import { parseSpawnFile, type SpawnCandidate } from "./spawn-parse.ts"
import { assertValidGraph } from "./workflow.ts"

export type SpawnRejection = { file: string; reason: string }

/** Read, validate and accept or reject out/spawn/*.yaml (DES-005 / DES-020). */
export function processSpawnDir(
  parent: AgentTask,
  attemptRoot: string,
  runRoot: string,
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

  const parsed: SpawnCandidate[] = []
  const stems = new Set<string>()
  for (const file of files) {
    const candidate = parseSpawnFile(
      spawnDir,
      file,
      parent.id,
      childDepth,
      runRoot,
      attemptRoot,
      graph,
      stems
    )
    if ("reason" in candidate) {
      rejections.push({ file, reason: candidate.reason })
    } else {
      stems.add(candidate.stem)
      parsed.push(candidate)
    }
  }

  return acceptBatch(parsed, graph, maxTasks, rejections)
}

function acceptBatch(
  parsed: SpawnCandidate[],
  graph: Workflow,
  maxTasks: number | undefined,
  rejections: SpawnRejection[]
): { accepted: Task[]; rejections: SpawnRejection[] } {
  if (parsed.length === 0) return { accepted: [], rejections }

  const existingIds = new Set(graph.tasks.map((t) => t.id))
  const stemToId = new Map<string, string>()
  const assigned: SpawnCandidate[] = []

  for (const c of parsed) {
    const id = newTaskId([...existingIds, ...stemToId.values()])
    existingIds.add(id)
    stemToId.set(c.stem, id)
    assigned.push(c)
  }

  if (
    maxTasks !== undefined &&
    graph.tasks.length + assigned.length > maxTasks
  ) {
    for (const c of assigned) {
      rejections.push({
        file: c.file,
        reason: `maxTasks ${maxTasks} would be exceeded`,
      })
    }
    return { accepted: [], rejections }
  }

  const acceptedTasks: Task[] = assigned.map((c) => {
    const id = stemToId.get(c.stem)!
    return {
      ...c.task,
      id,
      needs: rewriteNeeds(c.task.needs, stemToId),
      spawnDepth: c.task.spawnDepth,
      spawnedBy: c.task.spawnedBy,
      promptDir: c.promptDir,
    }
  })

  try {
    assertValidGraph({ ...graph, tasks: [...graph.tasks, ...acceptedTasks] })
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    for (const c of assigned) {
      rejections.push({ file: c.file, reason })
    }
    return { accepted: [], rejections }
  }

  return { accepted: acceptedTasks, rejections }
}

function rewriteNeeds(needs: Need[], stemToId: Map<string, string>): Need[] {
  return needs.map((need) => {
    if (typeof need === "string") {
      return stemToId.get(need) ?? need
    }
    const mapped = stemToId.get(need.task)
    if (!mapped) return need
    return { ...need, task: mapped }
  })
}
