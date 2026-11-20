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
import { createEngine } from "@workspace/engine"
import { workflowFileDetailSchema } from "@workspace/shared"
import { afterEach, describe, expect, it } from "vitest"
import { createApp } from "./app.ts"
import { hashContent } from "./hash.ts"

const homes: string[] = []

afterEach(() => {
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

function stack() {
  const home = mkdtempSync(join(tmpdir(), "flowapp-files-"))
  homes.push(home)
  const engine = createEngine({ home })
  const app = createApp({ engine })
  return { home, engine, app }
}

async function seedWorkflow(app: ReturnType<typeof createApp>, id: string) {
  await app.request("/api/workflows", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, goal: "files" }),
  })
}

describe("workflow-scoped files API", () => {
  it("creates, reads and updates an instructions file", async () => {
    const { home, engine, app } = stack()
    await seedWorkflow(app, "file-wf")

    const putRes = await app.request(
      "/api/workflows/file-wf/files/tasks/plan.md",
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: "# plan\n" }),
      }
    )
    expect(putRes.status).toBe(200)
    const created = workflowFileDetailSchema.parse(await putRes.json())
    expect(created.path).toBe("tasks/plan.md")
    expect(created.content).toBe("# plan\n")
    expect(
      readFileSync(
        join(home, "workflows", "file-wf", "tasks", "plan.md"),
        "utf8"
      )
    ).toBe("# plan\n")

    const getRes = await app.request(
      "/api/workflows/file-wf/files/tasks/plan.md"
    )
    expect(getRes.status).toBe(200)
    expect(workflowFileDetailSchema.parse(await getRes.json()).hash).toBe(
      created.hash
    )

    const next = await app.request(
      "/api/workflows/file-wf/files/tasks/plan.md",
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: "# next\n", baseHash: created.hash }),
      }
    )
    expect(next.status).toBe(200)
    expect(workflowFileDetailSchema.parse(await next.json()).content).toBe(
      "# next\n"
    )
    engine.close()
  })

  it("rejects protected and invalid relative paths over HTTP", async () => {
    const { engine, app } = stack()
    await seedWorkflow(app, "safe-wf")

    for (const rel of [
      "workflow.yaml",
      "runs/r1/graph.json",
      "tasks/evil\\x.md",
    ]) {
      const res = await app.request(
        `/api/workflows/safe-wf/files/${encodeURI(rel)}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ content: "x" }),
        }
      )
      expect(res.status, rel).toBe(400)
    }
    engine.close()
  })

  it("returns 409 on baseHash conflict", async () => {
    const { home, engine, app } = stack()
    await seedWorkflow(app, "conflict-wf")
    const dir = join(home, "workflows", "conflict-wf", "tasks")
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "a.md"), "# disk\n")

    const res = await app.request(
      "/api/workflows/conflict-wf/files/tasks/a.md",
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content: "# mine\n",
          baseHash: hashContent("# stale\n"),
        }),
      }
    )
    expect(res.status).toBe(409)
    const body = (await res.json()) as {
      message: string
      diskContent: string
      diskHash: string
    }
    expect(body.message).toBe("conflict")
    expect(body.diskContent).toBe("# disk\n")
    expect(body.diskHash).toBe(hashContent("# disk\n"))
    expect(existsSync(join(dir, "a.md"))).toBe(true)
    expect(readFileSync(join(dir, "a.md"), "utf8")).toBe("# disk\n")
    engine.close()
  })
})
