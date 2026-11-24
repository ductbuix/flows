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

test.describe("skills page", () => {
  test("installed", async ({ page }) => {
    await page.goto("/skills")
    await expect(page.getByTestId("skills-page")).toBeVisible()
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
    await page.keyboard.press("Escape")
  })

  test("tabs", async ({ page }) => {
    await page.goto("/skills")
    await expect(page.getByTestId("skills-tab-available")).toContainText(
      "Available (2)"
    )
    await expect(page.getByTestId("skills-tab-sources")).toContainText(
      "Sources (1)"
    )
    await page.getByTestId("skills-tab-available").click()
    await expect(page.getByTestId("skills-available")).toBeVisible()
    await page.getByTestId("skills-tab-sources").click()
    await expect(page.getByTestId("skill-sources")).toBeVisible()
    await expect(
      page.getByTestId("skill-source-repo-team-skills")
    ).toBeVisible()
  })

  test("used by", async ({ page }) => {
    await page.goto("/skills")
    await page.getByTestId("skill-row-workspace-write-tests").click()
    await expect(page.getByTestId("skill-used-by")).toBeVisible()
    await expect(
      page.getByTestId("skill-used-skill-uses-write-tests-draft")
    ).toBeVisible()
    await page.keyboard.press("Escape")
  })

  test("update", async ({ page }) => {
    await page.goto("/skills")
    await expect(
      page.getByTestId("skill-row-workspace-write-tests")
    ).toContainText("Update available")
    await page.getByTestId("skill-row-workspace-write-tests").click()
    await expect(page.getByTestId("skill-update")).toBeVisible()
    await page.getByTestId("skill-update").click()
    await expect(page.getByTestId("skill-update")).toHaveCount(0)
    await expect(page.getByTestId("skill-body")).toContainText("Cover the edge")
    await page.keyboard.press("Escape")
  })

  test("install", async ({ page }) => {
    await page.goto("/skills")
    await page.getByTestId("skills-tab-available").click()
    await expect(page.getByTestId("skill-available-review-pr")).toBeVisible()
    await page.getByTestId("skill-available-review-pr").click()
    await expect(page.getByTestId("skill-install")).toBeVisible()
    await page.getByTestId("skill-install").click()
    await expect(page.getByTestId("skill-uninstall")).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByTestId("skill-sheet")).toHaveCount(0)
    await page.getByTestId("skills-tab-installed").click()
    await expect(
      page.getByTestId("skill-row-workspace-review-pr")
    ).toBeVisible()
  })

  test("sources", async ({ page }) => {
    await page.goto("/skills")
    await page.getByTestId("skills-tab-sources").click()
    await expect(
      page.getByTestId("skill-source-repo-team-skills")
    ).toBeVisible()
    await page.getByTestId("skill-sync-repo-team-skills").click()
    await expect(page.getByTestId("skill-sync-repo-team-skills")).toHaveText(
      "Sync",
      { timeout: 15_000 }
    )

    await page.getByTestId("skill-source-remove-repo-team-skills").click()
    await expect(page.getByTestId("skill-source-repo-team-skills")).toHaveCount(
      0
    )

    await page.getByTestId("skill-source-open").click()
    await expect(page.getByTestId("skill-source-add")).toBeVisible()
    await page.getByTestId("skill-source-pick-repo-team-skills").click()
    await page.getByTestId("skill-source-submit").click()
    await expect(
      page.getByTestId("skill-source-repo-team-skills")
    ).toBeVisible()
  })

  test("uninstall", async ({ page }) => {
    await page.goto("/skills")
    await page.getByTestId("skill-row-workspace-write-tests").click()
    await page.getByTestId("skill-uninstall").click()
    await expect(
      page.getByTestId("skill-row-workspace-write-tests")
    ).toHaveCount(0)
    await expect(
      page.getByTestId("skill-row-workspace-commit-style")
    ).toBeVisible()
  })
})
