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
  // Theme "d" is ignored while an input is focused.
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

test.describe("platform Workflows and Runs pages (BL-034)", () => {
  test("sidebar Platform group and Workflows page", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByTestId("sidebar-platform")).toBeVisible()
    await expect(page.getByTestId("sidebar-home")).toBeVisible()
    await expect(page.getByTestId("sidebar-platform-workflows")).toBeVisible()
    await expect(page.getByTestId("sidebar-platform-runs")).toBeVisible()
    await expect(page.getByTestId("sidebar-platform-connections")).toBeVisible()
    await expect(page.getByTestId("sidebar-settings")).toBeVisible()

    await page.getByTestId("sidebar-platform-workflows").click()
    await expect(page).toHaveURL(/\/workflows$/)
    await expect(page.getByTestId("workflows-page")).toBeVisible()
    await expect(page.getByTestId("workflows-search")).toBeVisible()
    await expect(page.getByTestId("workflows-table")).toBeVisible()
    await expect(page.getByTestId("workflows-row-diamond")).toBeVisible()
    await screenshotThemes(page, "workflows-page")

    await page.getByTestId("workflows-row-diamond").click()
    await expect(page).toHaveURL(/\/workflows\/diamond/)
  })

  test("Workflows empty search and Runs empty then populated", async ({
    page,
    request,
  }) => {
    const emptyWf = `plat-empty-${crypto.randomUUID().slice(0, 8)}`
    const create = await request.post(
      `${process.env.PW_API_BASE ?? "http://127.0.0.1:8787"}/api/workflows`,
      { data: { id: emptyWf, goal: "platform empty runs" } }
    )
    expect(create.ok()).toBeTruthy()

    await page.goto("/workflows")
    await expect(page.getByTestId("workflows-search")).toBeVisible()
    await page.getByTestId("workflows-search").fill("zzz-no-match")
    await expect(page.getByTestId("workflows-empty")).toBeVisible()
    await screenshotThemes(page, "workflows-empty")

    await page.getByTestId("sidebar-platform-runs").click()
    await expect(page).toHaveURL(/\/runs$/)
    await expect(page.getByTestId("runs-page")).toBeVisible()
    await expect(page.getByTestId("runs-filter-status")).toBeVisible()
    await expect(page.getByTestId("runs-filter-workflow")).toBeVisible()

    await page.getByTestId("runs-filter-workflow").click()
    await page.getByRole("option", { name: emptyWf }).click()
    await expect(page.getByTestId("runs-empty")).toBeVisible()
    await screenshotThemes(page, "runs-empty")

    await page.getByTestId("runs-filter-workflow").click()
    await page.getByRole("option", { name: "All workflows" }).click()

    const runId = await startRun(request, "diamond")
    await expect(page.getByTestId(`runs-row-${runId}`)).toBeVisible({
      timeout: 30_000,
    })
    // Diamond runs always get an itemKey; group header is still present.
    await expect(
      page.locator('[data-testid^="runs-group-"]').first()
    ).toBeVisible()
    await screenshotThemes(page, "runs-page")

    await page.getByTestId(`runs-row-${runId}`).click()
    await expect(page).toHaveURL(new RegExp(`/runs/${runId}$`))
  })
})
