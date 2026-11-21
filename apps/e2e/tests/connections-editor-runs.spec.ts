import { expect, test, type Page } from "@playwright/test"
import { openEditor, openYamlTab } from "./helpers"

const API = process.env.PW_API_BASE ?? "http://127.0.0.1:8787"

async function screenshotThemes(page: Page, name: string) {
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

async function createFakeConnection(
  request: import("@playwright/test").APIRequestContext,
  id: string,
  label: string
) {
  const res = await request.post(`${API}/api/connections`, {
    data: {
      id,
      connector: "fake",
      name: id,
      scope: { label },
      signIn: "cli",
      refresh: "1h",
    },
  })
  expect(res.ok()).toBeTruthy()
}

test.describe("connections in editor and runs (BL-046 / J8)", () => {
  test("two tasks, different connections, overview impact, run pins", async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000)
    const suffix = crypto.randomUUID().slice(0, 8)
    const rallyId = `rally-${suffix}`
    const githubId = `github-${suffix}`
    const workflowId = `j8-${suffix}`

    await createFakeConnection(request, rallyId, "STORY-1")
    await createFakeConnection(request, githubId, "REPO-1")

    const createWf = await request.post(`${API}/api/workflows`, {
      data: { id: workflowId, goal: "J8 two connections" },
    })
    expect(createWf.ok()).toBeTruthy()

    const getWf = await request.get(`${API}/api/workflows/${workflowId}`)
    expect(getWf.ok()).toBeTruthy()
    const detail = (await getWf.json()) as { hash: string }

    const yaml = `id: ${workflowId}
goal: J8 two connections
tasks:
  - id: one
    kind: command
    run: "echo one"
  - id: two
    kind: command
    run: "echo two"
    needs: [one]
`
    const put = await request.put(`${API}/api/workflows/${workflowId}`, {
      data: { yaml, baseHash: detail.hash },
    })
    expect(put.ok()).toBeTruthy()

    await openEditor(page, workflowId)
    await expect(page.getByTestId("node-one")).toBeVisible({ timeout: 15_000 })
    await page.getByTestId("node-one").click()
    await expect(page.getByTestId("connections-fieldset")).toBeVisible()
    await page.getByTestId("connection-add-select").click()
    await page.getByRole("option", { name: rallyId }).click()
    await page.getByTestId("connection-add").click()
    await expect(page.getByTestId(`connection-use-${rallyId}`)).toBeVisible()
    await expect(
      page.getByTestId(`connection-access-${rallyId}`)
    ).toContainText(/Read/i)
    await page.getByTestId(`connection-access-${rallyId}`).click()
    const propose = page.getByRole("option", { name: /Propose changes/i })
    await expect(propose).toBeVisible()
    await expect(propose).toBeEnabled()
    await page.keyboard.press("Escape")

    await page.getByTestId("node-two").click()
    await page.getByTestId("connection-add-select").click()
    await page.getByRole("option", { name: githubId }).click()
    await page.getByTestId("connection-add").click()
    await expect(page.getByTestId(`connection-use-${githubId}`)).toBeVisible()

    await expect(
      page.getByTestId(`node-connection-one-${rallyId}`)
    ).toBeVisible()
    await expect(
      page.getByTestId(`node-connection-two-${githubId}`)
    ).toBeVisible()

    await openYamlTab(page)
    await expect(page.getByTestId("yaml-pane")).toContainText(rallyId)
    await expect(page.getByTestId("yaml-pane")).toContainText(githubId)
    await page.getByTestId("save-button").click()
    await expect(page.getByTestId("save-button")).toBeDisabled({
      timeout: 10_000,
    })

    await page.goto(`/workflows/${workflowId}`)
    await expect(page.getByTestId("workflow-overview")).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByTestId("overview-connections")).toBeVisible()
    await expect(page.getByTestId("overview-impact-read")).toBeVisible()
    await screenshotThemes(page, "overview-connections")

    const start = await request.post(
      `${API}/api/workflows/${workflowId}/runs`,
      { data: { requestId: crypto.randomUUID() } }
    )
    expect(start.ok()).toBeTruthy()
    const { runId } = (await start.json()) as { runId: string }

    await page.goto(`/runs/${runId}`)
    await expect(page.getByTestId("run-library-pins")).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByTestId(`run-pin-${rallyId}-STORY-1`)).toBeVisible()
    await expect(page.getByTestId(`run-pin-${githubId}-REPO-1`)).toBeVisible()
    await expect(page.getByTestId("run-library-pins")).toContainText("one")
    await expect(page.getByTestId("run-library-pins")).toContainText("two")
    await screenshotThemes(page, "run-library-pins")
  })
})
