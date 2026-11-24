import { expect, test } from "@playwright/test"

// Judge node in rule mode; the stub `claude` on PATH answers yes (BL-079).
test.use({ viewport: { width: 1440, height: 900 } })

const API = `http://127.0.0.1:${process.env.PW_API_PORT ?? "8787"}`

for (const theme of ["light", "dark"] as const) {
  test(`a Judge takes Yes and skips No on the canvas (${theme})`, async ({
    page,
  }, info) => {
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme)
    await page.goto(`/workflows/node-judge-${theme}?tab=editor`)
    await expect(page.getByTestId("canvas")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId("judge-rule")).toHaveValue(
      "Is the request reasonable?\n"
    )
    // Two labelled ports, and the edges say which branch they take.
    await expect(page.getByTestId("port-check-yes")).toBeAttached()
    await expect(page.getByTestId("port-check-no")).toBeAttached()
    await expect(page.locator(".react-flow__edge-text")).toHaveText([
      "Yes",
      "No",
    ])
    await page.screenshot({ path: info.outputPath(`node-judge-${theme}.png`) })

    await page.getByTestId("canvas-run").click()
    await page.getByTestId("start-run-submit").click()
    await page.getByTestId("trust-once").click()

    await expect(page.getByTestId("node-status-check")).toHaveText("Done", {
      timeout: 20_000,
    })
    await expect(page.getByTestId("node-verdict-check")).toHaveText("Yes")
    await expect(page.getByTestId("node-status-approved")).toHaveText("Done", {
      timeout: 20_000,
    })
    await expect(page.getByTestId("node-result-approved")).toContainText(
      "took-yes"
    )
    await expect(page.getByTestId("node-status-rejected")).toHaveText("Skipped")
    await page.screenshot({
      path: info.outputPath(`node-judge-run-${theme}.png`),
    })
  })

  test(`the run view shows the verdict and the rule (${theme})`, async ({
    page,
    request,
  }, info) => {
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme)
    const res = await request.post(
      `${API}/api/workflows/node-judge-${theme}-view/runs`,
      { data: { requestId: crypto.randomUUID() } }
    )
    expect(res.ok()).toBeTruthy()
    const { runId } = (await res.json()) as { runId: string }

    await page.goto(`/runs/${runId}`)
    await expect(page.getByTestId("step-table")).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByTestId("step-state-check-1")).toHaveText(
      "succeeded",
      { timeout: 20_000 }
    )
    await expect(page.getByTestId("step-verdict-check-1")).toHaveText("Yes")
    await expect(page.getByTestId("step-state-rejected-1")).toHaveText(
      "skipped"
    )
    await page.screenshot({
      path: info.outputPath(`node-judge-view-${theme}.png`),
    })

    await page.getByTestId("run-view-graph").click()
    await expect(page.getByTestId("node-verdict-check")).toHaveText("Yes")
    await expect(page.getByTestId("judge-rule")).toHaveValue(
      "Is the request reasonable?\n"
    )
    await page.screenshot({
      path: info.outputPath(`node-judge-view-graph-${theme}.png`),
    })
  })
}

test("Add node offers Judge with a rule and two ports", async ({ page }) => {
  await page.goto("/workflows/node-judge-add?tab=editor")
  await expect(page.getByTestId("node-empty")).toBeVisible({ timeout: 15_000 })
  await page.getByTestId("add-node").click()
  await page.getByTestId("add-node-judge").click()
  await expect(page.getByTestId("node-judge")).toBeVisible()
  await expect(page.getByTestId("judge-rule")).toBeVisible()
  await expect(page.getByTestId("port-judge-yes")).toBeAttached()
  await expect(page.getByTestId("port-judge-no")).toBeAttached()
})
