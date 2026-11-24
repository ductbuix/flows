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

test.describe("runs page (BL-180)", () => {
  test("starts a run, opens sheet, deletes it", async ({ page }) => {
    await page.goto("/runs")
    await expect(page.getByTestId("runs-page")).toBeVisible()
    await expect(page.getByTestId("runs-start-open")).toBeVisible()
    await screenshotThemes(page, "runs-page")

    await page.getByTestId("runs-start-open").click()
    await expect(page.getByTestId("runs-start-dialog")).toBeVisible()
    await page.getByTestId("runs-start-workflow").click()
    await page.getByRole("option", { name: /diamond/i }).click()
    await page.getByTestId("runs-start-submit").click()

    await expect(page.getByTestId("runs-sheet")).toBeVisible({
      timeout: 15_000,
    })
    const runId = await page
      .getByTestId("runs-sheet")
      .getAttribute("data-run-id")
    expect(runId).toBeTruthy()
    await expect(page.getByTestId(`runs-row-${runId}`)).toBeVisible({
      timeout: 15_000,
    })

    // Wait until the echo workflow finishes so delete is allowed.
    await expect(page.getByTestId("runs-rerun")).toBeVisible({
      timeout: 20_000,
    })
    await page.getByTestId("runs-menu").click()
    await page.getByTestId("runs-delete").click()
    await page
      .getByTestId("confirm-dialog")
      .getByRole("button", {
        name: "Delete run",
      })
      .click()
    await expect(page.getByTestId("runs-sheet")).toHaveCount(0)
    // Other specs share the e2e home, so the list may not be empty.
    await expect(page.getByTestId(`runs-row-${runId}`)).toHaveCount(0)
  })
})
