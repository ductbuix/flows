import { expect, test } from "@playwright/test"

const API = process.env.PW_API_BASE ?? "http://127.0.0.1:8787"

test.describe("sidebar polish", () => {
  test("loading skeletons then list", async ({ page }) => {
    await page.route("**/api/workflows", async (route) => {
      const url = new URL(route.request().url())
      if (
        url.pathname === "/api/workflows" &&
        route.request().method() === "GET"
      ) {
        await new Promise((r) => setTimeout(r, 1500))
      }
      await route.continue()
    })

    await page.goto("/")
    await expect(page.getByTestId("sidebar-workflow-loading")).toBeVisible()
    await expect(page.getByTestId("sidebar-settings")).toBeVisible()
    await page.screenshot({
      path: "test-results/sidebar-loading-light.png",
      fullPage: true,
    })
    await expect(page.getByTestId("sidebar-workflow-list")).toBeVisible({
      timeout: 10_000,
    })
  })

  test("empty workflow list in sidebar", async ({ page }) => {
    await page.route("**/api/workflows", async (route) => {
      const url = new URL(route.request().url())
      if (
        url.pathname === "/api/workflows" &&
        route.request().method() === "GET"
      ) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "[]",
        })
        return
      }
      await route.continue()
    })

    await page.goto("/")
    await expect(page.getByTestId("sidebar-workflows-empty")).toBeVisible()
    await expect(page.getByTestId("sidebar-settings")).toBeVisible()
    await page.screenshot({
      path: "test-results/sidebar-empty-light.png",
      fullPage: true,
    })

    await page.goto("/settings")
    await page.getByTestId("theme-toggle").getByText("Dark").click()
    await page.goto("/")
    await expect(page.getByTestId("sidebar-workflows-empty")).toBeVisible()
    await page.screenshot({
      path: "test-results/sidebar-empty-dark.png",
      fullPage: true,
    })
  })

  test("long list scrolls inside SidebarContent; Settings stays", async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000)
    const prefix = `long-${crypto.randomUUID().slice(0, 6)}`
    const ids: string[] = []
    for (let i = 0; i < 40; i++) {
      const id = `${prefix}-${String(i).padStart(2, "0")}`
      const res = await request.post(`${API}/api/workflows`, {
        data: { id, goal: `long list ${i}` },
      })
      expect(res.ok()).toBeTruthy()
      ids.push(id)
    }

    await page.goto("/")
    await expect(page.getByTestId("sidebar-workflow-list")).toBeVisible()
    const first = page.getByTestId(`sidebar-workflow-${ids[0]}`)
    const last = page.getByTestId(`sidebar-workflow-${ids[ids.length - 1]}`)
    await expect(first).toBeVisible()
    await expect(page.getByTestId("sidebar-settings")).toBeInViewport()

    await last.scrollIntoViewIfNeeded()
    await expect(last).toBeInViewport()
    await expect(page.getByTestId("sidebar-settings")).toBeInViewport()
    await expect(first).not.toBeInViewport()

    await page.screenshot({
      path: "test-results/sidebar-long-list-light.png",
      fullPage: true,
    })

    await page.goto("/settings")
    await page.getByTestId("theme-toggle").getByText("Dark").click()
    await page.goto("/")
    await last.scrollIntoViewIfNeeded()
    await expect(page.getByTestId("sidebar-settings")).toBeInViewport()
    await page.screenshot({
      path: "test-results/sidebar-long-list-dark.png",
      fullPage: true,
    })
  })
})
