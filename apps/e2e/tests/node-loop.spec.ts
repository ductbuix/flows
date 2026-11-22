import { expect, test } from "@playwright/test"

// Loops with back edges and a loop limit (BL-081). The stub `claude` Judge
// says No before pass 3 and Yes from then on (fixtures/home.ts).
test.use({ viewport: { width: 1440, height: 900 } })

const API = `http://127.0.0.1:${process.env.PW_API_PORT ?? "8787"}`

async function startRun(
  request: import("@playwright/test").APIRequestContext,
  workflowId: string
): Promise<string> {
  const res = await request.post(`${API}/api/workflows/${workflowId}/runs`, {
    data: { requestId: crypto.randomUUID() },
  })
  expect(res.ok()).toBeTruthy()
  return ((await res.json()) as { runId: string }).runId
}

for (const theme of ["light", "dark"] as const) {
  test(`the loop edge is curved with a Badge and the node counts passes (${theme})`, async ({
    page,
  }, info) => {
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme)
    await page.goto(`/workflows/node-loop-${theme}?tab=editor`)
    await expect(page.getByTestId("canvas")).toBeVisible({ timeout: 15_000 })
    // One loop edge: the No branch back into draft.
    await expect(page.locator('[data-testid^="loop-badge-"]')).toHaveCount(1)
    await expect(page.locator('[data-testid^="loop-badge-"]')).toHaveText("Loop")
    await expect(page.getByTestId("loop-warnings")).toHaveCount(0)
    await page.screenshot({ path: info.outputPath(`node-loop-${theme}.png`) })

    await page.getByTestId("canvas-run").click()
    await page.getByTestId("start-run-submit").click()
    await page.getByTestId("trust-once").click()

    await expect(page.getByTestId("node-status-ship")).toHaveText("Done", {
      timeout: 30_000,
    })
    await expect(page.getByTestId("node-pass-draft")).toHaveText("Pass 3")
    await expect(page.getByTestId("node-pass-check")).toHaveText("Pass 3")
    await expect(page.getByTestId("node-verdict-check")).toHaveText("Yes")
    await page.screenshot({
      path: info.outputPath(`node-loop-run-${theme}.png`),
    })
  })

  test(`the run view lists a row for each pass (${theme})`, async ({
    page,
    request,
  }, info) => {
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme)
    const runId = await startRun(request, `node-loop-view-${theme}`)

    await page.goto(`/runs/${runId}`)
    await expect(page.getByTestId("step-table")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId("step-state-ship-1")).toHaveText("succeeded", {
      timeout: 30_000,
    })
    for (const pass of [1, 2, 3]) {
      await expect(page.getByTestId(`step-state-draft-${pass}`)).toHaveText(
        "succeeded"
      )
      await expect(page.getByTestId(`step-state-check-${pass}`)).toHaveText(
        "succeeded"
      )
    }
    await expect(page.getByTestId("step-verdict-check-1")).toHaveText("No")
    await expect(page.getByTestId("step-verdict-check-2")).toHaveText("No")
    await expect(page.getByTestId("step-verdict-check-3")).toHaveText("Yes")
    await expect(page.getByTestId("step-row-draft-4")).toHaveCount(0)
    await expect(page.getByTestId("step-row-draft-3")).toContainText("3")
    await page.screenshot({
      path: info.outputPath(`node-loop-view-${theme}.png`),
    })

    await page.getByTestId("run-view-graph").click()
    await expect(page.getByTestId("node-pass-draft")).toHaveText("Pass 3")
    await expect(page.locator('[data-testid^="loop-badge-"]')).toHaveCount(1)
    await page.screenshot({
      path: info.outputPath(`node-loop-view-graph-${theme}.png`),
    })
  })
}

test("a loop that never ends fails with loop_limit at pass limit + 1", async ({
  page,
  request,
}, info) => {
  const runId = await startRun(request, "node-loop-limit")
  await page.goto(`/runs/${runId}`)
  await expect(page.getByTestId("step-table")).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId("step-state-draft-3")).toHaveText("failed", {
    timeout: 30_000,
  })
  await expect(page.getByTestId("step-verdict-draft-3")).toHaveText("Loop limit")
  await expect(page.getByTestId("step-state-draft-2")).toHaveText("succeeded")
  await expect(page.getByTestId("step-row-draft-4")).toHaveCount(0)
  await expect(page.getByTestId("step-state-ship-1")).toHaveText("skipped")
  await page.screenshot({ path: info.outputPath("node-loop-limit.png") })
})

test("a cycle with no Judge shows a warning on the editor", async ({ page }) => {
  await page.goto("/workflows/node-loop-warn?tab=editor")
  await expect(page.getByTestId("canvas")).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId("loop-warnings")).toContainText("no Judge")
  await expect(page.locator('[data-testid^="loop-badge-"]')).toHaveCount(1)
})
