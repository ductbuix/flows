import { expect, test } from "@playwright/test"

test("home lists workflows from FLOWAPP_HOME", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "Workflows" })).toBeVisible()
  await expect(page.getByRole("link", { name: "diamond" })).toBeVisible()
})
