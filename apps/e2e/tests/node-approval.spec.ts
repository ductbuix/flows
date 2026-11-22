import { expect, test } from "@playwright/test"

// Approval node: waits for a person, Approve forwards, Reject stops (BL-080).
test.use({ viewport: { width: 1440, height: 900 } })

const API = `http://127.0.0.1:${process.env.PW_API_PORT ?? "8787"}`

async function startRun(
  request: import("@playwright/test").APIRequestContext,
  workflow: string
): Promise<string> {
  const res = await request.post(`${API}/api/workflows/${workflow}/runs`, {
    data: { requestId: crypto.randomUUID() },
  })
  expect(res.ok()).toBeTruthy()
  return ((await res.json()) as { runId: string }).runId
}

for (const theme of ["light", "dark"] as const) {
  test(`the card waits with Approve and Reject, then Approve forwards (${theme})`, async ({
    page,
  }, info) => {
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme)
    await page.goto(`/workflows/node-approval-${theme}?tab=editor`)
    await expect(page.getByTestId("canvas")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId("approval-question")).toHaveValue(
      "Ship the change?"
    )
    await page.screenshot({ path: info.outputPath(`node-approval-${theme}.png`) })

    await page.getByTestId("canvas-run").click()
    await page.getByTestId("start-run-submit").click()

    await expect(page.getByTestId("node-status-gate")).toHaveText("Waiting", {
      timeout: 20_000,
    })
    await expect(page.getByTestId("node-reject-gate")).toBeVisible()
    await page.screenshot({
      path: info.outputPath(`node-approval-waiting-${theme}.png`),
    })

    await page.getByTestId("node-approve-gate").click()
    await expect(page.getByTestId("node-status-gate")).toHaveText("Done", {
      timeout: 20_000,
    })
    await expect(page.getByTestId("node-status-after")).toHaveText("Done", {
      timeout: 20_000,
    })
    await expect(page.getByTestId("node-result-after")).toContainText("shipped")
    await expect(page.getByTestId("node-verdict-gate")).toHaveText("Approved")
    await page.screenshot({
      path: info.outputPath(`node-approval-done-${theme}.png`),
    })
  })
}

test("Needs you shows the question and Approve continues the run", async ({
  page,
  request,
}, info) => {
  const runId = await startRun(request, "node-approval-home")
  await page.goto("/")
  const card = page.getByTestId(`home-needs-you-${runId}-gate`)
  await expect(card).toBeVisible({ timeout: 15_000 })
  await expect(card).toContainText("Ship the change?")
  await page.screenshot({ path: info.outputPath("node-approval-home.png") })
  await page.getByTestId(`home-approve-${runId}-gate`).click()
  await expect(card).toBeHidden({ timeout: 15_000 })

  await page.goto(`/runs/${runId}`)
  await expect(page.getByTestId("step-state-after-1")).toHaveText("succeeded", {
    timeout: 20_000,
  })
  await expect(page.getByTestId("step-verdict-gate-1")).toHaveText("Approved")
})

test("the run view leads with the question and Reject ends the run", async ({
  page,
  request,
}, info) => {
  const runId = await startRun(request, "node-approval-reject")
  await page.goto(`/runs/${runId}`)
  const lead = page.getByTestId("run-waiting")
  await expect(lead).toBeVisible({ timeout: 15_000 })
  await expect(lead).toContainText("Ship the change?")
  await page.screenshot({ path: info.outputPath("node-approval-lead.png") })

  await page.getByTestId("task-reject").click()
  await page.getByRole("button", { name: "Reject", exact: true }).last().click()

  await expect(page.getByTestId("step-verdict-gate-1")).toHaveText("Rejected", {
    timeout: 15_000,
  })
  await expect(page.getByTestId("step-state-gate-1")).toHaveText("cancelled")
  await expect(page.getByTestId("run-waiting")).toBeHidden()
  await page.screenshot({ path: info.outputPath("node-approval-rejected.png") })

  const res = await request.get(`${API}/api/runs/${runId}`)
  const run = (await res.json()) as { status: string; steps?: { nodeId: string }[] }
  expect(run.status).toBe("cancelled")
  expect(run.steps?.some((s) => s.nodeId === "after")).toBeFalsy()
})

test("Add node offers Approval with a question", async ({ page }) => {
  await page.goto("/workflows/node-approval-light?tab=editor")
  await expect(page.getByTestId("canvas")).toBeVisible({ timeout: 15_000 })
  await page.getByTestId("add-node").click()
  await page.getByTestId("add-node-approval").click()
  await expect(page.getByTestId("node-approval")).toBeVisible()
  await expect(page.getByTestId("approval-question").last()).toHaveValue(
    "Continue?"
  )
})
