import { expect, test } from "@playwright/test"
import { fcpRequest } from "./helpers"

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

test.describe("connectors page (BL-207)", () => {
  test("sign in check", async ({ page }) => {
    await fcpRequest("connector/check", { id: "rally" })

    await page.goto("/connectors")
    await expect(page.getByTestId("connector-row-rally")).toBeVisible()
    await expect(
      page.getByTestId("connector-row-rally").getByTestId("connector-status")
    ).toHaveAttribute("data-tone", "attention")

    const sheet = page.getByTestId("connector-sheet")
    await page.getByTestId("connector-row-github-cli").click()
    await expect(sheet).toBeVisible()
    await expect(sheet.getByTestId("connector-action")).toHaveText(
      "Check CLI login"
    )
    await sheet.getByTestId("connector-action").click()
    await expect(sheet.getByTestId("connector-status")).toHaveAttribute(
      "data-tone",
      "done",
      { timeout: 15_000 }
    )
    await expect(sheet.getByTestId("connector-action")).toHaveText("Test")
  })

  test("disconnect", async ({ page }) => {
    await fcpRequest("connector/check", { id: "github-cli" })

    await page.goto("/connectors")
    const sheet = page.getByTestId("connector-sheet")
    await page.getByTestId("connector-row-github-cli").click()
    await expect(sheet.getByTestId("connector-status")).toHaveAttribute(
      "data-tone",
      "done",
      { timeout: 15_000 }
    )
    await page.getByRole("tab", { name: "Setup" }).click()
    await sheet.getByTestId("connector-disconnect").click()
    await expect(sheet.getByTestId("connector-status")).toHaveAttribute(
      "data-tone",
      "idle"
    )
  })

  test("used by", async ({ page }) => {
    await page.goto("/connectors")
    await page.getByTestId("connector-row-github-cli").click()
    await page.getByTestId("connector-tab-used").click()
    await expect(page.getByTestId("connector-used-by")).toBeVisible()
    await expect(page.getByTestId("connector-used-library")).toContainText(
      "1 linked item"
    )
  })

  test("update", async ({ page }) => {
    await page.goto("/connectors")
    await page.getByTestId("connector-row-rally").click()
    await page.getByRole("tab", { name: "Setup" }).click()
    await page
      .getByTestId("connector-edit-how")
      .fill("https://rally.example/v2")
    await page.getByTestId("connector-save").click()
    await page.getByRole("button", { name: "Close" }).click()
    await expect(page.getByTestId("connector-sheet")).toHaveCount(0)

    await page.getByTestId("connector-row-rally").click()
    await page.getByRole("tab", { name: "Setup" }).click()
    await expect(page.getByTestId("connector-edit-how")).toHaveValue(
      "https://rally.example/v2"
    )
  })
})

test.describe("connectors page (BL-181)", () => {
  test("lists connectors, opens sheet, removes one, adds one", async ({
    page,
  }) => {
    await page.goto("/connectors")
    await expect(page.getByTestId("connectors-page")).toBeVisible()
    await expect(page.getByTestId("connector-row-github-cli")).toBeVisible()
    await expect(page.getByTestId("connector-row-rally")).toBeVisible()
    await screenshotThemes(page, "connectors-page")

    await page.getByTestId("connector-add-open").click()
    await expect(page.getByTestId("connector-add")).toBeVisible()
    await page.getByTestId("connector-add-name").fill("Wiki")
    await page.getByTestId("connector-add-how").fill("https://wiki.example/api")
    await page.getByTestId("connector-add-submit").click()
    await expect(page.getByTestId("connector-row-wiki")).toBeVisible()
    await expect(page.getByTestId("connector-sheet")).toBeVisible()
    await expect(page.getByTestId("capability-read")).toBeVisible()
    await page.getByRole("tab", { name: "Setup" }).click()
    await page.getByTestId("connector-remove").click()
    await page.getByTestId("confirm-ok").click()
    await expect(page.getByTestId("connector-row-wiki")).toHaveCount(0)
    await expect(page.getByTestId("connector-row-github-cli")).toBeVisible()
  })
})
