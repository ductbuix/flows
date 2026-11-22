import { expect, test } from "@playwright/test"

test.describe("dev kit", () => {
  test("screenshots shared patterns in light and dark", async ({ page }) => {
    await page.goto("/dev/kit")
    await expect(page.getByTestId("dev-kit")).toBeVisible()
    await expect(page.getByTestId("kit-status-succeeded")).toBeVisible()
    await expect(page.getByTestId("kit-impact-read")).toBeVisible()
    await expect(page.getByTestId("kit-freshness-fresh")).toBeVisible()
    await expect(page.getByTestId("kit-confirmation")).toBeVisible()
    await expect(page.getByTestId("kit-plan")).toBeVisible()
    for (const id of [
      "kit-parts",
      "kit-checkbox",
      "kit-combobox",
      "kit-accordion",
      "kit-file-tree",
      "kit-prompt-input",
      "kit-stack-trace",
      "kit-terminal",
      "kit-env",
    ]) {
      await expect(page.getByTestId(id)).toBeVisible()
    }

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
