import { expect, test } from "@playwright/test"

const API = process.env.PW_API_BASE ?? "http://127.0.0.1:8787"

async function revokeAlwaysTrust(
  request: import("@playwright/test").APIRequestContext
) {
  await request.put(`${API}/api/trust`, { data: { grant: "none" } })
}

test.describe("agent CLI trust dialog", () => {
  test.beforeEach(async ({ request }) => {
    await revokeAlwaysTrust(request)
  })

  test("trust once starts a run", async ({ page }) => {
    await page.goto("/workflows/agent-trust/runs")
    await page.getByTestId("run-start").first().click()
    const dialog = page.getByTestId("trust-dialog")
    await expect(dialog).toBeVisible()
    await page.screenshot({
      path: "test-results/trust-once-dialog.png",
      fullPage: true,
    })
    await page.getByTestId("trust-once").click()
    await expect(dialog).toBeHidden()
    await expect(page).toHaveURL(/\/workflows\/agent-trust\/runs\/[^/]+$/)
  })

  test("cancel leaves the run list unchanged", async ({ page }) => {
    await page.goto("/workflows/agent-trust/runs")
    const before = await page.getByTestId("run-list").textContent()
    await page.getByTestId("run-start").first().click()
    await expect(page.getByTestId("trust-dialog")).toBeVisible()
    await page.getByTestId("trust-cancel").click()
    await expect(page.getByTestId("trust-dialog")).toBeHidden()
    await expect(page).toHaveURL(/\/workflows\/agent-trust\/runs$/)
    const after = await page.getByTestId("run-list").textContent()
    expect(after).toBe(before)
  })

  test("always trust then revoke from home", async ({ page }) => {
    await page.goto("/workflows/agent-trust/runs")
    await page.getByTestId("run-start").first().click()
    await expect(page.getByTestId("trust-dialog")).toBeVisible()
    await page.getByTestId("trust-always").click()
    await expect(page).toHaveURL(/\/workflows\/agent-trust\/runs\/[^/]+$/)

    await page.goto("/")
    await expect(page.getByTestId("trust-settings")).toBeVisible()
    await page.screenshot({
      path: "test-results/trust-revoke-home.png",
      fullPage: true,
    })
    await page.getByTestId("trust-revoke").click()
    await expect(page.getByTestId("trust-settings")).toBeHidden()

    await page.goto("/workflows/agent-trust/runs")
    await page.getByTestId("run-start").first().click()
    await expect(page.getByTestId("trust-dialog")).toBeVisible()
    await page.getByTestId("trust-cancel").click()
  })

  test("warning-only dialog when already trusted", async ({
    page,
    request,
  }) => {
    const put = await request.put(`${API}/api/trust`, {
      data: { grant: "always" },
    })
    expect(put.ok()).toBeTruthy()

    await page.goto("/workflows/agent-trust/runs")
    await page.getByTestId("run-start").first().click()
    const dialog = page.getByTestId("trust-dialog")
    // Always-trust + missing/warn checks → Run, not Trust once/always.
    // If every check passes, the dialog is skipped and we land on a run.
    const appeared = await dialog
      .waitFor({ state: "visible", timeout: 3000 })
      .then(() => true)
      .catch(() => false)
    if (appeared) {
      await expect(page.getByTestId("trust-run")).toBeVisible()
      await expect(page.getByTestId("trust-once")).toHaveCount(0)
      await page.screenshot({
        path: "test-results/trust-warning-only.png",
        fullPage: true,
      })
      await page.getByTestId("trust-run").click()
    }
    await expect(page).toHaveURL(/\/workflows\/agent-trust\/runs\/[^/]+$/)
  })
})
