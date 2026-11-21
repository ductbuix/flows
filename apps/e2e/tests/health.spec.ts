import { expect, test } from "@playwright/test"

test("home shows sections and sidebar lists workflows", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByTestId("home-page")).toBeVisible()
  await expect(page.getByTestId("home-running")).toBeVisible()
  await expect(page.getByTestId("sidebar-workflow-diamond")).toBeVisible()
})
