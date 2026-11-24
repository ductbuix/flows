import { expect, test } from "@playwright/test"

async function screenshotThemes(
  page: import("@playwright/test").Page,
  name: string
) {
  await page.screenshot({
    path: `test-results/${name}-light.png`,
    fullPage: true,
  })
  await page.locator("body").click({ position: { x: 0, y: 0 } })
  await page.keyboard.press("d")
  await expect(page.locator("html")).toHaveClass(/dark/)
  await page.screenshot({
    path: `test-results/${name}-dark.png`,
    fullPage: true,
  })
  await page.keyboard.press("d")
  await expect(page.locator("html")).toHaveClass(/light/)
}

test.describe("docket page (BL-177)", () => {
  test("lists cards, opens panel, creates a card", async ({ page }) => {
    await page.goto("/docket")
    await expect(page.getByTestId("docket-page")).toBeVisible()
    await expect(page.getByTestId("docket-card-fix-login")).toBeVisible()
    await expect(page.getByTestId("docket-column-doing")).toBeVisible()
    await screenshotThemes(page, "docket-page")

    await page.getByTestId("docket-card-fix-login").click()
    await expect(page.getByTestId("docket-panel")).toBeVisible()
    await expect(page.getByTestId("docket-panel")).toContainText(
      "Fix flaky login"
    )
    await page.keyboard.press("Escape")

    await page.getByTestId("docket-new-card-open").click()
    await expect(page.getByTestId("docket-new-card")).toBeVisible()
    await page.getByTestId("docket-new-card-title").fill("Ship docket sdk")
    await page.getByTestId("docket-new-card-submit").click()
    await expect(page.getByTestId("docket-panel")).toBeVisible()
    await expect(page.getByTestId("docket-card-ship-docket-sdk")).toBeVisible()
  })
})
