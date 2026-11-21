import { expect, test } from "@playwright/test"
import { startRun } from "./helpers"

test.describe("home needs you (BL-035)", () => {
  test("gated task appears on Home; approve runs it", async ({
    page,
    request,
  }) => {
    test.setTimeout(60_000)
    const runId = await startRun(request, "gate")

    await page.goto("/")
    await expect(page.getByTestId("home-page")).toBeVisible()

    const confirmation = page.getByTestId(`home-needs-you-${runId}-hold`)
    await expect(confirmation).toBeVisible({ timeout: 15_000 })
    await expect(confirmation).toContainText("gate")
    await expect(confirmation).toContainText("hold")
    await expect(confirmation).toContainText(runId)

    await page.screenshot({
      path: "test-results/home-needs-you-light.png",
      fullPage: true,
    })

    await page.keyboard.press("d")
    await expect(page.locator("html")).toHaveClass(/dark/)
    await page.screenshot({
      path: "test-results/home-needs-you-dark.png",
      fullPage: true,
    })
    await page.keyboard.press("d")
    await expect(page.locator("html")).toHaveClass(/light/)

    await page.getByTestId(`home-approve-${runId}-hold`).click()
    await expect(confirmation).toHaveCount(0, { timeout: 20_000 })

    await expect(page.getByTestId(`home-recent-${runId}`)).toBeVisible({
      timeout: 20_000,
    })

    await page.goto(`/runs/${runId}?task=hold`)
    await expect(page.getByTestId("task-state-hold")).toHaveText("succeeded", {
      timeout: 20_000,
    })
    await expect(page.getByTestId("task-state-after")).toHaveText("succeeded", {
      timeout: 20_000,
    })
    await expect(page.getByTestId("run-status")).toHaveText("succeeded")
  })
})
