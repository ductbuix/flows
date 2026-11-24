import { expect, test } from "@playwright/test"
import { cancelLiveRuns } from "./helpers"

test.describe("workflows.spec.ts › sheet", () => {
  test("sheet", async ({ page }) => {
    await page.goto("/workflows")
    await page.getByTestId("workflow-diamond").click()
    await expect(page.getByTestId("workflow-sheet")).toBeVisible()
    await expect(page.getByTestId("workflow-open-editor")).toBeVisible()
    await expect(page.getByTestId("sheet-inputs")).toBeVisible()
    await expect(page.getByTestId("workflow-start")).toBeVisible()
  })
})

test.describe("workflows.spec.ts › sheet inputs", () => {
  test("sheet inputs", async ({ page }) => {
    await page.goto("/workflows")
    await page.getByTestId("workflow-node-start-run").click()
    const sheet = page.getByTestId("workflow-sheet")
    await expect(sheet).toBeVisible()
    await expect(sheet.getByTestId("sheet-inputs")).toContainText("ticket")
    await sheet.getByTestId("trigger-input-draft").fill("repo")
    await sheet.getByTestId("trigger-input-add").click()
    await expect(sheet.getByTestId("sheet-inputs")).toContainText("repo")
    await page.keyboard.press("Escape")
    await page.getByTestId("workflow-node-start-run").click()
    await expect(page.getByTestId("sheet-inputs")).toContainText("repo")
  })
})

test.describe("workflows.spec.ts › sheet runs", () => {
  test("sheet runs", async ({ page }) => {
    // Diamond is shared across specs; do not require an empty runs list.
    await cancelLiveRuns("diamond")
    await page.goto("/workflows")
    await page.getByTestId("workflow-diamond").click()
    const sheet = page.getByTestId("workflow-sheet")
    await sheet.getByTestId("sheet-start-card").click()
    await page.getByRole("option", { name: /Fix flaky login/i }).click()
    await sheet.getByTestId("workflow-start").click()
    await expect(page.getByTestId("workflow-editor")).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByTestId("flow-run-banner")).toBeVisible({
      timeout: 15_000,
    })
    await page.goto("/workflows")
    await page.getByTestId("workflow-diamond").click()
    await expect(page.getByTestId("sheet-runs-list")).toBeVisible({
      timeout: 15_000,
    })
  })
})

test.describe("workflows.spec.ts › sheet start", () => {
  test("sheet start", async ({ page }) => {
    await page.goto("/workflows")
    await page.getByTestId("workflow-diamond").click()
    const sheet = page.getByTestId("workflow-sheet")
    await sheet.getByTestId("sheet-start-card").click()
    await page.getByRole("option", { name: /Fix flaky login/i }).click()
    await sheet.getByTestId("workflow-start").click()
    await expect(page.getByTestId("flow-run-bar")).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByTestId("flow-run-banner")).toBeVisible({
      timeout: 20_000,
    })
    await expect(page).toHaveURL(/run=/)
  })
})
