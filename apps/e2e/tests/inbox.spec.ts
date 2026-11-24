import { expect, test } from "@playwright/test"
import { startRun } from "./helpers"

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

test.describe("inbox page (BL-178)", () => {
  test("lists a waiting item and approve clears it", async ({ page }) => {
    const runId = await startRun("node-approval-home")
    await page.goto("/inbox")
    await expect(page.getByTestId("mock-inbox-page")).toBeVisible()
    const item = page.getByTestId(`inbox-item-approval:${runId}:gate:1`)
    await expect(item).toBeVisible({ timeout: 20_000 })
    await expect(item).toContainText("Ship the change?")
    await screenshotThemes(page, "inbox-page")

    await page.getByTestId(`inbox-approve-approval:${runId}:gate:1`).click()
    // Shared FLOWAPP_HOME may still hold sign-in items from connector checks.
    await expect(item).toHaveCount(0, { timeout: 15_000 })
  })
})
