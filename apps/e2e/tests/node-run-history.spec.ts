import { expect, test } from "@playwright/test"

// Run history on the canvas (BL-103).
test.use({ viewport: { width: 1440, height: 900 } })

const API = `http://127.0.0.1:${process.env.PW_API_PORT ?? "8787"}`

for (const theme of ["light", "dark"] as const) {
  test(`a past run shows the old graph after editing (${theme})`, async ({
    page,
    request,
  }, info) => {
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme)
    const id = `node-history-${theme}`
    const res = await request.post(`${API}/api/workflows/${id}/runs`, {
      data: { requestId: crypto.randomUUID() },
    })
    expect(res.ok()).toBeTruthy()
    const { runId } = (await res.json()) as { runId: string }

    await page.goto(`/workflows/${id}?tab=editor`)
    await expect(page.getByTestId("canvas")).toBeVisible({ timeout: 15_000 })
    const row = page.getByTestId(`run-history-${runId}`)
    await expect(row).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId(`run-history-status-${runId}`)).toHaveText(
      "succeeded",
      { timeout: 20_000 }
    )

    // Edit the workflow: a fourth node the old run never saw.
    await page.getByTestId("add-node").click()
    await page.getByTestId("add-node-command").click()
    await page.getByTestId("node-save").click()
    await expect(page.getByTestId("node-save")).toBeDisabled()
    const before = await page.locator(".react-flow__node").count()
    expect(before).toBe(4)
    await page.screenshot({ path: info.outputPath(`node-history-card-${theme}.png`) })

    await row.click()
    await expect(page.getByTestId("past-run")).toBeVisible()
    await expect(page.getByTestId("run-graph")).toBeVisible()
    await expect(page.getByTestId("node-build")).toBeVisible()
    await expect(page.getByTestId("node-status-build")).toHaveText("Done")
    await expect(page.locator(".react-flow__node")).toHaveCount(3)
    await expect(page.getByTestId("node-settings-build")).toHaveCount(0)
    await page.screenshot({ path: info.outputPath(`node-history-past-${theme}.png`) })

    await page.getByTestId("back-to-editing").click()
    await expect(page.getByTestId("past-run")).toHaveCount(0)
    await expect(page.getByTestId("canvas")).toBeVisible()
    await expect(page.locator(".react-flow__node")).toHaveCount(4)
  })
}
