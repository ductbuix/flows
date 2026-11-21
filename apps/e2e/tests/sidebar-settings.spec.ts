import { expect, test } from "@playwright/test"
import { existsSync } from "node:fs"
import { join } from "node:path"

const HOME = process.env.FLOWAPP_HOME!
const API = process.env.PW_API_BASE ?? "http://127.0.0.1:8787"

test.describe("sidebar shell and settings", () => {
  test("sidebar list, create, rename and delete", async ({ page }) => {
    test.setTimeout(60_000)
    const id = `side-${crypto.randomUUID().slice(0, 8)}`
    const renamed = `${id}-renamed`

    await page.goto("/")
    await expect(page.getByTestId("app-sidebar")).toBeVisible()
    await expect(page.getByTestId("home-page")).toBeVisible()
    await expect(
      page
        .getByTestId("home-create-work-item")
        .or(page.getByTestId("home-running"))
    ).toBeVisible()
    await page.screenshot({
      path: "test-results/sidebar-home-light.png",
      fullPage: true,
    })

    await page.getByTestId("workflow-create-open").click()
    await expect(page.getByTestId("workflow-create")).toBeVisible()
    // Dialog width should exceed 24rem at desktop
    const box = await page.getByTestId("workflow-create").boundingBox()
    expect(box).toBeTruthy()
    expect(box!.width).toBeGreaterThan(384)

    await page.getByTestId("create-id-input").fill(id)
    await page.getByTestId("create-goal-input").fill("sidebar e2e")
    await page.getByTestId("create-submit").click()
    await expect(page).toHaveURL(new RegExp(`/workflows/${id}$`))
    await expect(page.getByTestId(`sidebar-workflow-${id}`)).toBeVisible()

    await page.getByTestId(`sidebar-workflow-menu-${id}`).click()
    await page.getByTestId(`workflow-rename-open-${id}`).click()
    await expect(page.getByTestId("workflow-rename")).toBeVisible()
    await page.getByTestId("rename-id-input").fill(renamed)
    await page.getByTestId("rename-submit").click()
    await expect(page).toHaveURL(new RegExp(`/workflows/${renamed}$`))
    await expect(page.getByTestId(`sidebar-workflow-${renamed}`)).toBeVisible()

    await page.getByTestId(`sidebar-workflow-menu-${renamed}`).click()
    await page.getByTestId(`workflow-delete-open-${renamed}`).click()
    await expect(page.getByTestId("workflow-delete")).toBeVisible()
    await page.getByTestId("delete-confirm-input").fill(renamed)
    await page.getByTestId("delete-submit").click()
    await expect(page).toHaveURL("/")
    expect(existsSync(join(HOME, "workflows", renamed))).toBe(false)
  })

  test("settings theme, cli info and trust revoke", async ({
    page,
    request,
  }) => {
    await request.put(`${API}/api/trust`, { data: { grant: "always" } })
    await page.goto("/settings")
    await expect(page.getByTestId("settings-page")).toBeVisible()
    await expect(page.getByTestId("cli-status-list")).toBeVisible()
    await expect(page.getByTestId("cli-claude")).toBeVisible()
    await expect(page.getByTestId("cli-cursor")).toBeVisible()
    await expect(page.getByTestId("trust-settings")).toBeVisible()
    await expect(page.getByTestId("trust-revoke")).toBeVisible()
    await expect(page.getByTestId("theme-shortcut-hint")).toContainText("d")
    await expect(
      page.getByTestId("theme-shortcut-hint").locator("kbd")
    ).toHaveText("d")

    await page.getByTestId("theme-toggle").getByText("Dark").click()
    await expect(page.locator("html")).toHaveClass(/dark/)
    await page.screenshot({
      path: "test-results/settings-dark.png",
      fullPage: true,
    })

    await page.getByTestId("theme-toggle").getByText("Light").click()
    await expect(page.locator("html")).toHaveClass(/light/)
    await page.screenshot({
      path: "test-results/settings-light.png",
      fullPage: true,
    })

    await page.getByTestId("trust-revoke").click()
    await expect(page.getByTestId("trust-revoke")).toHaveCount(0)
  })
})
