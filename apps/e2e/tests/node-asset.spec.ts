import { expect, test } from "@playwright/test"

// Asset node: library resources pinned at run start, read only (BL-082).
test.use({ viewport: { width: 1440, height: 900 } })

const API = `http://127.0.0.1:${process.env.PW_API_PORT ?? "8787"}`

test.beforeAll(async ({ request }) => {
  const res = await request.post(`${API}/api/connections`, {
    data: {
      id: "asset-demo",
      connector: "fake",
      name: "Asset demo",
      scope: { label: "alpha" },
      signIn: "cli",
      refresh: "1h",
      policy: "read-only",
    },
  })
  // A second theme run finds it already there.
  expect([200, 201, 409]).toContain(res.status())
})

for (const theme of ["light", "dark"] as const) {
  test(`list resources in the Sheet, then the run pins and emits them (${theme})`, async ({
    page,
  }, info) => {
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme)
    await page.goto(`/workflows/node-asset-${theme}?tab=editor`)
    await expect(page.getByTestId("canvas")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId("asset-empty")).toBeVisible()

    await page.getByTestId("node-settings-lib").click()
    await expect(page.getByTestId("node-sheet")).toBeVisible()
    await page.getByTestId("asset-picker-open").click()
    await expect(page.getByTestId("asset-group-asset-demo")).toBeVisible()
    await page.getByTestId("asset-picker-search").fill("alpha")
    await page.screenshot({
      path: info.outputPath(`node-asset-picker-${theme}.png`),
    })
    await page.getByTestId("asset-use-asset-demo-repo").click()
    await page.getByTestId("asset-picker-open").click()
    await page.getByTestId("asset-picker-search").fill("notes")
    await page.getByTestId("asset-use-asset-demo-page").click()
    await expect(page.getByTestId("asset-resource-0")).toContainText(
      "asset-demo / repo / alpha"
    )
    await expect(page.getByTestId("asset-resource-1")).toContainText(
      "asset-demo / page / notes"
    )
    await expect(page.getByTestId("asset-fresh-0")).toBeVisible()
    await page.getByTestId("asset-remove-1").click()
    await expect(page.getByTestId("asset-resource-1")).toHaveCount(0)
    await page.screenshot({
      path: info.outputPath(`node-asset-sheet-${theme}.png`),
    })
    await page.keyboard.press("Escape")
    await expect(page.getByTestId("asset-chips")).toContainText(
      "asset-demo/alpha"
    )
    await page.screenshot({ path: info.outputPath(`node-asset-${theme}.png`) })

    await page.getByTestId("node-save").click()
    await expect(page.getByTestId("node-save")).toBeDisabled()
    await page.getByTestId("canvas-run").click()
    await page.getByTestId("start-run-submit").click()
    await expect(page.getByTestId("node-status-lib")).toHaveText("Done", {
      timeout: 20_000,
    })
    await expect(page.getByTestId("node-status-read")).toHaveText("Done", {
      timeout: 20_000,
    })
    await expect(page.getByTestId("node-result-read")).toContainText("alpha")
    await page.screenshot({
      path: info.outputPath(`node-asset-run-${theme}.png`),
    })
  })
}

test("Add node offers Asset with no resources yet", async ({ page }) => {
  await page.goto("/workflows/node-asset-light?tab=editor")
  await expect(page.getByTestId("canvas")).toBeVisible({ timeout: 15_000 })
  await page.getByTestId("add-node").click()
  await page.getByTestId("add-node-asset").click()
  await expect(page.getByTestId("node-asset")).toBeVisible()
  await expect(page.getByTestId("asset-empty").last()).toBeVisible()
})
