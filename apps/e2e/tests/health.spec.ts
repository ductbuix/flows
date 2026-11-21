import { expect, test } from "@playwright/test"

test("home shows sections and sidebar lists workflows", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByTestId("home-page")).toBeVisible()
  // Shared FLOWAPP_HOME: empty J1 (New work item) or sections if earlier tests left runs.
  await expect(
    page
      .getByTestId("home-create-work-item")
      .or(page.getByTestId("home-running"))
  ).toBeVisible()
  await expect(page.getByTestId("sidebar-workflow-diamond")).toBeVisible()
})
