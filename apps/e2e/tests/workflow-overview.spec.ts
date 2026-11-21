import { expect, test } from "@playwright/test"

test.describe("workflow overview (BL-037)", () => {
  test("Overview shows tasks, inputs and Start card; light and dark", async ({
    page,
  }) => {
    await page.goto("/workflows/run-inputs")
    await expect(page.getByTestId("workflow-overview")).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByTestId("workflow-detail-tabs")).toBeVisible()
    await expect(page.getByTestId("overview-tasks")).toBeVisible()
    await expect(page.getByTestId("overview-inputs")).toBeVisible()
    await expect(page.getByTestId("workflow-start-card")).toBeVisible()
    await expect(page.getByTestId("start-run-submit")).toBeVisible()

    await page.screenshot({
      path: "test-results/workflow-overview-light.png",
      fullPage: true,
    })

    await page.goto("/settings")
    await page.getByTestId("theme-toggle").getByText("Dark").click()
    await expect(page.locator("html")).toHaveClass(/dark/)
    await page.goto("/workflows/run-inputs")
    await expect(page.getByTestId("workflow-overview")).toBeVisible({
      timeout: 15_000,
    })
    await page.screenshot({
      path: "test-results/workflow-overview-dark.png",
      fullPage: true,
    })
  })

  test("tabs switch Overview, Editor and Runs", async ({ page }) => {
    await page.goto("/workflows/diamond")
    await expect(page.getByTestId("workflow-tab-overview")).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByTestId("overview-tasks")).toBeVisible()

    await page.getByTestId("workflow-tab-editor").click()
    await expect(page).toHaveURL(/tab=editor/)
    await expect(page.getByTestId("graph-canvas")).toBeVisible()

    await page.getByTestId("workflow-tab-runs").click()
    await expect(page).toHaveURL(/tab=runs/)
    await expect(page.getByTestId("run-list")).toBeVisible()
  })
})
