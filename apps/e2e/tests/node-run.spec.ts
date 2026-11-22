import { expect, test } from "@playwright/test"

// Runs against the FLOWS_NODES=1 stack (project "nodes", DES-037 Rollout).
test.use({ viewport: { width: 1440, height: 900 } })

for (const theme of ["light", "dark"] as const) {
  test(`Run shows each node done with timer and result (${theme})`, async ({
    page,
  }, info) => {
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme)
    await page.goto(`/workflows/node-run-ok-${theme}?tab=editor`)
    await expect(page.getByTestId("canvas")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId("node-run-hint")).toHaveCount(0)

    await page.getByTestId("canvas-run").click()
    await page.getByTestId("start-run-submit").click()

    for (const id of ["start", "build", "done"]) {
      await expect(page.getByTestId(`node-status-${id}`)).toHaveText("Done", {
        timeout: 20_000,
      })
    }
    await expect(page.getByTestId("node-result-build")).toContainText("built")
    await expect(page.getByTestId("node-build")).toContainText(/\d+(ms|\.\ds)/)
    await expect(page.getByTestId("canvas-run")).toBeEnabled()
    await page.screenshot({ path: info.outputPath(`node-run-${theme}.png`) })
  })

  test(`a failing Command shows Retry (${theme})`, async ({ page }, info) => {
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme)
    await page.goto(`/workflows/node-run-fail-${theme}?tab=editor`)
    await expect(page.getByTestId("canvas")).toBeVisible({ timeout: 15_000 })

    await page.getByTestId("canvas-run").click()
    await page.getByTestId("start-run-submit").click()

    await expect(page.getByTestId("node-status-build")).toHaveText("Failed", {
      timeout: 20_000,
    })
    await expect(page.getByTestId("node-status-start")).toHaveText("Done")
    await expect(page.getByTestId("node-result-build")).toContainText("broken")
    const retry = page.getByTestId("node-build").getByRole("button", {
      name: "Retry",
    })
    await expect(retry).toBeVisible()
    await page.screenshot({
      path: info.outputPath(`node-run-failed-${theme}.png`),
    })

    const sent = page.waitForRequest(
      (r) => /\/tasks\/build\/retry$/.test(r.url()) && r.method() === "POST"
    )
    await retry.click()
    await sent
    await expect(page.getByTestId("node-status-build")).toHaveText("Failed", {
      timeout: 20_000,
    })
  })
}

test("Run is disabled without a Trigger", async ({ page }) => {
  await page.goto("/workflows/node-run-none?tab=editor")
  await expect(page.getByTestId("canvas")).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId("canvas-run")).toBeDisabled()
  await expect(page.getByTestId("node-run-hint")).toHaveText(
    "Add a trigger to run"
  )
})
