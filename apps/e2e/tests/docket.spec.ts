import { expect, test } from "@playwright/test"
import {
  cardIdForTitle,
  createCard,
  gotoDocket,
  openFixLogin,
  screenshotThemes,
  uniqueTitle,
} from "./docket-helpers"

test.describe("docket (DES-044)", () => {
  test("board", async ({ page }) => {
    await gotoDocket(page)
    await expect(page.getByTestId("docket-card-fix-login")).toBeVisible()
    await expect(page.getByTestId("docket-column-doing")).toBeVisible()
    await expect(page.getByTestId("docket-empty-done")).toBeVisible()
    await screenshotThemes(page, "docket-page")
  })

  test("new card", async ({ page }) => {
    const title = uniqueTitle()
    await gotoDocket(page)
    await page.getByTestId("docket-new-card-open").click()
    await expect(page.getByTestId("docket-new-card")).toBeVisible()
    await page.getByTestId("docket-new-card-title").fill(title)
    await page
      .getByTestId("docket-new-card-ref")
      .fill("https://github.com/costory/flows/issues/216")
    await page
      .getByTestId("docket-new-card")
      .locator("#nc-body")
      .fill("E2E new card body.")
    await page.getByTestId("docket-new-card-submit").click()
    await expect(page.getByTestId("docket-panel")).toBeVisible()
    await expect(
      page.getByTestId(`docket-card-${cardIdForTitle(title)}`)
    ).toBeVisible()
  })

  test("add to column", async ({ page }) => {
    const title = uniqueTitle()
    await gotoDocket(page)
    await page.getByTestId("docket-add-review").click()
    const dialog = page.getByTestId("docket-new-card")
    await expect(dialog).toBeVisible()
    await dialog.getByRole("combobox").click()
    await page.getByRole("option", { name: "Review" }).click()
    await page.getByTestId("docket-new-card-title").fill(title)
    await page.getByTestId("docket-new-card-submit").click()
    const id = cardIdForTitle(title)
    await expect(
      page.getByTestId("docket-column-review").getByTestId(`docket-card-${id}`)
    ).toBeVisible()
  })

  test("drag move", async ({ page }) => {
    await gotoDocket(page)
    await expect(page.getByTestId("docket-card-refactor-auth")).toBeVisible()
    await expect(page.getByTestId("docket-column-todo")).toContainText(
      "Refactor auth session"
    )
    await page
      .getByTestId("docket-card-refactor-auth")
      .dragTo(page.getByTestId("docket-column-doing"))
    await expect(page.getByTestId("docket-column-doing")).toContainText(
      "Refactor auth session"
    )
    await page
      .getByTestId("docket-card-refactor-auth")
      .dragTo(page.getByTestId("docket-column-todo"))
  })

  test("columns", async ({ page }) => {
    await gotoDocket(page)
    await page.getByTestId("docket-columns-open").click()
    await expect(page.getByTestId("docket-columns")).toBeVisible()
    const row = page.getByTestId("columns-row-todo")
    await row.getByLabel("Tone").click()
    await page.getByRole("option", { name: "Working" }).click()
    await page.getByTestId("docket-columns-save").click()
    await expect(page.getByTestId("docket-columns")).toBeHidden()
  })

  test("open panel", async ({ page }) => {
    await gotoDocket(page)
    await page.getByTestId("docket-card-fix-login").click()
    await expect(page.getByTestId("docket-panel")).toBeVisible()
    await expect(page.getByTestId("docket-panel")).toContainText(
      "Fix flaky login"
    )
    await page.keyboard.press("Escape")
    await expect(page.getByTestId("docket-panel")).toHaveCount(0)
  })

  test("edit title body", async ({ page }) => {
    const title = uniqueTitle()
    const nextTitle = `${title}-renamed`
    await gotoDocket(page)
    await createCard(page, title, { body: "Before edit." })
    const panel = page.getByTestId("docket-panel")
    await panel.getByLabel("Edit title").click()
    await panel.getByLabel("title").fill(nextTitle)
    await panel.getByLabel("title").press("Enter")
    await panel.getByLabel("Edit description").click()
    await panel.getByLabel("description").fill("After edit.")
    await panel.getByLabel("description").press("ControlOrMeta+Enter")
    const id = cardIdForTitle(title)
    await expect(page.getByTestId(`docket-card-${id}`)).toContainText(nextTitle)
    await expect(panel.getByLabel("Edit description")).toContainText(
      "After edit."
    )
    await page.keyboard.press("Escape")
  })

  test("delete card", async ({ page }) => {
    const title = uniqueTitle()
    await gotoDocket(page)
    const id = await createCard(page, title)
    await page.getByRole("button", { name: "Card actions" }).click()
    await page.getByTestId("docket-delete").click()
    await page.getByTestId("confirm-ok").click()
    await expect(page.getByTestId("docket-panel")).toHaveCount(0)
    await expect(page.getByTestId(`docket-card-${id}`)).toHaveCount(0)
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
    // The fixture card already owns one asset; notes.md is added after it.
    const menus = panel.getByTestId("asset-open-menu")
    await expect(menus).toHaveCount(1)

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
    await expect(panel.getByText("notes.md")).toBeVisible()
    await expect(menus).toHaveCount(2)

    await menus.nth(1).click()
    await page.getByTestId("asset-remove").click()
    await expect(panel.getByText("notes.md")).toHaveCount(0)
    await expect(menus).toHaveCount(1)
    await expect(panel.getByText("Acceptance criteria")).toBeVisible()
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
