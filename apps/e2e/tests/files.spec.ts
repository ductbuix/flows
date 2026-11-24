import { expect, test } from "@playwright/test"
import { e2eHome } from "./helpers"

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

async function openBoardYaml(page: import("@playwright/test").Page) {
  await page.goto("/files")
  await expect(page.getByTestId("mock-files-page")).toBeVisible()
  await page.getByTestId("files-search").fill("board.yaml")
  await expect(page.getByTestId("out-file-docket/board.yaml")).toBeVisible()
  await page.getByTestId("out-file-docket/board.yaml").click()
  await expect(page.getByTestId("files-preview")).toBeVisible()
}

test.describe("files page", () => {
  test("tree", async ({ page }) => {
    await page.goto("/files")
    await expect(page.getByTestId("mock-files-page")).toBeVisible()
    await expect(page.getByTestId("files-count")).not.toHaveText("0 files")
    await expect(page.getByTestId("files-tree")).toBeVisible()
    await page.getByTestId("files-search").fill("board.yaml")
    await expect(page.getByTestId("out-file-docket/board.yaml")).toBeVisible()
    await screenshotThemes(page, "files-tree")
  })

  test("edit save", async ({ page }) => {
    await openBoardYaml(page)
    const editor = page.getByTestId("files-editor")
    const original = await editor.inputValue()
    await expect(editor).toContainText("version: 1")
    await editor.fill(`${original}\n# e2e edit\n`)
    await page.getByTestId("files-save").click()
    await expect(page.getByTestId("files-save")).toBeDisabled()
    await page.reload()
    await openBoardYaml(page)
    await expect(page.getByTestId("files-editor")).toContainText("# e2e edit")
    await page.getByTestId("files-editor").fill(original)
    await page.getByTestId("files-save").click()
    await expect(page.getByTestId("files-save")).toBeDisabled()
  })

  test("reveal", async ({ page }) => {
    await openBoardYaml(page)
    await page.evaluate(() => {
      delete (window as Window & { __FLOWS_LAST_REVEAL__?: string })
        .__FLOWS_LAST_REVEAL__
    })
    await page.getByTestId("files-reveal").click()
    await expect
      .poll(async () =>
        page.evaluate(
          () =>
            (window as Window & { __FLOWS_LAST_REVEAL__?: string })
              .__FLOWS_LAST_REVEAL__ ?? ""
        )
      )
      .toContain("docket/board.yaml")
    const revealed = await page.evaluate(
      () =>
        (window as Window & { __FLOWS_LAST_REVEAL__?: string })
          .__FLOWS_LAST_REVEAL__
    )
    expect(revealed?.startsWith(e2eHome())).toBe(true)
  })

  test("stat", async ({ page }) => {
    await openBoardYaml(page)
    const meta = page.getByTestId("files-stat")
    await expect(meta).toBeVisible()
    await expect(meta).toContainText("YAML")
    await expect(meta).toContainText(/\d+(\.\d+)?\s*(B|KB|MB)/)
  })
})
