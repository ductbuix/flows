import { expect, test } from "@playwright/test"
import { cancelLiveRuns } from "./helpers"

async function openFixLogin(page: import("@playwright/test").Page) {
  await page.goto("/docket")
  await expect(page.getByTestId("docket-page")).toBeVisible()
  await page.getByTestId("docket-card-fix-login").click()
  await expect(page.getByTestId("docket-panel")).toBeVisible()
}

test.describe("runs.spec.ts › page gone", () => {
  test("page gone", async ({ page }) => {
    await page.goto("/runs")
    await expect(page.getByTestId("runs-page")).toHaveCount(0)
    await expect(page.getByTestId("runs-start-open")).toHaveCount(0)
    await page.goto("/docket")
    await expect(page.getByTestId("app-sidebar")).toBeVisible()
    await expect(
      page.getByTestId("app-sidebar").getByRole("link", { name: "Runs" })
    ).toHaveCount(0)
  })
})

test.describe("runs.spec.ts › sheet in context", () => {
  test("sheet in context", async ({ page }) => {
    // Own fixture: avoid diamond concurrency with docket card-run specs.
    await cancelLiveRuns("sheet-delete-demo")
    await openFixLogin(page)
    const panel = page.getByTestId("docket-panel")

    await panel.getByTestId("card-run-open").click()
    const dialog = page.getByTestId("card-run-dialog")
    await dialog.getByTestId("card-run-workflow").click()
    await page.getByRole("option", { name: /sheet delete demo/i }).click()
    await dialog.getByTestId("card-run-start").click()

    await expect(page.getByTestId("runs-sheet")).toBeVisible({
      timeout: 15_000,
    })
    const runId = await page
      .getByTestId("runs-sheet")
      .getAttribute("data-run-id")
    expect(runId).toBeTruthy()
    await expect(panel.getByTestId(`card-run-row-${runId}`)).toBeVisible({
      timeout: 15_000,
    })

    await expect(page.getByTestId("runs-rerun")).toBeVisible({
      timeout: 20_000,
    })
    await page.getByTestId("runs-menu").click()
    await page.getByTestId("runs-delete").click()
    await page
      .getByTestId("confirm-dialog")
      .getByRole("button", { name: "Delete run" })
      .click()
    await expect(page.getByTestId("runs-sheet")).toHaveCount(0)
    await expect(panel.getByTestId(`card-run-row-${runId}`)).toHaveCount(0)
  })
})
