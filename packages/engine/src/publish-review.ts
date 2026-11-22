import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"
import {
  isAgentTask,
  isCommandTask,
  type ChangeSet,
  type Workflow,
} from "@workspace/shared"
import { connectionDir } from "./paths.ts"
import { runAgentJudgeDetailed } from "./judge.ts"
import { resolveAttemptTimeout } from "./timeout.ts"
import { publishChangesDir } from "./work-copy.ts"

export type AgentReviewResult = {
  verdict: "approve" | "escalate"
  reason: string
}

const REVIEW_INSTRUCTIONS = `You are reviewing a publish change set.

Read preview.md, changeset.json, and goals.md in this directory.
If connections/review.md exists, treat it as the user's rules.

Exit 0 to approve (publish with no pause).
Exit non-zero to escalate to a person.
Optionally write a one-line reason to review-reason.txt.
`

/** Propose tasks that touch this connection (DES-026 / BL-052). */
export function proposeGoalsMarkdown(
  workflow: Workflow,
  connectionId: string,
  workflowRoot: string
): string {
  const lines: string[] = ["# Propose task goals", ""]
  for (const task of workflow.tasks) {
    const uses = task.uses ?? []
    const proposes = uses.some(
      (u) => u.connection === connectionId && u.access === "propose"
    )
    if (!proposes) continue
    lines.push(`## ${task.id}`)
    if (task.name) lines.push(`name: ${task.name}`)
    lines.push(`kind: ${task.kind}`)
    if (isCommandTask(task)) {
      lines.push("run:", "```", task.run, "```")
    } else if (isAgentTask(task)) {
      const promptPath = join(
        workflowRoot,
        task.promptDir ?? join("tasks", task.id),
        "prompt.md"
      )
      if (existsSync(promptPath)) {
        lines.push(
          "prompt:",
          "```",
          readFileSync(promptPath, "utf8").trim(),
          "```"
        )
      } else {
        lines.push(`cli: ${task.cli}`)
      }
    }
    lines.push("")
  }
  if (lines.length === 2) lines.push("(no propose tasks)", "")
  return lines.join("\n")
}

function readOptionalReason(dir: string): string | undefined {
  const path = join(dir, "review-reason.txt")
  if (!existsSync(path)) return undefined
  const text = readFileSync(path, "utf8").trim()
  return text.length > 0 ? text : undefined
}

/**
 * Prepare review materials and run the judge under trust-agent-review
 * (DES-026 / BL-052). Destructive ops skip the CLI and escalate.
 */
export async function runPublishAgentReview(options: {
  home: string
  runRoot: string
  workflowRoot: string
  workflow: Workflow
  /** A publish task, or a publish Output node (BL-084). */
  task: { id: string; connection: string; timeout?: number }
  changeSet: ChangeSet
  /** Replaces the task-graph goals file, for a node graph (BL-084). */
  goals?: string
}): Promise<AgentReviewResult> {
  const { home, runRoot, workflowRoot, workflow, task, changeSet } = options
  if (changeSet.ops.some((o) => o.destructive)) {
    return { verdict: "escalate", reason: "destructive" }
  }

  const reviewDir = publishChangesDir(runRoot, task.id)
  mkdirSync(reviewDir, { recursive: true })
  writeFileSync(
    join(reviewDir, "goals.md"),
    options.goals ?? proposeGoalsMarkdown(workflow, task.connection, workflowRoot)
  )
  writeFileSync(join(reviewDir, "review-instructions.md"), REVIEW_INSTRUCTIONS)

  const connReview = join(connectionDir(home, task.connection), "review.md")
  if (existsSync(connReview)) {
    copyFileSync(connReview, join(reviewDir, "connections-review.md"))
    // Alias the design path name for the judge prompt.
    copyFileSync(connReview, join(reviewDir, "review.md"))
  }

  const timeoutSeconds = resolveAttemptTimeout(task, workflow)
  const instructionsAbs = join(reviewDir, "review-instructions.md")
  const outcome = await runAgentJudgeDetailed({
    judge: { cli: "claude" },
    instructionsAbsPath: instructionsAbs,
    workflowRoot: reviewDir,
    attemptRoot: reviewDir,
    timeoutSeconds,
    workflowAgent: workflow.agent,
  })

  if (outcome.ok) {
    return {
      verdict: "approve",
      reason: readOptionalReason(reviewDir) ?? "approved",
    }
  }

  if (outcome.reason === "timeout") {
    return { verdict: "escalate", reason: "timeout" }
  }
  if (outcome.reason === "error" || outcome.reason === "missing") {
    return { verdict: "escalate", reason: "error" }
  }
  return {
    verdict: "escalate",
    reason: readOptionalReason(reviewDir) ?? "escalated",
  }
}
