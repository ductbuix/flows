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
    await expect(
      panel.getByRole("link", {
        name: "github.com/costory/flows/issues/198",
      })
    ).toHaveCount(0)
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

test.describe("docket card panel assets (BL-199)", () => {
  test("add asset", async ({ page }) => {
    await openFixLogin(page)
    const panel = page.getByTestId("docket-panel")
    await expect(panel.getByText("Acceptance criteria")).toBeVisible()

    await panel.getByRole("button", { name: "Add asset" }).click()
    await page.getByTestId("asset-add-from-disk").click()
    const dialog = page.getByTestId("asset-disk-dialog")
    await expect(dialog).toBeVisible()
    await dialog.getByTestId("disk-file-input").setInputFiles({
      name: "notes.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Notes\n"),
    })
    await expect(dialog.getByTestId("disk-picker")).toContainText("notes.md")
    await dialog.getByTestId("asset-disk-submit").click()
    await expect(dialog).toBeHidden()
    await expect(
      panel.getByRole("button", { name: "Remove asset notes.md" })
    ).toBeVisible()

    await panel.getByRole("button", { name: "Remove asset notes.md" }).click()
    await expect(
      panel.getByRole("button", { name: "Remove asset notes.md" })
    ).toHaveCount(0)
  })

  test("item files", async ({ page }) => {
    await openFixLogin(page)
    const panel = page.getByTestId("docket-panel")
    await panel.getByTestId("item-open-menu").click()
    await page.getByTestId("item-view-files").click()
    await expect(page).toHaveURL(/\/files/)
    await expect(page.getByTestId("files-page")).toBeVisible()
  })

  test("ref data", async ({ page }) => {
    await openFixLogin(page)
    const panel = page.getByTestId("docket-panel")
    const block = panel.getByTestId("ref-data-block")
    await expect(block).toBeVisible()
    await expect(block.getByText("rally", { exact: true })).toBeVisible()
    await expect(block.getByText("US1234")).toBeVisible()
    await expect(block.getByText("In progress")).toBeVisible()
    await expect(block.getByText("Sprint 42")).toBeVisible()
  })
})

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
    await openFixLogin(page)
    const panel = page.getByTestId("docket-panel")

    // Cancel a live run started from the card.
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

    // Rerun from the same sheet.
    await page.getByTestId("runs-rerun").click()
    const sheet = page.getByTestId("runs-sheet")
    await expect(sheet).toBeVisible()
    const rerunId = await sheet.getAttribute("data-run-id")
    expect(rerunId).toBeTruthy()
    await expect(panel.getByTestId(`card-run-row-${rerunId}`)).toBeVisible({
      timeout: 15_000,
    })

    // Start a fast run and wait for Done so the list stays card-scoped.
    await page.keyboard.press("Escape")
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
