import { expect, test } from "@playwright/test"

test.describe("dev kit", () => {
  test("screenshots shared patterns in light and dark", async ({ page }) => {
    await page.goto("/dev/kit")
    await expect(page.getByTestId("dev-kit")).toBeVisible()
    await expect(page.getByTestId("kit-status-succeeded")).toBeVisible()
    await expect(page.getByTestId("kit-confirmation")).toBeVisible()
    await expect(page.getByTestId("kit-plan")).toBeVisible()

    await page.screenshot({
      path: "test-results/dev-kit-light.png",
      fullPage: true,
    })

    await page.keyboard.press("d")
    await expect(page.locator("html")).toHaveClass(/dark/)
    await page.screenshot({
      path: "test-results/dev-kit-dark.png",
      fullPage: true,
    })
  })
})
