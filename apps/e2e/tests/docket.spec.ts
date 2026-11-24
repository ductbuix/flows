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

async function openFixLogin(page: import("@playwright/test").Page) {
  await page.goto("/docket")
  await expect(page.getByTestId("docket-page")).toBeVisible()
  await page.getByTestId("docket-card-fix-login").click()
  await expect(page.getByTestId("docket-panel")).toBeVisible()
}

test.describe("docket page (BL-177)", () => {
  test("lists cards, opens panel, creates a card", async ({ page }) => {
    await page.goto("/docket")
    await expect(page.getByTestId("docket-page")).toBeVisible()
    await expect(page.getByTestId("docket-card-fix-login")).toBeVisible()
    await expect(page.getByTestId("docket-column-doing")).toBeVisible()
    await screenshotThemes(page, "docket-page")

    await page.getByTestId("docket-card-fix-login").click()
    await expect(page.getByTestId("docket-panel")).toBeVisible()
    await expect(page.getByTestId("docket-panel")).toContainText(
      "Fix flaky login"
    )
    await page.keyboard.press("Escape")

    await page.getByTestId("docket-new-card-open").click()
    await expect(page.getByTestId("docket-new-card")).toBeVisible()
    await page.getByTestId("docket-new-card-title").fill("Ship docket sdk")
    await page.getByTestId("docket-new-card-submit").click()
    await expect(page.getByTestId("docket-panel")).toBeVisible()
    await expect(page.getByTestId("docket-card-ship-docket-sdk")).toBeVisible()
  })
})

test.describe("docket card panel sections (BL-198)", () => {
  test("add ref", async ({ page }) => {
    await openFixLogin(page)
    const panel = page.getByTestId("docket-panel")
    await panel.getByRole("button", { name: "Add ref" }).click()
    await panel
      .getByTestId("docket-ref-url")
      .fill("https://github.com/costory/flows/issues/198")
    await panel.getByTestId("docket-ref-add").click()
    await expect(panel.getByText("github", { exact: true })).toBeVisible()
    await expect(
      panel.getByRole("link", {
        name: "github.com/costory/flows/issues/198",
      })
    ).toBeVisible()
    await panel
      .getByRole("button", {
        name: "Remove ref github.com/costory/flows/issues/198",
      })
      .click()
    await expect(panel.getByText("No refs yet")).toBeVisible()
  })

  test("properties", async ({ page }) => {
    await openFixLogin(page)
    const panel = page.getByTestId("docket-panel")

    await panel.getByTestId("docket-prop-status").click()
    await page.getByRole("option", { name: "Review" }).click()
    await expect(page.getByTestId("docket-card-fix-login")).toBeVisible()
    await expect(page.getByTestId("docket-column-review")).toContainText(
      "Fix flaky login"
    )

    await panel.getByLabel("Edit start date").click()
    await panel.getByLabel("start date").fill("2026-11-21")
    await panel.getByLabel("start date").press("Enter")
    await expect(panel.getByLabel("Edit start date")).toContainText(
      "Nov 21, 2026"
    )

    await panel.getByRole("button", { name: "Add property" }).click()
    await panel.getByTestId("docket-prop-name").fill("assignee")
    await panel.getByTestId("docket-prop-value").fill("dbx")
    await panel.getByTestId("docket-prop-add").click()
    await expect(panel.getByLabel("Edit assignee")).toContainText("dbx")
    await panel.getByLabel("Edit assignee").click()
    await panel.getByRole("textbox", { name: "assignee" }).fill("flows")
    await panel.getByRole("textbox", { name: "assignee" }).press("Enter")
    await expect(panel.getByLabel("Edit assignee")).toContainText("flows")
    await panel
      .getByRole("button", { name: "Remove property assignee" })
      .click()
    await expect(panel.getByLabel("Edit assignee")).toHaveCount(0)
  })

  test("add link", async ({ page }) => {
    await openFixLogin(page)
    const panel = page.getByTestId("docket-panel")
    await panel.getByRole("button", { name: "Add link" }).click()
    await panel.getByTestId("docket-link-rel").click()
    await page.getByRole("option", { name: "blocks" }).click()
    await panel.getByTestId("docket-link-target").click()
    await page.getByRole("option", { name: "Refactor auth session" }).click()
    await panel.getByTestId("docket-link-add").click()
    await expect(panel.getByText("blocks")).toBeVisible()
    await expect(panel.getByText("Refactor auth session")).toBeVisible()
    await panel
      .getByRole("button", { name: "Remove link to Refactor auth session" })
      .click()
    await expect(panel.getByText("No links yet")).toBeVisible()
  })
})
