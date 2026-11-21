import { expect, test } from "@playwright/test"

test("home shows empty state and sidebar lists workflows", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByTestId("home-empty")).toBeVisible()
  await expect(page.getByTestId("sidebar-workflow-diamond")).toBeVisible()
})
