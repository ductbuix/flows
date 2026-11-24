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

test.describe("connectors page (BL-181)", () => {
  test("lists connectors, opens sheet, removes one, adds one", async ({
    page,
  }) => {
    await page.goto("/mock/connectors")
    await expect(page.getByTestId("mock-connectors-page")).toBeVisible()
    await expect(page.getByTestId("connector-row-github-cli")).toBeVisible()
    await expect(page.getByTestId("connector-row-rally")).toBeVisible()
    await screenshotThemes(page, "connectors-page")

    await page.getByTestId("connector-row-github-cli").click()
    await expect(page.getByTestId("connector-sheet")).toBeVisible()
    await expect(page.getByTestId("capability-repo clone")).toBeVisible()
    await page.getByRole("tab", { name: "Setup" }).click()
    await page.getByTestId("connector-remove").click()
    await page.getByTestId("confirm-ok").click()
    await expect(page.getByTestId("connector-row-github-cli")).toHaveCount(0)
    await expect(page.getByTestId("connector-row-rally")).toBeVisible()

    await page.getByTestId("connector-add-open").click()
    await expect(page.getByTestId("connector-add")).toBeVisible()
    await page.getByTestId("connector-add-name").fill("Wiki")
    await page.getByTestId("connector-add-how").fill("https://wiki.example/api")
    await page.getByTestId("connector-add-submit").click()
    await expect(page.getByTestId("connector-row-wiki")).toBeVisible()
    await expect(page.getByTestId("connector-sheet")).toBeVisible()
  })
})
