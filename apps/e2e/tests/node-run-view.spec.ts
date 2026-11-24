import { expect, test } from "@playwright/test"

// Node workflows on the default stack (BL-096).
test.use({ viewport: { width: 1440, height: 900 } })

const API = `http://127.0.0.1:${process.env.PW_API_PORT ?? "8787"}`

for (const theme of ["light", "dark"] as const) {
  test(`a finished node run shows step rows and the failed step (${theme})`, async ({
    page,
    request,
  }, info) => {
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme)
    const id = `node-view-${theme}`
    const res = await request.post(`${API}/api/workflows/${id}/runs`, {
      data: { requestId: crypto.randomUUID() },
    })
    expect(res.ok()).toBeTruthy()
    const { runId } = (await res.json()) as { runId: string }

    await page.goto(`/runs/${runId}`)
    await expect(page.getByTestId("step-table")).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByTestId("step-state-start-1")).toHaveText(
      "succeeded",
      { timeout: 20_000 }
    )
    await expect(page.getByTestId("step-state-build-1")).toHaveText("failed")
    const row = page.getByTestId("step-row-build-1")
    await expect(row).toContainText("1")
    await expect(row.getByLabel("command")).toBeVisible()
    await expect(row).toHaveClass(/bg-muted/)
    await expect(page.getByTestId("task-detail-status")).toHaveText("failed")
    await page.screenshot({
      path: info.outputPath(`node-run-view-${theme}.png`),
    })

    await page.getByTestId("run-view-graph").click()
    await expect(page.getByTestId("node-build")).toBeVisible()
    await expect(page.getByTestId("node-status-build")).toHaveText("Failed")
    await expect(page.getByTestId("node-status-start")).toHaveText("Done")
    await expect(page.getByTestId("node-settings-build")).toHaveCount(0)
    await expect(
      page.getByTestId("node-build").getByRole("button", { name: "Retry" })
    ).toHaveCount(0)
    const [a, b] = await Promise.all([
      page.getByTestId("node-start").boundingBox(),
      page.getByTestId("node-build").boundingBox(),
    ])
    // The frozen layout puts Build right of and below Start (fit view scales it).
    expect(b!.x).toBeGreaterThan(a!.x + 100)
    expect(b!.y).toBeGreaterThan(a!.y + 20)
    await page.screenshot({
      path: info.outputPath(`node-run-view-graph-${theme}.png`),
    })

    await page.getByTestId("node-build").click()
    await expect(page).toHaveURL(/task=build/)
  })
}
