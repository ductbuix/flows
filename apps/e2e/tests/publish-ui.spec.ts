import { expect, test, type Page } from "@playwright/test"
import { openEditor, startRun } from "./helpers"

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

async function putWorkflow(
  request: import("@playwright/test").APIRequestContext,
  workflowId: string,
  yaml: string
) {
  const getWf = await request.get(`${API}/api/workflows/${workflowId}`)
  expect(getWf.ok()).toBeTruthy()
  const detail = (await getWf.json()) as { hash: string }
  const put = await request.put(`${API}/api/workflows/${workflowId}`, {
    data: { yaml, baseHash: detail.hash },
  })
  expect(put.ok()).toBeTruthy()
}

async function createApproveConnection(
  request: import("@playwright/test").APIRequestContext,
  id: string,
  scope: Record<string, string>
) {
  const res = await request.post(`${API}/api/connections`, {
    data: {
      id,
      connector: "fake",
      name: id,
      scope,
      signIn: "cli",
      refresh: "1h",
      policy: "approve-each-publish",
    },
  })
  expect(res.ok()).toBeTruthy()
}

test.describe("publish UI (BL-051 / J9)", () => {
  test("editor publish node, waiting review, publish, effects, policy", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000)
    const suffix = crypto.randomUUID().slice(0, 8)
    const connId = `pub-${suffix}`
    const workflowId = `j9-${suffix}`
    const env = `RESOURCE_${connId.replaceAll("-", "_").toUpperCase()}`

    await createApproveConnection(request, connId, { label: "v1" })

    const createWf = await request.post(`${API}/api/workflows`, {
      data: { id: workflowId, goal: "J9 publish" },
    })
    expect(createWf.ok()).toBeTruthy()

    await putWorkflow(
      request,
      workflowId,
      `id: ${workflowId}
goal: J9 publish
tasks:
  - id: edit
    kind: command
    run: "echo changed > \\"$${env}/item/v1/data.txt\\""
    uses:
      - { connection: ${connId}, access: propose }
  - id: ship
    kind: publish
    connection: ${connId}
    needs: [edit]
`
    )

    await openEditor(page, workflowId)
    await expect(page.getByTestId("node-ship")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId("node-impact-ship")).toBeVisible()
    await expect(
      page.getByTestId(`node-connection-ship-${connId}`)
    ).toBeVisible()
    await page.getByTestId("node-edit").click()
    await expect(page.getByTestId("connections-fieldset")).toBeVisible()
    await page.getByTestId(`connection-access-${connId}`).click()
    await expect(
      page.getByRole("option", { name: /Propose changes/i })
    ).toBeEnabled()
    await page.keyboard.press("Escape")
    await page.getByTestId("node-ship").click()
    await expect(page.getByTestId("field-publish-connection")).toContainText(
      connId
    )

    await page.goto(`/connections/${connId}`)
    await expect(page.getByTestId("connection-policy-select")).toBeVisible({
      timeout: 15_000,
    })
    await expect(
      page.getByTestId("connection-policy-help-approve-each-publish")
    ).toBeVisible()
    await page.getByTestId("connection-policy-select").click()
    await page.getByRole("option", { name: "Trust agent review" }).click()
    await expect(
      page.getByTestId("connection-policy-help-trust-agent-review")
    ).toBeVisible()
    await expect
      .poll(async () => {
        const res = await request.get(`${API}/api/connections/${connId}`)
        const body = (await res.json()) as { policy?: string }
        return body.policy
      })
      .toBe("trust-agent-review")
    await page.getByTestId("connection-policy-select").click()
    await page.getByRole("option", { name: "Approve each publish" }).click()
    await expect(
      page.getByTestId("connection-policy-help-approve-each-publish")
    ).toBeVisible()
    await expect
      .poll(async () => {
        const res = await request.get(`${API}/api/connections/${connId}`)
        const body = (await res.json()) as { policy?: string }
        return body.policy
      })
      .toBe("approve-each-publish")
    await screenshotThemes(page, "connection-policy")

    const runId = await startRun(request, workflowId)

    await page.goto("/")
    await expect(page.getByTestId(`home-needs-you-${runId}-ship`)).toBeVisible({
      timeout: 45_000,
    })
    await expect(
      page.getByTestId(`home-needs-you-${runId}-ship`)
    ).toContainText(connId)

    await page.goto(`/runs/${runId}`)
    await expect(page.getByTestId("run-waiting")).toBeVisible({
      timeout: 45_000,
    })
    await expect(page.getByTestId("changes-to-publish")).toBeVisible()
    await expect(page.getByTestId("publish-impact")).toBeVisible()
    await expect(page.getByTestId("publish-preview")).toBeVisible()
    await expect(page.getByTestId("publish-diff")).toBeVisible()
    await expect(page.getByTestId("task-approve")).toHaveText(/Publish/i)
    await expect(page.getByTestId("task-reject")).toHaveText(/Discard/i)
    await screenshotThemes(page, "publish-waiting")

    await page.getByTestId("task-approve").click()
    await expect(page.getByTestId("run-effects")).toBeVisible({
      timeout: 45_000,
    })
    await expect(page.getByTestId("run-effects")).toContainText(connId)
    await expect(page.getByTestId("run-effects")).toContainText(/Published/i)
    await screenshotThemes(page, "publish-effects")
  })

  test("publish conflict shows Alert with Rerun with fresh pull", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000)
    const suffix = crypto.randomUUID().slice(0, 8)
    const connId = `cfl-${suffix}`
    const workflowId = `j9c-${suffix}`
    const env = `RESOURCE_${connId.replaceAll("-", "_").toUpperCase()}`

    await createApproveConnection(request, connId, {
      label: "v1",
      publishResult: "conflict",
    })

    const createWf = await request.post(`${API}/api/workflows`, {
      data: { id: workflowId, goal: "J9 conflict" },
    })
    expect(createWf.ok()).toBeTruthy()

    await putWorkflow(
      request,
      workflowId,
      `id: ${workflowId}
goal: J9 conflict
tasks:
  - id: edit
    kind: command
    run: "echo changed > \\"$${env}/item/v1/data.txt\\""
    uses:
      - { connection: ${connId}, access: propose }
  - id: ship
    kind: publish
    connection: ${connId}
    needs: [edit]
`
    )

    const runId = await startRun(request, workflowId)
    await page.goto(`/runs/${runId}`)
    await expect(page.getByTestId("run-waiting")).toBeVisible({
      timeout: 45_000,
    })
    await page.getByTestId("task-approve").click()
    await expect(page.getByTestId("run-conflict-alert")).toBeVisible({
      timeout: 45_000,
    })
    await expect(page.getByTestId("run-conflict-rerun")).toHaveText(
      /Rerun with fresh pull/i
    )
    await screenshotThemes(page, "publish-conflict")
  })
})
