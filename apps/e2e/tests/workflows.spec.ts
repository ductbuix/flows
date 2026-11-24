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

test.describe("workflows page (BL-179)", () => {
  test("lists workflows, opens editor, creates one", async ({ page }) => {
    await page.goto("/mock/workflows")
    await expect(page.getByTestId("mock-workflows-page")).toBeVisible()
    // Loaded state (loading skeleton shares the page test id).
    await expect(page.getByTestId("workflows-new-open")).toBeVisible()
    await expect(page.getByTestId("mock-workflow-diamond")).toBeVisible()
    await screenshotThemes(page, "workflows-page")

    await page.getByTestId("mock-workflow-diamond").click()
    await expect(page.getByTestId("workflow-sheet")).toBeVisible()
    await page.getByTestId("workflow-open-editor").click()
    await expect(page.getByTestId("mock-workflow-editor")).toBeVisible()
    await expect(page.getByTestId("workflow-editor-yaml")).toContainText(
      "id: diamond"
    )
    await screenshotThemes(page, "workflow-editor")

    await page.goto("/mock/workflows")
    await page.getByTestId("workflows-new-open").click()
    await expect(page.getByTestId("workflows-new")).toBeVisible()
    await page.getByTestId("workflows-new-name").fill("Ship workflows sdk")
    await page.getByTestId("workflows-new-submit").click()
    await expect(page.getByTestId("mock-workflow-editor")).toBeVisible()
    await expect(page.getByTestId("workflow-editor-yaml")).toContainText(
      "ship-workflows-sdk"
    )
  })
})
