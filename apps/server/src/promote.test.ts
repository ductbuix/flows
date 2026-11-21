import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { chmodSync } from "node:fs"
import { createEngine } from "@workspace/engine"
import { afterEach, describe, expect, it } from "vitest"
import { createApp } from "./app.ts"

const homes: string[] = []

afterEach(() => {
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
  delete process.env.FLOWAPP_RETRY_BACKOFF_MS
})

function installStubClaude(home: string, spawnYaml: string) {
  const bin = join(home, "bin")
  mkdirSync(bin, { recursive: true })
  const script = `#!/bin/bash
set -euo pipefail
mkdir -p "$TASK_OUT/spawn"
printf '%s' '${spawnYaml.replace(/'/g, `'\\''`)}' > "$TASK_OUT/spawn/child.yaml"
`
  writeFileSync(join(bin, "claude"), script)
  chmodSync(join(bin, "claude"), 0o755)
  process.env.PATH = `${bin}:${process.env.PATH ?? ""}`
}

describe("promote spawned task", () => {
  it("copies a spawned task into workflow.yaml and its prompt folder", async () => {
    process.env.FLOWAPP_RETRY_BACKOFF_MS = "10"
    const home = mkdtempSync(join(tmpdir(), "flowapp-promote-"))
    homes.push(home)
    const wf = join(home, "workflows", "research")
    mkdirSync(join(wf, "tasks", "plan"), { recursive: true })
    writeFileSync(join(wf, "tasks", "plan", "prompt.md"), "Plan.\n")
    writeFileSync(
      join(wf, "workflow.yaml"),
      `id: research
limits: { agents: 2, maxTasks: 20, maxSpawnDepth: 2 }
tasks:
  - id: plan
    kind: agent
    cli: claude
    spawn: true
`
    )
    installStubClaude(
      home,
      'kind: command\nname: Fetch\nrun: "printf ok > \\"$TASK_OUT/done.txt\\""\nneeds: [plan]\n'
    )

    const engine = createEngine({ home })
    const app = createApp({ engine })
    const handle = engine.startRun({
      workflowDir: wf,
      runId: "r1",
      trustGrant: "once",
    })
    const state = await handle.wait()
    const child = state.graph.tasks.find((t) => t.spawnedBy === "plan")
    expect(child).toBeDefined()

    // Seed a prompt folder under the stem so promote has something to copy.
    const stemDir = join(wf, "runs", "r1", child!.promptDir!)
    mkdirSync(stemDir, { recursive: true })
    writeFileSync(join(stemDir, "prompt.md"), "spawned prompt\n")

    const res = await app.request(`/api/runs/r1/tasks/${child!.id}/promote`, {
      method: "POST",
    })
    expect(res.status).toBe(200)
    const yaml = readFileSync(join(wf, "workflow.yaml"), "utf8")
    expect(yaml).toContain(`id: ${child!.id}`)
    expect(yaml).toContain("kind: command")
    expect(yaml).toContain("name: Fetch")
    expect(yaml).not.toContain("spawnedBy")
    expect(yaml).not.toContain("promptDir")
    expect(existsSync(join(wf, "tasks", child!.id, "prompt.md"))).toBe(true)
    engine.close()
  }, 30_000)
})
