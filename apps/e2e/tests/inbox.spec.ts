import { expect, test } from "@playwright/test"

const API = process.env.PW_API_BASE ?? "http://127.0.0.1:8787"

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

async function startRun(
  request: import("@playwright/test").APIRequestContext,
  workflow: string
): Promise<string> {
  const res = await request.post(`${API}/api/workflows/${workflow}/runs`, {
    data: { requestId: crypto.randomUUID() },
  })
  expect(res.ok()).toBeTruthy()
  return ((await res.json()) as { runId: string }).runId
}

test.describe("inbox page (BL-178)", () => {
  test("lists a waiting item and approve clears it", async ({
    page,
    request,
  }) => {
    const runId = await startRun(request, "node-approval-home")
    await page.goto("/mock/inbox")
    await expect(page.getByTestId("mock-inbox-page")).toBeVisible()
    const item = page.getByTestId(`inbox-item-approval:${runId}:gate:1`)
    await expect(item).toBeVisible({ timeout: 20_000 })
    await expect(item).toContainText("Ship the change?")
    await screenshotThemes(page, "inbox-page")

    await page.getByTestId(`inbox-approve-approval:${runId}:gate:1`).click()
    await expect(item).toHaveCount(0, { timeout: 15_000 })
    await expect(page.getByTestId("inbox-empty")).toBeVisible()
  })
})
