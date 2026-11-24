import {
  spawnWrapped as spawnWrappedAdapter,
  wrapCommandWithExitCode,
  type LaunchResult,
} from "@workspace/adapters-node"
import { getProcessRunner } from "./process-runner.ts"

export { wrapCommandWithExitCode, type LaunchResult }

/** Spawn via the engine's ProcessRunner port (DES-041). */
export function spawnWrapped(
  shellCommand: string,
  cwd: string,
  env: NodeJS.ProcessEnv,
  attemptRoot: string,
  codePath: string,
  workflowRoot: string,
  allowCursorHome = false,
  writeRoot?: string
): LaunchResult {
  return spawnWrappedAdapter(
    shellCommand,
    cwd,
    env,
    attemptRoot,
    codePath,
    workflowRoot,
    allowCursorHome,
    writeRoot,
    getProcessRunner()
  )
}
