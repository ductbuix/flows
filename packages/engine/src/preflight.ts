import { realpathSync } from "node:fs"
import type { TrustCheck, Workflow } from "@workspace/shared"
import { getCliAdapter, type CliKind } from "./cli-adapters.ts"
import { checkPathInsideHome } from "./path-checks.ts"
import { canApplySandbox, sandboxWriteRoot } from "./sandbox.ts"
import { workflowAgentClis } from "./workflow-agents.ts"

export type PreflightInput = {
  homeRealpath: string
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
 * Warn-only pre-run checks (DES-019). Never block; the dialog lists
 * pass/warn and asks the user to double check.
 */
export async function runPreflightChecks(
  input: PreflightInput
): Promise<TrustCheck[]> {
  const checks: TrustCheck[] = [
    checkWorkflowDir(input),
    checkAttemptDir(input),
    checkSandbox(input),
  ]
  const clis = workflowAgentClis(input.workflow)
  for (const cli of clis) {
    checks.push(await checkCliInstalled(cli))
    checks.push(checkCliFlags(cli))
  }
  return checks
}

export function hasWarning(checks: TrustCheck[]): boolean {
  return checks.some((c) => c.status === "warn")
}
