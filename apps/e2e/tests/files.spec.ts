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

test.describe("files page (BL-184)", () => {
  test("lists workspace files and opens a preview", async ({ page }) => {
    await page.goto("/mock/files")
    await expect(page.getByTestId("mock-files-page")).toBeVisible()
    await expect(page.getByTestId("files-count")).not.toHaveText("0 files")
    await expect(page.getByTestId("files-tree")).toBeVisible()
    await screenshotThemes(page, "files-page")

    await page.getByTestId("files-search").fill("board.yaml")
    await expect(page.getByTestId("out-file-docket/board.yaml")).toBeVisible()
    await page.getByTestId("out-file-docket/board.yaml").click()
    await expect(page.getByTestId("files-preview")).toBeVisible()
    await expect(page.getByTestId("files-editor")).toContainText("version: 1")
  })
})
