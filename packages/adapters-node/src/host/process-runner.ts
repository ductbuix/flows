import { createNodeProcessRunner } from "../process-runner.ts"
import type { ProcessRunner } from "@workspace/core/ports"

let runner: ProcessRunner = createNodeProcessRunner()

export function getProcessRunner(): ProcessRunner {
  return runner
}

export function setProcessRunner(next: ProcessRunner): void {
  runner = next
}
