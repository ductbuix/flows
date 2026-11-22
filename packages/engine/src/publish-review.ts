import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"
import type { ChangeSet, Workflow } from "@workspace/shared"
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
  workflow: Pick<Workflow, "agent" | "timeout">
  /** A publish Output node (BL-084). */
  task: { id: string; connection: string; timeout?: number }
  changeSet: ChangeSet
  /** The goals file the reviewer reads, built from the node graph (BL-084). */
  goals: string
}): Promise<AgentReviewResult> {
  const { home, runRoot, workflow, task, changeSet } = options
  if (changeSet.ops.some((o) => o.destructive)) {
    return { verdict: "escalate", reason: "destructive" }
  }

  const reviewDir = publishChangesDir(runRoot, task.id)
  mkdirSync(reviewDir, { recursive: true })
  writeFileSync(
    join(reviewDir, "goals.md"),
    options.goals
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
