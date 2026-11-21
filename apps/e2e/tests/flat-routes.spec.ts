import { expect, test } from "@playwright/test"
import { startRun } from "./helpers"

test.describe("flat routes (BL-032)", () => {
  test("redirects nested runs list to ?tab=runs", async ({ page }) => {
    await page.goto("/workflows/diamond/runs?x=1")
    await expect(page).toHaveURL(/\/workflows\/diamond\?x=1&tab=runs$/)
    await expect(page.getByTestId("run-list")).toBeVisible()
  })

  test("redirects nested run URL to /runs/:runId keeping params", async ({
    page,
    request,
  }) => {
    const runId = await startRun(request, "diamond")
    await page.goto(`/workflows/diamond/runs/${runId}?view=graph&task=a`)
    await expect(page).toHaveURL(
      new RegExp(`/runs/${runId}\\?view=graph&task=a$`)
    )
    await expect(page.getByTestId("run-status")).toBeVisible({
      timeout: 30_000,
    })
  })

  test("deep link to /runs/:runId loads the run view", async ({
    page,
    request,
  }) => {
    const runId = await startRun(request, "diamond")
    await page.goto(`/runs/${runId}?task=a`)
    await expect(page).toHaveURL(new RegExp(`/runs/${runId}\\?task=a$`))
    await expect(page.getByTestId("run-status")).toHaveText(
      /succeeded|running/,
      {
        timeout: 30_000,
      }
    )
    await expect(page.getByTestId("task-state-a")).toBeVisible()
  })
})
