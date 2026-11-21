import { expect, test } from "@playwright/test"
import { enableAdvanced } from "./helpers"

test.describe("run inputs UI (BL-022)", () => {
  test("start form requires ticket and shows field error", async ({ page }) => {
    await page.goto("/workflows/run-inputs/runs")
    await page.getByTestId("run-start").first().click()
    const form = page.getByTestId("start-run-form")
    await expect(form).toBeVisible()
    await page.screenshot({
      path: "test-results/run-inputs-form.png",
      fullPage: true,
    })
    await page.getByTestId("start-run-submit").click()
    await expect(page.getByTestId("start-run-error-ticket")).toBeVisible()
    await page.getByTestId("start-run-cancel").click()
    await expect(form).toBeHidden()
  })

  test("start with values, show run inputs, duplicate ask", async ({
    page,
  }) => {
    await page.goto("/workflows/run-inputs/runs")
    await page.getByTestId("run-start").first().click()
    const ticket = page.getByTestId("start-run-field-ticket")
    await expect(ticket).toBeVisible()
    await ticket.fill("T-100")
    await expect(ticket).toHaveValue("T-100")
    await page.getByTestId("start-run-field-brief").fill("# Brief\n\nHello")
    await page.getByTestId("start-run-submit").click()
    await expect(page).toHaveURL(/\/workflows\/run-inputs\/runs\/[^/]+$/)
    await expect(page.getByTestId("run-status")).toHaveText(/running|succeeded/)
    await expect(page.getByTestId("run-inputs")).toBeVisible()
    await page.getByTestId("run-input-file-ticket-txt").click()
    await expect(page.getByTestId("run-input-preview")).toContainText("T-100")
    await page.screenshot({
      path: "test-results/run-inputs-preview.png",
      fullPage: true,
    })

    await page.goto("/workflows/run-inputs/runs")
    await page.getByTestId("run-start").first().click()
    const ticket2 = page.getByTestId("start-run-field-ticket")
    await expect(ticket2).toBeVisible()
    await ticket2.fill("T-100")
    await expect(ticket2).toHaveValue("T-100")
    await page.getByTestId("start-run-field-brief").fill("# Brief\n\nHello")
    await page.getByTestId("start-run-submit").click()
    const dup = page.getByTestId("confirm-dialog")
    await expect(dup).toBeVisible()
    await expect(dup).toContainText(/anyway|duplicate|already/i)
    await page.screenshot({
      path: "test-results/run-inputs-duplicate.png",
      fullPage: true,
    })
    await page.getByTestId("confirm-ok").click()
    await expect(page).toHaveURL(/\/workflows\/run-inputs\/runs\/[^/]+$/)
  })

  test("queued run shows status and cancel copy", async ({ page }) => {
    await page.goto("/workflows/run-inputs-slow/runs")
    await page.getByTestId("run-start").first().click()
    await page.getByTestId("start-run-field-ticket").fill("Q-1")
    await page.getByTestId("start-run-submit").click()
    await expect(page).toHaveURL(/\/workflows\/run-inputs-slow\/runs\/[^/]+$/)

    await page.goto("/workflows/run-inputs-slow/runs")
    await page.getByTestId("run-start").first().click()
    await page.getByTestId("start-run-field-ticket").fill("Q-2")
    await page.getByTestId("start-run-submit").click()
    await expect(page.getByTestId("run-status")).toHaveText("queued")
    await page.screenshot({
      path: "test-results/run-inputs-queued.png",
      fullPage: true,
    })
    await page.getByTestId("run-cancel").click()
    const dialog = page.getByTestId("confirm-dialog")
    await expect(dialog).toContainText("will not start")
    await page.getByTestId("confirm-ok").click()
    await expect(page.getByTestId("run-status")).toHaveText("cancelled")
  })

  test("inspector edits inputs list and maxConcurrentRuns", async ({
    page,
  }) => {
    await page.goto("/workflows/run-inputs")
    await expect(page.getByTestId("inputs-panel")).toBeVisible()
    await enableAdvanced(page)
    await page.getByTestId("field-max-concurrent-runs").fill("3")
    await page.getByTestId("input-add").click()
    const last = page.getByTestId("input-decl-2")
    await expect(last).toBeVisible()
    await page.getByTestId("field-input-name-2").fill("extra")
    await page.getByTestId("save-button").click()
    await expect(page.getByTestId("yaml-pane")).toContainText("extra")
    await expect(page.getByTestId("yaml-pane")).toContainText(
      "maxConcurrentRuns: 3"
    )
    await page.screenshot({
      path: "test-results/run-inputs-editor.png",
      fullPage: true,
    })
  })
})
