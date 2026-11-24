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

test.describe("library page", () => {
  test("providers", async ({ page }) => {
    await page.goto("/library")
    await expect(page.getByTestId("mock-library-page")).toBeVisible()
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

  test("list", async ({ page }) => {
    await page.goto("/library")
    await expect(page.getByTestId("mock-library-page")).toBeVisible()
    await expect(page.getByTestId("library-row-github-acme-demo")).toBeVisible()
    await expect(page.getByTestId("library-row-local-notes")).toBeVisible()
    await page.getByTestId("library-view-gallery").click()
    await expect(
      page.getByTestId("library-tile-github-acme-demo")
    ).toBeVisible()
    await screenshotThemes(page, "library-list")
  })

  test("sheet", async ({ page }) => {
    await page.goto("/library")
    await page.getByTestId("library-row-github-acme-demo").click()
    await expect(page.getByTestId("library-sheet")).toBeVisible()
    await expect(page.getByTestId("library-remote")).toBeVisible()
    await expect(page.getByTestId("library-files")).toBeVisible()
    await page.getByTestId("library-tab-versions").click()
    await expect(page.getByTestId("library-versions")).toBeVisible()
    await expect(page.getByTestId("library-version-1")).toBeVisible()
    await expect(page.getByTestId("library-version-2")).toBeVisible()
    await screenshotThemes(page, "library-sheet")
  })

  test("pin", async ({ page }) => {
    await page.goto("/library")
    await page.getByTestId("library-row-github-acme-demo").click()
    await page.getByTestId("library-tab-versions").click()
    await expect(page.getByTestId("library-version-2")).toContainText("Current")
    await page.getByTestId("library-pin-1").click()
    await expect(page.getByTestId("library-version-1")).toContainText("Current")
    await expect(page.getByTestId("library-pin-2")).toBeVisible()
  })

  test("remote", async ({ page }) => {
    await page.goto("/library")
    await page.getByTestId("library-row-github-acme-demo").click()
    await expect(page.getByTestId("library-fetch")).toBeVisible()
    await page.getByTestId("library-tab-versions").click()
    const before = await page
      .getByTestId("library-versions")
      .locator("[data-testid^=library-version-]")
      .count()
    await page.getByTestId("library-fetch").click()
    await expect(page.getByTestId("library-fetch")).toHaveText("Fetch", {
      timeout: 15_000,
    })
    await expect(
      page
        .getByTestId("library-versions")
        .locator("[data-testid^=library-version-]")
    ).toHaveCount(before + 1, { timeout: 15_000 })
  })

  test("remove", async ({ page }) => {
    await page.goto("/library")
    await page.getByTestId("library-row-local-notes").click()
    await expect(page.getByTestId("library-sheet")).toBeVisible()
    await page.getByTestId("library-menu").click()
    await page.getByTestId("library-remove").click()
    await expect(page.getByTestId("confirm-dialog")).toBeVisible()
    await page.getByTestId("confirm-ok").click()
    await expect(page.getByTestId("library-row-local-notes")).toHaveCount(0)
    await expect(page.getByTestId("library-row-github-acme-demo")).toBeVisible()
  })
})
