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

async function createWorkItem(
  page: import("@playwright/test").Page,
  title: string
): Promise<string> {
  await page.getByTestId("sidebar-platform-work-items").click()
  await expect(page.getByTestId("work-items-page")).toBeVisible()
  await page.getByTestId("work-items-new").click()
  await expect(page.getByTestId("work-item-create")).toBeVisible()
  await page.getByTestId("work-item-create-title").fill(title)
  await page.getByTestId("work-item-create-submit").click()
  await expect(page.getByTestId("work-item-page")).toBeVisible()
  const url = page.url()
  const id = url.split("/work-items/")[1]
  expect(id).toBeTruthy()
  return id!
}

test.describe("start card work item (BL-041 / J3)", () => {
  test("starts one workflow for two work items; Runs groups by title", async ({
    page,
  }) => {
    const suffix = crypto.randomUUID().slice(0, 8)
    const titleA = `J3 Alpha ${suffix}`
    const titleB = `J3 Beta ${suffix}`

    await page.goto("/")
    const idA = await createWorkItem(page, titleA)
    const idB = await createWorkItem(page, titleB)

    await page.goto("/workflows/diamond")
    await page.getByTestId("run-start").click()
    await expect(page.getByTestId("start-run-form")).toBeVisible()
    await expect(page.getByTestId("start-run-work-item")).toBeVisible()

    await page.getByTestId("start-run-work-item").fill("Alpha")
    await page.getByRole("option", { name: titleA }).click()
    await page.getByTestId("start-run-submit").click()
    await expect(page).toHaveURL(/\/runs\//, { timeout: 30_000 })

    await page.goto("/workflows/diamond")
    await page.getByTestId("run-start").click()
    await page.getByTestId("start-run-work-item").fill("Beta")
    await page.getByRole("option", { name: titleB }).click()
    await page.getByTestId("start-run-submit").click()
    await expect(page).toHaveURL(/\/runs\//, { timeout: 30_000 })

    await page.getByTestId("sidebar-platform-runs").click()
    await expect(page.getByTestId("runs-page")).toBeVisible()
    await expect(page.getByTestId(`runs-group-${idA}`)).toContainText(titleA)
    await expect(page.getByTestId(`runs-group-${idB}`)).toContainText(titleB)
    await screenshotThemes(page, "runs-grouped-by-work-item")
  })
})
