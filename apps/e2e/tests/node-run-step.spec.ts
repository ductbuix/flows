import { expect, test, type Page } from "@playwright/test"

// Run step and Run from here on the canvas (BL-102).
test.use({ viewport: { width: 1440, height: 900 } })

type Step = { nodeId: string; status: string; reused?: boolean }

/** Starts a run from the toolbar and returns its id once the run is done. */
async function fullRun(page: Page) {
  const started = page.waitForResponse(
    (r) =>
      /\/api\/workflows\/[^/]+\/runs$/.test(r.url()) &&
      r.request().method() === "POST"
  )
  await page.getByTestId("canvas-run").click()
  await page.getByTestId("start-run-submit").click()
  const { runId } = (await (await started).json()) as { runId: string }
  await expect(page.getByTestId("node-status-done")).toHaveText("Done", {
    timeout: 20_000,
  })
  return runId
}

async function stepsOf(page: Page, runId: string): Promise<Step[]> {
  const res = await page.request.get(`/api/runs/${runId}`)
  return ((await res.json()) as { steps: Step[] }).steps
}

for (const theme of ["light", "dark"] as const) {
  test(`Run step runs one node on the latest results (${theme})`, async ({
    page,
  }, info) => {
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme)
    await page.goto(`/workflows/node-step-${theme}?tab=editor`)
    await expect(page.getByTestId("canvas")).toBeVisible({ timeout: 15_000 })
    await fullRun(page)
    await expect(page.getByTestId("canvas-run")).toBeEnabled({
      timeout: 10_000,
    })

    const sent = page.waitForRequest(
      (r) => /\/runs$/.test(r.url()) && r.method() === "POST"
    )
    const response = page.waitForResponse(
      (r) =>
        /\/api\/workflows\/[^/]+\/runs$/.test(r.url()) &&
        r.request().method() === "POST"
    )
    await page.getByTestId("node-run-build").click()
    expect((await sent).postDataJSON()).toMatchObject({ only: "build" })
    const { runId } = (await (await response).json()) as { runId: string }

    await expect(page.getByTestId("node-status-build")).toHaveText("Done", {
      timeout: 20_000,
    })
    await expect.poll(async () => (await stepsOf(page, runId)).length).toBe(2)
    const steps = await stepsOf(page, runId)
    // The trigger result is copied; the output node (after build) did not run.
    expect(steps.find((s) => s.nodeId === "start")?.reused).toBe(true)
    expect(steps.find((s) => s.nodeId === "build")?.reused).toBeUndefined()
    expect(steps.find((s) => s.nodeId === "done")).toBeUndefined()
    await expect(page.getByTestId("node-status-done")).toHaveCount(0)
    await page.screenshot({
      path: info.outputPath(`node-run-step-${theme}.png`),
    })
  })

  test(`Run from selected node reuses unchanged steps (${theme})`, async ({
    page,
  }, info) => {
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme)
    await page.goto(`/workflows/node-step-${theme}?tab=editor`)
    await expect(page.getByTestId("canvas")).toBeVisible({ timeout: 15_000 })
    await fullRun(page)
    await expect(page.getByTestId("canvas-run")).toBeEnabled({
      timeout: 10_000,
    })

    // Nothing selected: the menu item is disabled.
    await page.getByTestId("canvas-run-menu").click()
    await expect(page.getByTestId("canvas-run-from")).toBeDisabled()
    await page.keyboard.press("Escape")

    await page.getByTestId("node-build").locator("div").first().click()
    await page.getByTestId("canvas-run-menu").click()
    const response = page.waitForResponse(
      (r) =>
        /\/api\/workflows\/[^/]+\/runs$/.test(r.url()) &&
        r.request().method() === "POST"
    )
    await page.getByTestId("canvas-run-from").click()
    const sent = (await response).request().postDataJSON()
    expect(sent).toMatchObject({ from: "build" })
    const { runId } = (await (await response).json()) as { runId: string }

    for (const id of ["start", "build", "done"]) {
      await expect(page.getByTestId(`node-status-${id}`)).toHaveText("Done", {
        timeout: 20_000,
      })
    }
    const steps = await stepsOf(page, runId)
    expect(steps.find((s) => s.nodeId === "start")?.reused).toBe(true)
    expect(steps.find((s) => s.nodeId === "build")?.reused).toBeUndefined()
    expect(steps.find((s) => s.nodeId === "done")?.reused).toBeUndefined()
    await page.screenshot({
      path: info.outputPath(`node-run-from-${theme}.png`),
    })
  })
}
