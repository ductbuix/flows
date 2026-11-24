import { expect, test } from "@playwright/test"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

// LLM over ACP with the fake agent profile on PATH (BL-142).
const API = `http://127.0.0.1:${process.env.PW_API_PORT ?? "8787"}`
const home = process.env.FLOWAPP_HOME!

test("an LLM step runs over ACP when agents.runtime=acp", async ({
  request,
}) => {
  writeFileSync(join(home, "config.yaml"), "agents:\n  runtime: acp\n")
  try {
    const res = await request.post(`${API}/api/workflows/node-llm-acp/runs`, {
      data: { requestId: crypto.randomUUID(), trustGrant: "once" },
    })
    expect(res.ok()).toBeTruthy()
    const { runId } = (await res.json()) as { runId: string }

    let status = "running"
    for (let i = 0; i < 60; i++) {
      const run = await request.get(`${API}/api/runs/${runId}`)
      expect(run.ok()).toBeTruthy()
      const summary = (await run.json()) as { status: string }
      status = summary.status
      if (status === "succeeded" || status === "failed") break
      await new Promise((r) => setTimeout(r, 500))
    }
    expect(status).toBe("succeeded")

    const text = readFileSync(
      join(
        home,
        "workflows/node-llm-acp/runs",
        runId,
        "nodes/write/pass-1/text.md"
      ),
      "utf8"
    )
    expect(text).toContain("Summary: Write one line about the weather.")
  } finally {
    writeFileSync(join(home, "config.yaml"), "")
  }
})
