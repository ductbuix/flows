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

test.describe("library page (BL-182)", () => {
  test("lists providers and saves a custom one", async ({ page }) => {
    await page.goto("/library")
    await expect(page.getByTestId("mock-library-page")).toBeVisible()
    await expect(page.getByTestId("library-empty")).toBeVisible()
    await screenshotThemes(page, "library-page")

    await page.getByTestId("library-providers-open").click()
    await expect(page.getByTestId("providers-dialog")).toBeVisible()
    await expect(page.getByTestId("provider-github")).toBeVisible()
    await expect(page.getByTestId("provider-confluence")).toBeVisible()
    await expect(page.getByTestId("provider-rally")).toBeVisible()

    await page.getByTestId("provider-add-open").click()
    await expect(page.getByTestId("provider-form")).toBeVisible()
    await page.locator("#pv-name").fill("Grafana")
    await page.locator("#pv-pattern").fill("grafana[^/]*/d/(?<id>[^/]+)")
    await page.locator("#pv-files").fill("dashboard.json")
    await page.locator("#pv-fetch").fill("Grafana API")
    await page.getByTestId("provider-add-submit").click()
    await expect(page.getByTestId("provider-grafana")).toBeVisible()
    await expect(page.getByTestId("library-kind-grafana")).toBeVisible()
  })
})
