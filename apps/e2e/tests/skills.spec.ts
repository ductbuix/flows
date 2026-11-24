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

test.describe("skills page (BL-183)", () => {
  test("lists skills, opens a sheet, and uninstalls", async ({ page }) => {
    await page.goto("/skills")
    await expect(page.getByTestId("mock-skills-page")).toBeVisible()
    await expect(
      page.getByTestId("skill-row-workspace-write-tests")
    ).toBeVisible()
    await expect(
      page.getByTestId("skill-row-workspace-commit-style")
    ).toBeVisible()
    await screenshotThemes(page, "skills-page")

    await page.getByTestId("skill-row-workspace-write-tests").click()
    await expect(page.getByTestId("skill-sheet")).toBeVisible()
    await expect(page.getByTestId("skill-body")).toContainText("write-tests")
    await page.getByTestId("skill-uninstall").click()
    await expect(
      page.getByTestId("skill-row-workspace-write-tests")
    ).toHaveCount(0)
    await expect(
      page.getByTestId("skill-row-workspace-commit-style")
    ).toBeVisible()
  })
})
