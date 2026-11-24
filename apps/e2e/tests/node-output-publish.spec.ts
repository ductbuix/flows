import { expect, test } from "@playwright/test"

// Output publish: an Asset with propose access, a step that edits the work
// copy, and an Output that publishes it under the connection policy (BL-084).
// The fake connector sends nothing anywhere.
test.use({ viewport: { width: 1440, height: 900 } })

const API = `http://127.0.0.1:${process.env.PW_API_PORT ?? "8787"}`

test.beforeAll(async ({ request }) => {
  const res = await request.post(`${API}/api/connections`, {
    data: {
      id: "pub-demo",
      connector: "fake",
      name: "Publish demo",
      scope: { label: "alpha" },
      signIn: "cli",
      refresh: "1h",
      policy: "approve-each-publish",
    },
  })
  expect([200, 201, 409]).toContain(res.status())
})

for (const theme of ["light", "dark"] as const) {
  test(`the Output waits for approval, then publishes the work copy (${theme})`, async ({
    page,
  }, info) => {
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme)
    await page.goto(`/workflows/node-publish-${theme}?tab=editor`)
    await expect(page.getByTestId("canvas")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId("output-target")).toHaveText("Publish")
    await expect(page.getByTestId("output-connection")).toHaveText("pub-demo")
    await expect(page.getByTestId("asset-access-badge")).toHaveText("Propose")
    await page.screenshot({
      path: info.outputPath(`node-publish-${theme}.png`),
    })

    await page.getByTestId("node-settings-ship").click()
    await expect(page.getByTestId("output-target-select")).toContainText(
      /publish/i
    )
    await expect(page.getByTestId("output-connection-select")).toContainText(
      "pub-demo"
    )
    await page.screenshot({
      path: info.outputPath(`node-publish-sheet-${theme}.png`),
    })
    await page.keyboard.press("Escape")

    await page.getByTestId("canvas-run").click()
    await page.getByTestId("start-run-submit").click()
    await expect(page.getByTestId("node-status-ship")).toHaveText("Waiting", {
      timeout: 20_000,
    })
    await page.screenshot({
      path: info.outputPath(`node-publish-waiting-${theme}.png`),
    })

    await page.getByTestId("node-approve-ship").click()
    await expect(page.getByTestId("node-status-ship")).toHaveText("Done", {
      timeout: 20_000,
    })
    await page.screenshot({
      path: info.outputPath(`node-publish-done-${theme}.png`),
    })
  })
}

test("Reject on the Output stops the run and nothing is published", async ({
  page,
  request,
}) => {
  const res = await request.post(
    `${API}/api/workflows/node-publish-reject/runs`,
    {
      data: { requestId: crypto.randomUUID() },
    }
  )
  expect(res.ok()).toBeTruthy()
  const { runId } = (await res.json()) as { runId: string }
  await page.goto(`/runs/${runId}`)
  await page.getByTestId("run-view-graph").click()
  await expect(page.getByTestId("node-status-ship")).toHaveText("Waiting", {
    timeout: 20_000,
  })
  await page.getByTestId("node-reject-ship").click()
  await expect(page.getByTestId("node-status-ship")).toHaveText("Cancelled", {
    timeout: 20_000,
  })
})

test("the run view lists the publish as a Cloud effect", async ({
  page,
  request,
}, info) => {
  const res = await request.post(
    `${API}/api/workflows/node-publish-ledger/runs`,
    {
      data: { requestId: crypto.randomUUID() },
    }
  )
  expect(res.ok()).toBeTruthy()
  const { runId } = (await res.json()) as { runId: string }
  await page.goto(`/runs/${runId}`)
  await page.getByTestId("run-view-graph").click()
  await expect(page.getByTestId("node-status-ship")).toHaveText("Waiting", {
    timeout: 20_000,
  })
  await page.getByTestId("node-approve-ship").click()
  await expect(page.getByTestId("node-status-ship")).toHaveText("Done", {
    timeout: 20_000,
  })
  await page.getByTestId("run-tab-changes").click()
  await expect(page.getByTestId("run-effects")).toContainText(
    "Published via ship"
  )
  await expect(page.getByTestId("run-effects")).toContainText("example.test")
  await page.screenshot({ path: info.outputPath("node-publish-effects.png") })
})

test("the Sheet switches an Asset to propose and an Output to publish", async ({
  page,
}) => {
  await page.goto("/workflows/node-publish-sheet?tab=editor")
  await expect(page.getByTestId("canvas")).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId("output-target")).toHaveText("Folder")

  await page.getByTestId("node-settings-lib").click()
  await page.getByTestId("asset-access").click()
  await page.getByRole("option", { name: "Propose" }).click()
  await page.keyboard.press("Escape")
  await expect(page.getByTestId("asset-access-badge")).toHaveText("Propose")

  await page.getByTestId("node-settings-ship").click()
  await page.getByTestId("output-target-select").click()
  await page.getByRole("option", { name: "Publish" }).click()
  await expect(page.getByTestId("output-connection-select")).toContainText(
    "pub-demo"
  )
  await page.keyboard.press("Escape")
  await expect(page.getByTestId("output-target")).toHaveText("Publish")
  await expect(page.getByTestId("output-connection")).toHaveText("pub-demo")
})
