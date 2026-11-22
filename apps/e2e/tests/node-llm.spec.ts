import { expect, test } from "@playwright/test"

// LLM node; the stub `claude` on PATH answers a summary line (BL-083).
test.use({ viewport: { width: 1440, height: 900 } })

const API = `http://127.0.0.1:${process.env.PW_API_PORT ?? "8787"}`

for (const theme of ["light", "dark"] as const) {
  test(`an LLM step turns its prompt into text on the canvas (${theme})`, async ({
    page,
  }, info) => {
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme)
    await page.goto(`/workflows/node-llm-${theme}?tab=editor`)
    await expect(page.getByTestId("canvas")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId("llm-prompt")).toHaveValue(
      "Write one line about the weather.\n"
    )
    await page.screenshot({ path: info.outputPath(`node-llm-${theme}.png`) })

    await page.getByTestId("canvas-run").click()
    await page.getByTestId("start-run-submit").click()
    await page.getByTestId("trust-once").click()

    await expect(page.getByTestId("node-status-write")).toHaveText("Done", {
      timeout: 20_000,
    })
    await expect(page.getByTestId("node-status-show")).toHaveText("Done", {
      timeout: 20_000,
    })
    await expect(page.getByTestId("node-result-show")).toContainText(
      "Summary: Write one line about the weather."
    )
    await page.screenshot({ path: info.outputPath(`node-llm-run-${theme}.png`) })
  })

  test(`the run view lists the LLM step (${theme})`, async ({
    page,
    request,
  }, info) => {
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme)
    const res = await request.post(
      `${API}/api/workflows/node-llm-${theme}-view/runs`,
      { data: { requestId: crypto.randomUUID() } }
    )
    expect(res.ok()).toBeTruthy()
    const { runId } = (await res.json()) as { runId: string }

    await page.goto(`/runs/${runId}`)
    await expect(page.getByTestId("step-table")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId("step-state-write-1")).toHaveText("succeeded", {
      timeout: 20_000,
    })
    await page.screenshot({ path: info.outputPath(`node-llm-view-${theme}.png`) })

    await page.getByTestId("run-view-graph").click()
    await expect(page.getByTestId("llm-prompt")).toHaveValue(
      "Write one line about the weather.\n"
    )
    await page.screenshot({
      path: info.outputPath(`node-llm-view-graph-${theme}.png`),
    })
  })
}

test("Add node offers LLM with a prompt and a text out port", async ({ page }) => {
  await page.goto("/workflows/node-llm-add?tab=editor")
  await expect(page.getByTestId("node-empty")).toBeVisible({ timeout: 15_000 })
  await page.getByTestId("add-node").click()
  await page.getByTestId("add-node-llm").click()
  await expect(page.getByTestId("node-llm")).toBeVisible()
  await expect(page.getByTestId("llm-prompt")).toBeVisible()
})
