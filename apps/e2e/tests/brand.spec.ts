import { expect, test } from "@playwright/test"

const IDS = [
  "status",
  "create-form",
  "kanban",
  "canvas",
  "run-card",
  "detail-panel",
  "node-ask",
  "node-logs",
]

test.describe("brand", () => {
  test("lists every mockup and opens each one", async ({ page }) => {
    await page.goto("/brand")
    await expect(page.getByTestId("brand-page")).toBeVisible()
    for (const id of IDS) {
      await expect(page.getByTestId(`brand-card-${id}`)).toBeVisible()
    }
    await page.screenshot({ path: "test-results/brand.png", fullPage: true })

    for (const id of IDS) {
      await page.goto(`/brand/${id}`)
      await expect(page.getByTestId(`brand-mockup-${id}`)).toBeVisible()
      await expect(page.getByTestId("brand-stage")).toBeVisible()
      await page.screenshot({
        path: `test-results/brand-${id}.png`,
        fullPage: true,
      })
    }
  })

  test("run card switches between running and done", async ({ page }) => {
    await page.goto("/brand/run-card")
    const card = page.getByTestId("mockup-run-card")
    await expect(card.getByText("3 working")).toBeVisible()
    await card.getByRole("button", { name: "Stop" }).click()
    await expect(card.getByText("Done", { exact: true })).toBeVisible()
    await expect(card.getByText("Answer")).toBeVisible()
  })
})
