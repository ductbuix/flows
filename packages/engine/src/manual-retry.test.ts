import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { deriveAttemptKind } from "@workspace/shared"
import { afterEach, describe, expect, it } from "vitest"
import { createEngine } from "./engine.ts"

const homes: string[] = []

afterEach(() => {
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

function writeWorkflow(home: string, id: string, yaml: string): string {
  const dir = join(home, "workflows", id)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, "workflow.yaml"), yaml)
  return dir
}

describe("manual retry", () => {
  it("reopens a failed run and labels the attempt Manual retry", async () => {
    const home = mkdtempSync(join(tmpdir(), "flowapp-manual-retry-"))
    homes.push(home)
    const workflowDir = writeWorkflow(
      home,
      "fail-once",
      `
id: fail-once
tasks:
  - id: a
    kind: command
    run: "exit 1"
  - id: b
    kind: command
    run: "printf ok > \\"$TASK_OUT/out.txt\\""
    needs: [a]
`
    )
    const engine = createEngine({ home })
    const handle = engine.startRun({ workflowDir, runId: "r1" })
    const failed = await handle.wait()
    expect(failed.status).toBe("failed")
    expect(failed.tasks.a?.status).toBe("failed")

    const retryHandle = engine.retryTask("r1", "a")
    expect(retryHandle.state().status).toBe("running")

    const again = await retryHandle.wait()
    expect(again.status).toBe("failed")
    const attempts = again.tasks.a?.attempts ?? []
    expect(attempts.length).toBeGreaterThanOrEqual(2)
    const last = attempts[attempts.length - 1]!
    expect(last.manualRetry).toBe(true)
    const kind = deriveAttemptKind(
      again.graph.tasks.find((t) => t.id === "a")!,
      attempts,
      attempts.length - 1
    )
    expect(kind.kind).toBe("manual_retry")
    expect(kind.label).toBe("Manual retry")
    engine.close()
  }, 20_000)
})
