import { expect, test } from "@playwright/test"
import { cancelLiveRuns, fcpRequest, startRun } from "./helpers"

test.describe("workflows.spec.ts › canvas run bar", () => {
  test("canvas run bar", async ({ page }) => {
    await page.goto("/workflows/diamond")
    await expect(page.getByTestId("flow-run-bar")).toBeVisible()
    await page.getByTestId("flow-run-card").click()
    await page.getByRole("option", { name: /Fix flaky login/i }).click()
    await expect(page.getByTestId("flow-start-run")).toBeEnabled()
    await page.getByTestId("flow-start-run").click()
    await expect(page.getByTestId("flow-run-banner")).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByTestId("flow-run-select")).toBeVisible()
    await expect(
      page.locator('[data-testid="canvas-node-command"]')
    ).toBeVisible()
  })

  test("offers Retry on a failed node", async ({ page }) => {
    test.setTimeout(90_000)
    await cancelLiveRuns("node-run-fail-light")
    const runId = await startRun("node-run-fail-light")
    await expect
      .poll(
        async () => {
          const got = (await fcpRequest("run/get", { id: runId })) as {
            status: string
          }
          return got.status
        },
        { timeout: 45_000 }
      )
      .toBe("failed")
    await page.goto(`/workflows/node-run-fail-light?run=${runId}`)
    await expect(page.getByTestId("flow-run-banner")).toContainText(/Failed/i, {
      timeout: 15_000,
    })
    const retry = page.getByTestId("node-retry-build")
    await expect(retry).toBeVisible({ timeout: 15_000 })
    await retry.click({ force: true })
    await expect(page.getByTestId("flow-run-banner")).toBeVisible()
  })
  test("node logs button and popup", async ({ page }) => {
    test.setTimeout(90_000)
    await cancelLiveRuns("node-run-fail-light")
    const runId = await startRun("node-run-fail-light")
    await expect
      .poll(
        async () =>
          (
            (await fcpRequest("run/get", { id: runId })) as {
              status: string
            }
          ).status,
        { timeout: 45_000 }
      )
      .toBe("failed")
    await page.goto(`/workflows/node-run-fail-light?run=${runId}`)
    const logs = page.getByTestId("node-logs-build")
    await expect(logs).toBeVisible({ timeout: 15_000 })
    // Trigger and output run nothing locally: no button.
    await expect(page.locator('[data-testid^="node-logs-"]')).toHaveCount(1)

    for (const size of [
      { width: 1280, height: 800 },
      { width: 375, height: 700 },
    ]) {
      await page.setViewportSize(size)
      await logs.click({ force: true })
      const dialog = page.getByTestId("node-log-dialog")
      await expect(dialog).toBeVisible()
      await expect(page.getByTestId("node-log-terminal")).toContainText(
        "echo broken"
      )
      await expect(page.getByTestId("node-log-terminal")).toContainText(
        "broken"
      )
      const entries = page.getByTestId("node-log-entries").locator("> li")
      await expect(entries.first().locator("time")).toBeVisible()
      const box = await dialog.boundingBox()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(size.width)
      await page.keyboard.press("Escape")
      await expect(dialog).toHaveCount(0)
    }
  })
})

test.describe("workflows-run.spec.ts › canvas inbox ask", () => {
  test("approval ask on the node resumes the run", async ({ page }) => {
    test.setTimeout(90_000)
    await cancelLiveRuns("node-approval-light")
    const runId = await startRun("node-approval-light")

    await page.goto(`/workflows/node-approval-light?run=${runId}`)
    await expect(page.getByTestId("canvas-node-approval")).toBeVisible()
    const prompt = page.getByTestId("node-inbox-gate")
    await expect(prompt).toContainText("Ship the change?", { timeout: 20_000 })
    await page.getByTestId("node-inbox-approved-gate").click()
    await expect(prompt).toHaveCount(0)

    await expect
      .poll(
        async () =>
          (
            (await fcpRequest("run/get", { id: runId })) as {
              status?: string
            }
          ).status,
        { timeout: 45_000 }
      )
      .toBe("succeeded")
  })
})
