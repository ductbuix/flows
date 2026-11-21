import { existsSync, realpathSync } from "node:fs"
import { resolve } from "node:path"
import {
  countAgentJudges,
  isAgentTask,
  judgePromptPath,
  needTaskId,
  taskPromptPath,
  type TrustCheck,
  type Workflow,
} from "@workspace/shared"
import { getCliAdapter, type CliKind } from "./cli-adapters.ts"
import { checkPathInsideHome } from "./path-checks.ts"
import { checkConnectionUses } from "./preflight-connections.ts"
import { checkModelEffort } from "./preflight-models.ts"
import { canApplySandbox, sandboxWriteRoot } from "./sandbox.ts"
import { workflowAgentClis } from "./workflow-agents.ts"

export type PreflightInput = {
  homeRealpath: string
  /** App home path for connection lookups (DES-026). */
  home: string
  workflowDir: string
  workflow: Workflow
  /** Known attempt dir when checking an existing run; optional. */
  attemptDir?: string
}

function checkWorkflowDir(input: PreflightInput): TrustCheck {
  return checkPathInsideHome({
    id: "workflow_dir",
    label: "Workflow dir",
    path: input.workflowDir,
    homeRealpath: input.homeRealpath,
  })
}

function checkAttemptDir(input: PreflightInput): TrustCheck {
  if (!input.attemptDir) {
    return {
      id: "attempt_dir",
      status: "pass",
      message: "No attempt dir yet (new run)",
    }
  }
  return checkPathInsideHome({
    id: "attempt_dir",
    label: "Attempt dir",
    path: input.attemptDir,
    homeRealpath: input.homeRealpath,
  })
}

function checkSandbox(input: PreflightInput): TrustCheck {
  if (!canApplySandbox()) {
    return {
      id: "sandbox",
      status: "warn",
      message: "sandbox-exec will not apply; task writes are unrestricted",
    }
  }
  try {
    const root = sandboxWriteRoot(input.workflowDir)
    const wf = realpathSync(input.workflowDir)
    if (root !== wf) {
      return {
        id: "sandbox",
        status: "warn",
        message: `Sandbox write root (${root}) differs from workflow realpath`,
      }
    }
    return {
      id: "sandbox",
      status: "pass",
      message: "Sandbox write root is the workflow realpath",
    }
  } catch {
    return {
      id: "sandbox",
      status: "warn",
      message: "Could not resolve sandbox write root",
    }
  }
}

async function checkCliInstalled(cli: CliKind): Promise<TrustCheck> {
  const adapter = getCliAdapter(cli)
  const version = await adapter.probeVersion()
  if (!version) {
    return {
      id: `cli_${cli}`,
      status: "warn",
      message: `${cli} CLI not found on PATH`,
    }
  }
  return {
    id: `cli_${cli}`,
    status: "pass",
    message: `${cli} ${version}`,
  }
}

function checkCliFlags(cli: CliKind): TrustCheck {
  const adapter = getCliAdapter(cli)
  return {
    id: `flags_${cli}`,
    status: "pass",
    message: adapter.describeFlags(),
  }
}

/**
 * Warn-only pre-run checks (DES-019 / DES-020). Never block; the dialog
 * lists pass/warn and asks the user to double check.
 */
export async function runPreflightChecks(
  input: PreflightInput
): Promise<TrustCheck[]> {
  const checks: TrustCheck[] = [
    checkWorkflowDir(input),
    checkAttemptDir(input),
    checkSandbox(input),
    ...checkMissingPrompts(input),
  ]
  const clis = workflowAgentClis(input.workflow)
  for (const cli of clis) {
    checks.push(await checkCliInstalled(cli))
    checks.push(checkCliFlags(cli))
  }
  checks.push(...(await checkModelEffort(input.workflow)))
  checks.push(
    ...(await checkConnectionUses({
      home: input.home,
      workflow: input.workflow,
    }))
  )
  return checks
}

/** Warn when authored agent prompts or judge files are missing (DES-020). */
function checkMissingPrompts(input: PreflightInput): TrustCheck[] {
  const missing: string[] = []
  for (const task of input.workflow.tasks) {
    if (task.promptDir) continue
    if (isAgentTask(task)) {
      const path = taskPromptPath(task.id)
      if (!existsSync(resolve(input.workflowDir, path))) {
        missing.push(path)
      }
    }
    pushMissingJudge(missing, input.workflowDir, task.id, task.when, "when.md")
    pushMissingJudge(
      missing,
      input.workflowDir,
      task.id,
      task.repeat?.until,
      "until.md"
    )
    for (const need of task.needs) {
      if (typeof need === "string" || !need.when) continue
      pushMissingJudge(
        missing,
        input.workflowDir,
        task.id,
        need.when,
        `need-${needTaskId(need)}.md`
      )
    }
  }
  if (missing.length === 0) {
    return [
      {
        id: "prompts",
        status: "pass",
        message: "Authored prompt and judge files are present",
      },
    ]
  }
  return [
    {
      id: "prompts",
      status: "warn",
      message: `Missing prompt or judge files: ${missing.join(", ")}`,
    },
  ]
}

function pushMissingJudge(
  missing: string[],
  workflowDir: string,
  taskId: string,
  condition: unknown,
  file: string
): void {
  if (
    !condition ||
    typeof condition === "boolean" ||
    typeof condition !== "object"
  ) {
    return
  }
  if (countAgentJudges(condition as never) === 0) return
  const slot =
    file === "when.md"
      ? ({ kind: "when" } as const)
      : file === "until.md"
        ? ({ kind: "until" } as const)
        : ({
            kind: "need",
            needTaskId: file.slice("need-".length, -".md".length),
          } as const)
  const path = judgePromptPath(taskId, slot)
  if (!existsSync(resolve(workflowDir, path))) missing.push(path)
}

export function hasWarning(checks: TrustCheck[]): boolean {
  return checks.some((c) => c.status === "warn")
}
