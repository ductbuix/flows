import { expect, test, type Page } from "@playwright/test"
import { startRun } from "./helpers"

test.use({ viewport: { width: 1440, height: 900 } })

async function rowHeights(page: Page, selector: string): Promise<number[]> {
  return page.locator(selector).evaluateAll((rows) =>
    rows.map((row) => Math.round(row.getBoundingClientRect().height))
  )
}

async function expectTableSizes(page: Page) {
  const body = await rowHeights(page, "tbody tr")
  const head = await rowHeights(page, "thead tr")
  expect(body.length).toBeGreaterThan(0)
  expect(new Set(body)).toEqual(new Set([37]))
  expect(new Set(head)).toEqual(new Set([41]))
}

async function themes(page: Page, name: string) {
  await page.screenshot({ path: `test-results/${name}-light.png` })
  await page.locator("body").click({ position: { x: 0, y: 0 } })
  await page.keyboard.press("d")
  await expect(page.locator("html")).toHaveClass(/dark/)
  await page.screenshot({ path: `test-results/${name}-dark.png` })
  await page.keyboard.press("d")
  await expect(page.locator("html")).toHaveClass(/light/)
}

async function width(page: Page, testId: string): Promise<number> {
  // offsetWidth ignores the open zoom animation's transform.
  return page.getByTestId(testId).evaluate((el) => (el as HTMLElement).offsetWidth)
}

test.describe("control sizes, tables, dialogs (BL-058)", () => {
  test("list tables use 41px header and 37px body rows", async ({
    page,
    request,
  }) => {
    await startRun(request, "diamond")
    const created = await request.post(
      `${process.env.PW_API_BASE}/api/workitems`,
      { data: { title: "Sizes check", workflowId: "diamond" } }
    )
    expect(created.ok()).toBeTruthy()
    for (const [path, id] of [
      ["/workflows", "workflows-table"],
      ["/runs", "runs-table"],
      ["/work-items", "work-items-table"],
    ] as const) {
      await page.goto(path)
      await expect(page.getByTestId(id)).toBeVisible()
      await expectTableSizes(page)
      await themes(page, `sizes-${id}`)
    }
  })

  test("dialog widths follow confirm, form and editor kinds", async ({
    page,
  }) => {
    await page.goto("/")
    await page.getByTestId("workflow-create-open").click()
    await expect(page.getByTestId("workflow-create")).toBeVisible()
    expect(await width(page, "workflow-create")).toBe(448)
    await themes(page, "sizes-dialog-form")
    await page.keyboard.press("Escape")

    await page.goto("/workflows/diamond")
    await page.getByTestId("sidebar-workflow-menu-diamond").click()
    await page.getByTestId("workflow-rename-open-diamond").click()
    await expect(page.getByTestId("workflow-rename")).toBeVisible()
    expect(await width(page, "workflow-rename")).toBe(448)
    await page.keyboard.press("Escape")

    await page.getByTestId("sidebar-workflow-menu-diamond").click()
    await page.getByTestId("workflow-delete-open-diamond").click()
    await expect(page.getByTestId("workflow-delete")).toBeVisible()
    expect(await width(page, "workflow-delete")).toBe(384)
    await themes(page, "sizes-dialog-confirm")
  })

  test("empty list renders a bordered Empty instead of a table", async ({
    page,
  }) => {
    await page.goto("/workflows")
    await page.getByTestId("workflows-search").fill("zzz-no-match")
    const empty = page.getByTestId("workflows-empty")
    await expect(empty).toBeVisible()
    await expect(page.getByTestId("workflows-table")).toHaveCount(0)
    await expect(empty).toHaveClass(/\bborder\b/)
    await themes(page, "sizes-empty")
  })
})
