import { expect, test } from "@playwright/test"

// Node workflows on the default stack (BL-096).
test.use({ viewport: { width: 1440, height: 900 } })

for (const theme of ["light", "dark"] as const) {
  test(`Overview lists nodes and Trigger inputs (${theme})`, async ({
    page,
  }, info) => {
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme)
    await page.goto(`/workflows/node-start-${theme}`)
    const nodes = page.getByTestId("overview-nodes")
    await expect(nodes).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId("overview-node-build")).toContainText(
      "command"
    )
    await expect(page.getByTestId("overview-node-review")).toContainText(
      "claude"
    )
    await expect(page.getByTestId("overview-inputs")).toContainText("ticket")
    await expect(page.getByTestId("overview-tasks")).toHaveCount(0)
    await page.screenshot({
      path: info.outputPath(`node-overview-${theme}.png`),
    })
  })

  test(`Start dialog asks the Trigger input and lists the CLI (${theme})`, async ({
    page,
  }, info) => {
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme)
    await page.goto(`/workflows/node-start-${theme}`)
    await page.getByTestId("run-start").click()
    await expect(page.getByTestId("start-run-form")).toBeVisible()
    await expect(page.getByTestId("start-run-field-ticket")).toBeVisible()
    await page.getByTestId("start-run-submit").click()
    await expect(page.getByTestId("start-run-error-ticket")).toBeVisible()
    await page.screenshot({ path: info.outputPath(`node-start-${theme}.png`) })
    await page.getByTestId("start-run-field-ticket").fill("T-1")
    await page.getByTestId("start-run-submit").click()
    // The workflow has an Agent node, so the trust preflight names its CLI.
    await expect(page.getByTestId("trust-dialog")).toContainText(/Claude/i)
    await page.screenshot({
      path: info.outputPath(`node-start-trust-${theme}.png`),
    })
  })
}

test("a required Trigger input reaches RUN_INPUT", async ({ page }) => {
  await page.goto("/workflows/node-start-run?tab=editor")
  await expect(page.getByTestId("canvas")).toBeVisible({ timeout: 15_000 })
  await page.getByTestId("canvas-run").click()
  const ticket = page.getByTestId("start-run-field-ticket")
  await expect(ticket).toBeVisible()
  await ticket.fill("T-4242")
  await page.getByTestId("start-run-submit").click()
  // Trust is asked for the Agent node's CLI; run once.
  await expect(page.getByTestId("trust-dialog")).toContainText(/Claude/i)
  await page.getByTestId("trust-once").click()
  await expect(page.getByTestId("node-status-build")).toHaveText("Done", {
    timeout: 20_000,
  })
  await expect(page.getByTestId("node-result-build")).toContainText("T-4242")
})
