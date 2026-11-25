import { expect, test } from "@playwright/test"
import { fcpRequest } from "./helpers"

async function openSettings(page: import("@playwright/test").Page) {
  await page.goto("/docket")
  await expect(page.getByTestId("app-sidebar")).toBeVisible({ timeout: 30_000 })
  await page.getByTestId("settings-open").click()
  await expect(page.getByTestId("settings-panel")).toBeVisible()
}

test.describe("sidebar settings panel (BL-210)", () => {
  test("panel", async ({ page }) => {
    await openSettings(page)
    await expect(page.getByTestId("settings-panel")).toBeVisible()
    await expect(page).not.toHaveURL(/\/settings/)
  })

  test("theme", async ({ page }) => {
    await openSettings(page)
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
  })

  test("text size", async ({ page }) => {
    const rootSize = () =>
      page.evaluate(() => document.documentElement.style.fontSize)
    await openSettings(page)
    await page.getByTestId("text-size-large").click()
    await expect.poll(rootSize).toBe("112.5%")

    await page.reload()
    await expect.poll(rootSize).toBe("112.5%")
    await openSettings(page)
    await expect(page.getByTestId("text-size-large")).toHaveAttribute(
      "aria-pressed",
      "true"
    )

    await page.getByTestId("text-size-default").click()
    await expect.poll(rootSize).toBe("100%")
  })

  test("cli trust", async ({ page }) => {
    await openSettings(page)
    await expect(page.getByTestId("cli-status-list")).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByTestId("cli-claude")).toBeVisible()
    await expect(page.getByTestId("cli-cursor")).toBeVisible()
  })

  test("always trust", async ({ page }) => {
    await openSettings(page)
    await expect(page.getByTestId("trust-settings")).toBeVisible({
      timeout: 30_000,
    })
    await page.getByTestId("trust-always").click()
    await expect(page.getByTestId("trust-revoke")).toBeVisible()
    await page.getByTestId("trust-revoke").click()
    await expect(page.getByTestId("trust-always")).toBeVisible()
  })

  test("mcp trust", async ({ page }) => {
    await fcpRequest("settings/set_mcp_trust", {
      key: "npx e2e-mcp",
      grant: "always",
    })
    await openSettings(page)
    await expect(page.getByTestId("mcp-trust-list")).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByTestId("mcp-trust-row")).toContainText("npx e2e-mcp")
    await page.getByTestId("mcp-trust-revoke").click()
    await expect(page.getByTestId("mcp-trust-empty")).toBeVisible()
  })

  test("no route", async ({ page }) => {
    await page.goto("/settings")
    await expect(page.getByTestId("app-sidebar")).toHaveCount(0)
    await expect(page.getByTestId("docket-page")).toHaveCount(0)
    await expect(page.getByTestId("settings-page")).toHaveCount(0)
    await expect(page.getByTestId("settings-panel")).toHaveCount(0)
  })
})
