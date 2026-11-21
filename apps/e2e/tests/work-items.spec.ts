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

test.describe("work items pages (BL-040 / J2)", () => {
  test("create, start a run, see it listed, edit notes", async ({ page }) => {
    const title = `WI ${crypto.randomUUID().slice(0, 8)}`

    await page.goto("/")
    await expect(page.getByTestId("sidebar-platform-work-items")).toBeVisible()
    await page.getByTestId("sidebar-platform-work-items").click()
    await expect(page).toHaveURL(/\/work-items$/)
    await expect(page.getByTestId("work-items-page")).toBeVisible()
    await screenshotThemes(page, "work-items-page")

    await page.getByTestId("work-items-new").click()
    await expect(page.getByTestId("work-item-create")).toBeVisible()
    await page.getByTestId("work-item-create-title").fill(title)
    await page.getByTestId("work-item-create-workflow").click()
    await page.getByRole("option", { name: "diamond" }).click()
    await page.getByTestId("work-item-create-notes").fill("Initial notes")
    await page.getByTestId("work-item-create-submit").click()

    await expect(page.getByTestId("work-item-page")).toBeVisible()
    await expect(page.getByTestId("work-item-source")).toHaveText("Ad hoc")
    await expect(page.getByTestId("work-item-context-empty")).toBeVisible()
    await expect(page.getByTestId("work-item-start-workflow")).toContainText(
      "diamond"
    )
    await expect(page.getByTestId("work-item-notes")).toHaveValue(
      "Initial notes"
    )
    await screenshotThemes(page, "work-item-page")

    await page.getByTestId("start-run-submit").click()
    const runRow = page.locator('[data-testid^="work-item-run-"]').first()
    await expect(runRow).toBeVisible({ timeout: 30_000 })
    const runTestId = await runRow.getAttribute("data-testid")
    expect(runTestId).toMatch(/^work-item-run-/)
    await screenshotThemes(page, "work-item-with-run")

    await page.getByTestId("work-item-notes").fill("Updated notes for J2")
    await page.getByTestId("work-item-notes-save").click()
    await expect(page.getByTestId("work-item-notes")).toHaveValue(
      "Updated notes for J2"
    )
    await expect(page.getByTestId("work-item-notes-save")).toBeDisabled()

    await page.getByTestId("sidebar-platform-work-items").click()
    await expect(page.getByTestId("work-items-table")).toBeVisible()
    await expect(page.getByText(title)).toBeVisible()
  })
})
