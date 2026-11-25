import { expect, test } from "@playwright/test"
import { openFixLogin } from "./docket-helpers"

test.describe("docket card runs (BL-200)", () => {
  test("run dialog", async ({ page }) => {
    await openFixLogin(page)
    const panel = page.getByTestId("docket-panel")
    await panel.getByTestId("card-run-open").click()
    const dialog = page.getByTestId("card-run-dialog")
    await expect(dialog).toBeVisible()
    await dialog.getByTestId("card-run-workflow").click()
    await page.getByRole("option", { name: /node start run/i }).click()
    await expect(dialog.getByTestId("card-run-input-ticket")).toBeVisible()
    await expect(dialog.getByTestId("card-run-input-ticket")).toHaveValue(
      "US1234"
    )
    await dialog.getByRole("button", { name: "Cancel" }).click()
    await expect(dialog).toHaveCount(0)
  })

  test("card runs", async ({ page }) => {
    await openFixLogin(page)
    const panel = page.getByTestId("docket-panel")
    await expect(panel.getByText("No runs yet")).toBeVisible()

    await panel.getByTestId("card-run-open").click()
    const dialog = page.getByTestId("card-run-dialog")
    await dialog.getByTestId("card-run-workflow").click()
    await page.getByRole("option", { name: /diamond/i }).click()
    await dialog.getByTestId("card-run-start").click()

    await expect(page.getByTestId("runs-sheet")).toBeVisible({
      timeout: 15_000,
    })
    const runId = await page
      .getByTestId("runs-sheet")
      .getAttribute("data-run-id")
    expect(runId).toBeTruthy()
    await expect(panel.getByTestId(`card-run-row-${runId}`)).toBeVisible({
      timeout: 15_000,
    })
    await page.keyboard.press("Escape")
    await expect(page.getByTestId("runs-sheet")).toHaveCount(0)
    await panel.getByTestId(`card-run-row-${runId}`).click()
    await expect(page.getByTestId("runs-sheet")).toBeVisible()
  })

  test("run on card", async ({ page }) => {
    test.setTimeout(60_000)
    await openFixLogin(page)
    const panel = page.getByTestId("docket-panel")

    await panel.getByTestId("card-run-open").click()
    let dialog = page.getByTestId("card-run-dialog")
    await dialog.getByTestId("card-run-workflow").click()
    await page.getByRole("option", { name: /card slow/i }).click()
    await dialog.getByTestId("card-run-start").click()
    await expect(page.getByTestId("runs-sheet")).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByTestId("runs-cancel")).toBeVisible({
      timeout: 15_000,
    })
    await page.getByTestId("runs-cancel").click()
    await page
      .getByTestId("confirm-dialog")
      .getByRole("button", { name: "Cancel run" })
      .click()
    await expect(page.getByTestId("runs-rerun")).toBeVisible({
      timeout: 15_000,
    })

    const sheet = page.getByTestId("runs-sheet")
    const priorId = await sheet.getAttribute("data-run-id")
    expect(priorId).toBeTruthy()
    await page.getByTestId("runs-rerun").click()
    await expect(sheet).not.toHaveAttribute("data-run-id", priorId!, {
      timeout: 15_000,
    })
    const rerunId = await sheet.getAttribute("data-run-id")
    expect(rerunId).toBeTruthy()
    await expect(panel.getByTestId(`card-run-row-${rerunId}`)).toBeVisible({
      timeout: 15_000,
    })

    await page.getByTestId("runs-cancel").click()
    await page
      .getByTestId("confirm-dialog")
      .getByRole("button", { name: "Cancel run" })
      .click()
    await expect(page.getByTestId("runs-rerun")).toBeVisible({
      timeout: 15_000,
    })
    await page
      .getByTestId("runs-sheet")
      .getByRole("button", { name: "Close" })
      .click()
    await expect(page.getByTestId("runs-sheet")).toHaveCount(0, {
      timeout: 5_000,
    })

    await expect(panel.getByTestId("card-run-open")).toBeVisible()
    await panel.getByTestId("card-run-open").click()
    dialog = page.getByTestId("card-run-dialog")
    await dialog.getByTestId("card-run-workflow").click()
    await page.getByRole("option", { name: /diamond/i }).click()
    await dialog.getByTestId("card-run-start").click()
    await expect(page.getByTestId("runs-rerun")).toBeVisible({
      timeout: 20_000,
    })
  })
})
