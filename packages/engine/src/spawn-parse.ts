import { existsSync, readFileSync } from "node:fs"
import { basename, join, relative } from "node:path"
import { parse as parseYaml } from "yaml"
import {
  countAgentJudges,
  GENERATED_TASK_ID_RE,
  isAgentTask,
  isSafeTaskId,
  needTaskId,
  spawnIdRejectedMessage,
  spawnInstructionsRejectedMessage,
  taskSchema,
  type Condition,
  type Task,
  type Workflow,
} from "@workspace/shared"

export type SpawnCandidate = {
  file: string
  stem: string
  task: Task
  promptDir: string
}

/** Parse one out/spawn/<stem>.yaml into a candidate or rejection reason. */
export function parseSpawnFile(
  spawnDir: string,
  file: string,
  parentId: string,
  childDepth: number,
  runRoot: string,
  attemptRoot: string,
  graph: Workflow,
  batchStems: Set<string>
): SpawnCandidate | { reason: string } {
  const stem = basename(file).replace(/\.(yaml|yml)$/i, "")
  if (!isSafeTaskId(stem)) {
    return { reason: `stem ${stem} must be a single path segment` }
  }
  if (GENERATED_TASK_ID_RE.test(stem)) {
    return {
      reason: `stem ${stem} must not match the generated task id pattern`,
    }
  }
  if (graph.tasks.some((t) => t.id === stem)) {
    return { reason: `stem ${stem} collides with an existing task id` }
  }
  if (batchStems.has(stem)) {
    return { reason: `duplicate stem ${stem} in this batch` }
  }

  let raw: unknown
  try {
    raw = parseYaml(readFileSync(join(spawnDir, file), "utf8"))
  } catch (err) {
    return {
      reason: `invalid yaml: ${err instanceof Error ? err.message : err}`,
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { reason: "schema: expected a task object" }
  }
  const rec = raw as Record<string, unknown>
  if ("id" in rec) {
    return { reason: spawnIdRejectedMessage(stem) }
  }
  if ("instructions" in rec || hasJudgeInstructions(rec)) {
    return { reason: spawnInstructionsRejectedMessage(stem, rec.kind) }
  }

  const result = taskSchema.safeParse({ ...rec, id: stem })
  if (!result.success) {
    return {
      reason: `schema: ${result.error.issues[0]?.message ?? "invalid"}`,
    }
  }

  const promptDir = relative(
    runRoot,
    join(attemptRoot, "out", "spawn", stem)
  ).replaceAll("\\", "/")

  const missing = missingPromptFiles(result.data, join(spawnDir, stem))
  if (missing) return { reason: missing }

  return {
    file,
    stem,
    promptDir,
    task: {
      ...result.data,
      // Temporary id = stem; acceptBatch replaces with a generated id.
      id: stem,
      spawnDepth: childDepth,
      spawnedBy: parentId,
    },
  }
}

function hasJudgeInstructions(rec: Record<string, unknown>): boolean {
  if (conditionHasInstructions(rec.when)) return true
  const repeat = rec.repeat
  if (
    repeat &&
    typeof repeat === "object" &&
    !Array.isArray(repeat) &&
    conditionHasInstructions((repeat as { until?: unknown }).until)
  ) {
    return true
  }
  const needs = rec.needs
  if (!Array.isArray(needs)) return false
  return needs.some(
    (need) =>
      need &&
      typeof need === "object" &&
      !Array.isArray(need) &&
      conditionHasInstructions((need as { when?: unknown }).when)
  )
}

function conditionHasInstructions(condition: unknown): boolean {
  if (!condition || typeof condition !== "object" || Array.isArray(condition)) {
    return false
  }
  const rec = condition as Record<string, unknown>
  if (
    "agent" in rec &&
    rec.agent &&
    typeof rec.agent === "object" &&
    !Array.isArray(rec.agent) &&
    "instructions" in (rec.agent as object)
  ) {
    return true
  }
  if ("all" in rec && Array.isArray(rec.all)) {
    return rec.all.some(conditionHasInstructions)
  }
  if ("any" in rec && Array.isArray(rec.any)) {
    return rec.any.some(conditionHasInstructions)
  }
  return false
}

function missingPromptFiles(task: Task, stemDir: string): string | undefined {
  if (isAgentTask(task) && !existsSync(join(stemDir, "prompt.md"))) {
    return `missing prompt.md under out/spawn/${task.id}/`
  }
  if (task.when && typeof task.when !== "boolean") {
    const miss = missingJudgeFile(task.when, stemDir, "when.md")
    if (miss) return miss
  }
  if (task.repeat?.until) {
    const miss = missingJudgeFile(task.repeat.until, stemDir, "until.md")
    if (miss) return miss
  }
  for (const need of task.needs) {
    if (typeof need === "string" || !need.when) continue
    const file = `need-${needTaskId(need)}.md`
    const miss = missingJudgeFile(need.when, stemDir, file)
    if (miss) return miss
  }
  return undefined
}

function missingJudgeFile(
  condition: Condition,
  stemDir: string,
  file: string
): string | undefined {
  if (countAgentJudges(condition) === 0) return undefined
  if (!existsSync(join(stemDir, file))) {
    return `missing ${file} under out/spawn/`
  }
  return undefined
}
