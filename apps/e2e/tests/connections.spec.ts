import { expect, test, type Page } from "@playwright/test"

const API = process.env.PW_API_BASE ?? "http://127.0.0.1:8787"

async function screenshotThemes(page: Page, name: string) {
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

test.describe("connections and library (BL-045 / J7)", () => {
  test("add fake connection, check sign-in, library tab, needs you", async ({
    page,
    request,
  }) => {
    test.setTimeout(60_000)
    const id = `fake-demo-${crypto.randomUUID().slice(0, 8)}`

    await page.goto("/")
    await expect(page.getByTestId("sidebar-platform-connections")).toBeVisible()
    await page.getByTestId("sidebar-platform-connections").click()
    await expect(page).toHaveURL(/\/connections$/)
    await expect(page.getByTestId("connections-page")).toBeVisible()
    await expect(page.getByTestId("connections-explainer")).toBeVisible()
    await expect(page.getByTestId("connections-tabs")).toBeVisible()
    await screenshotThemes(page, "connections-page")

    await page.getByTestId("connections-add").click()
    await expect(page.getByTestId("connection-create")).toBeVisible()
    await page.getByTestId("connection-create-id").fill(id)
    await page.getByTestId("connection-create-name").fill("Fake Demo")
    await page.getByTestId("connection-create-connector").click()
    await page.getByRole("option", { name: "fake" }).click()
    await page.getByTestId("connection-create-submit").click()

    await expect(page).toHaveURL(new RegExp(`/connections/${id}$`))
    await expect(page.getByTestId("connection-page")).toBeVisible()
    await expect(page.getByTestId("connection-sign-in-status")).toContainText(
      /fake sign-in ok|Signed in/,
      { timeout: 10_000 }
    )
    await expect(page.getByTestId("connection-policy")).toBeVisible()
    await expect(page.getByTestId("connection-check")).toBeVisible()
    await page.getByTestId("connection-check").click()
    await expect(page.getByTestId("connection-sign-in-status")).toContainText(
      /fake sign-in ok|Signed in/
    )
    await screenshotThemes(page, "connection-page")

    await page.getByTestId("sidebar-platform-connections").click()
    await expect(page.getByTestId(`connections-row-${id}`)).toBeVisible()
    await expect(page.getByTestId(`connection-signin-${id}`)).toContainText(
      "Signed in",
      { timeout: 10_000 }
    )

    await page.getByTestId("connections-tab-library").click()
    await expect(page).toHaveURL(/tab=library/)
    await expect(page.getByTestId("library-empty")).toBeVisible()
    await screenshotThemes(page, "library-tab")

    // Seed an expired sign-in for Home Needs you.
    const expiredId = `fake-out-${crypto.randomUUID().slice(0, 8)}`
    const create = await request.post(`${API}/api/connections`, {
      data: {
        id: expiredId,
        connector: "fake",
        name: "Expired Fake",
        scope: { signedOut: "1" },
        signIn: "cli",
        refresh: "15m",
        policy: "read-only",
      },
    })
    expect(create.ok()).toBeTruthy()

    await page.goto("/")
    await expect(
      page.getByTestId(`home-needs-you-connection-${expiredId}`)
    ).toBeVisible({ timeout: 15_000 })
    await screenshotThemes(page, "home-expired-signin")
    await page.getByTestId(`home-fix-signin-${expiredId}`).click()
    await expect(page).toHaveURL(new RegExp(`/connections/${expiredId}$`))
    await expect(page.getByTestId("connection-sign-in-status")).toContainText(
      "fake signed out",
      { timeout: 10_000 }
    )
  })
})
