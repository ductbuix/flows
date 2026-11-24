import { expect, test } from "@playwright/test"

test.describe("settings theme (BL-185)", () => {
  test("theme toggle and shortcut hint", async ({ page }) => {
    await page.goto("/settings")
    await expect(page.getByTestId("settings-page")).toBeVisible()
    await expect(page.getByTestId("theme-shortcut-hint")).toContainText("d")
    await expect(
      page.getByTestId("theme-shortcut-hint").locator("kbd")
    ).toHaveText("d")

    await page.getByTestId("theme-toggle").getByText("Dark").click()
    await expect(page.locator("html")).toHaveClass(/dark/)
    await page.screenshot({
      path: "test-results/settings-dark.png",
      fullPage: true,
    })

    await page.getByTestId("theme-toggle").getByText("Light").click()
    await expect(page.locator("html")).toHaveClass(/light/)
    await page.screenshot({
      path: "test-results/settings-light.png",
      fullPage: true,
    })
  })
})
