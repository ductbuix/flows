import { expect, test } from "@playwright/test"

// Output notify: a run posts a notice with a title and the input text, the
// sidebar bell counts it, and reading it clears the count (BL-100).
test.use({ viewport: { width: 1440, height: 900 } })
// Notices are app-wide, so these specs must not overlap.
test.describe.configure({ mode: "serial" })

const API = `http://127.0.0.1:${process.env.PW_API_PORT ?? "8787"}`

// Notices are app-wide: leave none unread for specs that screenshot the sidebar.
test.afterEach(async ({ request }) => {
  await request.post(`${API}/api/notices/read`, { data: {} })
})

for (const theme of ["light", "dark"] as const) {
  test(`a Notify Output posts a notice to the bell (${theme})`, async ({
    page,
  }, info) => {
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme)
    await page.goto(`/workflows/node-notify-${theme}?tab=editor`)
    await expect(page.getByTestId("canvas")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId("output-target")).toHaveText("Notify")
    await expect(page.getByTestId("output-title-text")).toHaveText(
      "Build finished"
    )

    await page.getByTestId("node-settings-tell").click()
    await expect(page.getByTestId("output-target-select")).toContainText(
      /notify/i
    )
    await expect(page.getByTestId("output-title")).toHaveValue("Build finished")
    await page.screenshot({
      path: info.outputPath(`node-notify-sheet-${theme}.png`),
    })
    await page.keyboard.press("Escape")

    await page.getByTestId("canvas-run").click()
    await page.getByTestId("start-run-submit").click()
    await expect(page.getByTestId("node-status-tell")).toHaveText("Done", {
      timeout: 20_000,
    })

    await expect(page.getByTestId("notice-unread")).toBeVisible({
      timeout: 10_000,
    })
    await page.getByTestId("notice-bell").click()
    const item = page.getByTestId("notice-item").first()
    await expect(item).toContainText("Build finished")
    await expect(item).toContainText("build is green")
    await expect(item).toHaveAttribute("data-read", "false")
    await page.screenshot({
      path: info.outputPath(`node-notify-bell-${theme}.png`),
    })

    await page.getByTestId("notice-mark-all").click()
    await expect(page.getByTestId("notice-unread")).toBeHidden()
    await expect(item).toHaveAttribute("data-read", "true")
  })
}

test("the Sheet switches an Output to notify and sets the title", async ({
  page,
}) => {
  await page.goto("/workflows/node-notify-sheet?tab=editor")
  await expect(page.getByTestId("canvas")).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId("output-target")).toHaveText("Folder")

  await page.getByTestId("node-settings-tell").click()
  await page.getByTestId("output-target-select").click()
  await page.getByRole("option", { name: "Notify" }).click()
  await page.getByTestId("output-title").fill("Deploy done")
  await page.getByTestId("output-title").blur()
  await page.keyboard.press("Escape")
  await expect(page.getByTestId("output-target")).toHaveText("Notify")
  await expect(page.getByTestId("output-title-text")).toHaveText("Deploy done")
})
