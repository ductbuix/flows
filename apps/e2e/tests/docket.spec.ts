import { expect, test } from "@playwright/test"
import {
  cardIdForTitle,
  createCard,
  gotoDocket,
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
