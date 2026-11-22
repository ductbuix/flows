import { expect, test } from "@playwright/test"

test.describe("workflow overview (BL-037)", () => {
  test("tabs switch Overview, Editor and Runs", async ({ page }) => {
    await page.goto("/workflows/diamond")
    await expect(page.getByTestId("workflow-tab-overview")).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByTestId("overview-nodes")).toBeVisible()
    await expect(page.getByTestId("run-start")).toBeVisible()

    await page.getByTestId("workflow-tab-editor").click()
    await expect(page).toHaveURL(/tab=editor/)
    await expect(page.getByTestId("canvas")).toBeVisible()

    await page.getByTestId("workflow-tab-runs").click()
    await expect(page).toHaveURL(/tab=runs/)
    await expect(page.getByTestId("run-list")).toBeVisible()
  })
})
